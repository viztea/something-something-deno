import { Nullable, RequiredKeys, createLimiter } from "../../tools/mod.ts";
import { JsonParseStream, ModernError, v10, ws, inflate, delay } from "../deps.ts";
import { Shard, ShardCompression, ShardConnectOptions, ShardDisconnectOptions, ShardHeart, ShardSession, ShardSettings, ShardState } from "./shard.ts";
import { createDecompressor, Decompress } from "./zlib.ts";

export const EncodeError = ModernError.subclass("EncodeError");

function createReadableStream<T>(): { stream: ReadableStream<T>, controller: ReadableStreamDefaultController<T> } {
    let controller: ReadableStreamDefaultController<T>;

    const stream = new ReadableStream<T>({
        start: ctr => void (controller = ctr)
    });

    // @ts-expect-error: controller is assigned 
    return { stream, controller }
}

export function createShardHeart(shard: Shard, interval: number): ShardHeart {
    let acknowledged = true, lastHeartbeat: number, latency: Nullable<number> = null;

    function send() {
        if (!acknowledged) {
            // TODO(melike2d): handle zombie shards.
            return;
        }

        lastHeartbeat = performance.now();
        shard.send({ op: v10.GatewayOpcodes.Heartbeat, d: shard.session?.sequence ?? -1 }, true);
    }

    return {
        task: setInterval(send, interval),
        get acknowledged() {
            return acknowledged;
        },
        get latency() {
            return latency;
        },
        ack: () => {
            acknowledged = true;
            latency = performance.now() - lastHeartbeat!;
        }
    }
}

export function createShardSession(shard: Shard, id: string): ShardSession {
    let sequence: ShardSession["sequence"] = null;
    function resume() {
        const d: v10.GatewayResumeData = {
            token: shard.token,
            seq: sequence ?? -1,
            session_id: id
        }

        return shard.send({ op: v10.GatewayOpcodes.Resume, d });
    }

    return { 
        id,
        get sequence() {
            return sequence
        },
        resume, 
        updateSequence: value => sequence = value 
    };
}

/** Default shard configuration */
export const DEFAULT_SHARD_CONNECT_CONFIG: RequiredKeys<ShardConnectOptions, Exclude<keyof ShardConnectOptions, "presence">> = {
    intents: 0,
    compression: ShardCompression.Payload,
    gateway: "wss://gateway.discord.gg",
    properties: {
        browser: "Kyu Bot",
        device: "Kyu Bot",
        os: "iOS",
    }
}

export function createShard(settings: ShardSettings): Shard {
    let heart: Nullable<ShardHeart> = null,
        session: Nullable<ShardSession> = null,
        socket: Nullable<ws.PogSocket> = null,
        state: ShardState = ShardState.Idle,
        gateway: string;

    function send(payload: v10.GatewaySendPayload) {
        if (!socket) return;

        /* encode payload into JSON */
        let encoded;
        try {
            encoded = JSON.stringify(payload)
        } catch(cause) {
            settings.events?.error?.(new EncodeError("Could not encode JSON", { cause }));
            settings.events?.debug?.("ws", "unable to encode payload:", payload);
            return
        }

        /* send encoded payload to socket */
        ws.sendMessage(socket, encoded);
        settings.events?.debug?.("ws/send", `${v10.GatewayOpcodes[payload.op]}:`, encoded);
    }

    const dispatch = createReadableStream<v10.GatewayDispatchPayload>()
        , limiter  = createLimiter({ async: true, defaultTokens: 120, refreshAfter: 6e4 });

    /* pause the payload limiter so that nothing gets sent before the shard is ready. */
    limiter.pause();

    async function connect(options: typeof DEFAULT_SHARD_CONNECT_CONFIG) {
        let compress = !!options.compression
        if (options.compression === ShardCompression.Transport) {
            settings.events?.debug?.("ws", "transport compression is not supported, using payload compression instead.");
            compress = false;
        }

        const params = new URLSearchParams(), messages = createReadableStream<string>();

        /* set default parameters. */
        params.append("encoding", "json");

        /* setup compression. */
        let decompress: Decompress;
        if (compress) {
            const decoder = new TextDecoder();
            if (options.compression === ShardCompression.Transport) {
                decompress = createDecompressor({
                    error: e => {
                        settings.events?.error?.(e);
                    },
                    data: data => {
                        const decoded = decoder.decode(data);
                        messages.controller.enqueue(decoded);
                    }
                });

                params.append("compress", "zlib-stream")
            } else {
                decompress = data => messages.controller.enqueue(decoder.decode(inflate(data)));
            }
        }

        /* create socket. */
        state = ShardState.Connecting;
        socket = await ws.connectPogSocket(`${gateway}?${params}`);

        /* listen for websocket frames. */
        ws.useEvents(socket, {
            message: data => typeof data === "string" 
                ? messages.controller.enqueue(data)
                : decompress(data)
        });
        
        /* return message stream */
        const parsedStream = messages.stream.pipeThrough(new JsonParseStream());
        return parsedStream as unknown as ReadableStream<v10.GatewayReceivePayload>;
    }
 
    return {
        state, dispatch: dispatch.stream,
        get heart() {
            return heart
        },
        get session() {
            return session
        },
        get token() {
            return settings.token;
        },
        async connect(options: ShardConnectOptions = {}) {
            options = Object.assign(DEFAULT_SHARD_CONNECT_CONFIG, options);
            gateway = options.gateway!;

            for await (const payload of await connect(options as typeof DEFAULT_SHARD_CONNECT_CONFIG)) {
                settings.events?.debug?.("ws/recv", `${v10.GatewayOpcodes[payload.op]}:`, JSON.stringify(payload));
                
                switch (payload.op) {
                    case v10.GatewayOpcodes.Dispatch: {
                        switch (payload.t) {
                            case v10.GatewayDispatchEvents.Ready: {
                                await limiter.resume();
                                session = createShardSession(this, payload.d.session_id);
                                gateway = payload.d.resume_gateway_url;
                                break;
                            }
                        }

                        session?.updateSequence(payload.s);
                        dispatch.controller.enqueue(payload);
                        break;
                    }

                    case v10.GatewayOpcodes.Hello: {
                        state = ShardState.Identifying;

                        heart = createShardHeart(this, payload.d.heartbeat_interval);

                        send({
                            op: v10.GatewayOpcodes.Identify,
                            d: {
                                intents: options.intents!,
                                properties: options.properties!,
                                token: settings.token,
                                presence: options.presence,
                                compress: options.compression === ShardCompression.Payload
                            }
                        });

                        break;
                    }
                }
            }
        },
        disconnect: async (options: ShardDisconnectOptions) => {
            console.log(options);
            await delay(1);
        },
        detach: async () => {

        },
        send: (payload: v10.GatewaySendPayload, important = false) =>
            limiter.push(send.bind(void 0, payload), important)
    }
}
