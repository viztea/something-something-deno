import "https://deno.land/std@0.167.0/dotenv/load.ts";

import { createShard } from "./discord/gateway/shard_impl.ts";
import { blue, green, magenta, yellow } from "https://deno.land/std@0.167.0/fmt/colors.ts";
import { intents } from "./tools/mod.ts";
import { APIv10, v10 } from "./discord/gateway/deps.ts";
import { VoiceGatewayConnectOptions, VoiceGatewayEventType, VoiceGateways } from "./discord/voice/gateway/mod.ts";
import { PCMStream } from "./tools/ffmpeg.ts";
import { getInfo, downloadFromInfo } from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";
import connections from "./discord/voice/connections.ts";

const shard = createShard({
    token: Deno.env.get("DISCORD_TOKEN")!,
    version: 10,
    events: {
        debug: (category, ...msg) => console.debug(blue("SHARD"), yellow(`[${category}]`), ...msg),
        error: e => console.error(blue("SHARD"), e)
    }
});

shard.connect([0, 1], {
    intents: intents("GuildVoiceStates", "GuildMessages", "MessageContent"),
    presence: {
        status: v10.PresenceUpdateStatus.Online,
        activities: [
            {
                name: "gateway messages",
                type: v10.ActivityType.Listening,
            }
        ],
        since: Date.now(),
        afk: true,
    },
    properties: {
        browser: "Deno",
        device: "Deno",
        os: "Android",
    }
});

const vgw = VoiceGateways.create({
    encryptionMode: "xsalsa20_poly1305_lite",
}), vgwConnectData: Partial<VoiceGatewayConnectOptions> = {};


async function connectVgw() {
    if (vgwConnectData.endpoint && vgwConnectData.token && vgwConnectData.sessionId) {
        await VoiceGateways.connect(vgw, vgwConnectData as VoiceGatewayConnectOptions);
    }
}

vgw.events.pipeTo(new WritableStream({
    write: event => {
        switch (event.t) {
            case VoiceGatewayEventType.Debug:
                console.debug(magenta("VOICE"), yellow(`[${event.d.category}]`), ...event.d.msg);
                break;
            case VoiceGatewayEventType.Error:
                console.error(magenta("VOICE"), event.d);
                break;
            case VoiceGatewayEventType.Ready:
                console.log(magenta("VOICE"), "Ready!");
                break;
        }
    }
}));

let whoami: APIv10.APIUser;
for await (const dispatch of shard.dispatch) {
    switch (dispatch.t) {
        case v10.GatewayDispatchEvents.Ready: {
            whoami = dispatch.d.user;
            console.log(`${whoami.username}#${whoami.discriminator} is now online!`);

            vgwConnectData.userId = whoami.id;
            vgwConnectData.guildId = "323365823572082690";

            shard.send({
                op: v10.GatewayOpcodes.VoiceStateUpdate,
                d: {
                    self_deaf: true,
                    self_mute: false,
                    channel_id: "1193997464886317137",
                    guild_id: "323365823572082690"
                }
            });

            break;
        }

        case v10.GatewayDispatchEvents.MessageCreate: {
            if (!dispatch.d.content.startsWith("--")) {
                break;
            }

            const [command, ...words] = dispatch.d.content
                .slice(2)
                .split(" ");

            switch (command) {
                case "play": {
                    const connection = vgw.session?.connection;
                    if (!connection) {
                        console.error("No connection found.");
                        break;
                    }

                    const input = words.join(" ");
                    connections.provide(
                        connection,
                        await getPCMStream(input)
                    )

                    // const suite = await connections.suite(connection), writer = writers.create(2048, "big");

                    // let seq = 0, ts = 0, speaking = false;
                    // await stream
                    //     .pipeThrough(createOpusTransform())
                    //     .pipeThrough(streams.map(_ => RTP.packet.create(RTP.header.create(ts, seq, connection.ssrc), _)))
                    //     .pipeThrough(streams.tap(_ => void (seq++, ts += 960)))
                    //     .pipeThrough(streams.tap(_ => delay(20)))
                    //     .pipeThrough(streams.map(_ => {
                    //         writers.reset(writer);

                    //         RTP.header.write(_.header, writer);
                    //         suite.encrypt(writer, _.header, _.body);

                    //         return writers.slice(writer);
                    //     }))
                    //     .pipeThrough(streams.tap(_ => !speaking ? void updateSpeaking(connection, speaking = true) : void 0))
                    //     .pipeTo(transports.writable(connection.transport));

                    break;
                }
            }

            break;
        }

        case v10.GatewayDispatchEvents.VoiceServerUpdate: {
            if (dispatch.d.endpoint) {
                vgwConnectData.endpoint = dispatch.d.endpoint;
            }

            vgwConnectData.token = dispatch.d.token;
            connectVgw();
            break;
        }

        case v10.GatewayDispatchEvents.VoiceStateUpdate: {
            if (whoami!.id !== dispatch.d.user_id) {
                break;
            }

            vgwConnectData.sessionId = dispatch.d.session_id;
            connectVgw();
            break;
        }
    }
}

async function getPCMStream(input: string, ffmpegArgs: Record<string, string> = {}) {
    let parentStream: ReadableStream<Uint8Array>;
    if (input.includes("youtube.com")) {
        /* retrieve information on the video. */
        const info = await getInfo(input);
        console.info(green("INPUT"), `retrieved information on ${input}: ${info.videoDetails.title}`)

        /* start to download */
        const stream = await downloadFromInfo(info, {
            filter: "audioonly",
            quality: "highestaudio"
        });

        parentStream = stream.pipeThrough(new PCMStream("-", ffmpegArgs));
    } else {
        parentStream = new PCMStream(input, ffmpegArgs);
    }

    return parentStream
}
