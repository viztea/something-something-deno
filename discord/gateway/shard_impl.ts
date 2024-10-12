import { Nullable, RequiredKeys, createLimiter, readable, Limiter, Readable } from "../../tools/mod.ts";
import { v10, ws, readableStreamFromIterable } from "./deps.ts";
import { Shard, ShardCompression, ShardConnectOptions, ShardDisconnectOptions, ShardHeart, ShardId, ShardSession, ShardSettings, ShardState } from "./shard.ts";
import { pogSocketEventTransform, SocketEventType } from "./ws.ts";
import { handleCloseCode, handleReceivedPayload } from "./handlers.ts";
import { UNRECOVERABLE_CLOSE_CODES } from "./constants.ts";
import { BaseMemory, send0 } from "../socket.ts";

export function createShardHeart(memory: ShardMemory, interval: number): ShardHeart {
    let acknowledged = true, lastHeartbeat: number, latency: Nullable<number> = null;

    async function send(reason: string, ignoreNonAcked = false) {
        if (!acknowledged) {
            memory.settings.events?.debug?.("ws/heart", "last heartbeat was not acknowledged, reconnecting...");
            if (!ignoreNonAcked) return shardDisconnect(memory, { reconnect: true, code: 1_012 });
        }

        memory.settings.events?.debug?.("ws/heart", "sending heartbeat, reason:", reason)
        lastHeartbeat = performance.now();
        acknowledged = false;

        await shardSend(
            memory,
            { op: v10.GatewayOpcodes.Heartbeat, d: memory.session?.sequence ?? -1 },
            true
        );
    }

    const task = setInterval(send, interval, "task");
    return {
        get acknowledged() {
            return acknowledged;
        },
        get latency() {
            return latency;
        },
        ack: () => {
            acknowledged = true;
            latency = performance.now() - lastHeartbeat!;
            memory.settings.events?.debug?.("ws/heart", "last heartbeat was acknowledged.", "latency:", latency);
        },
        stop: () => clearInterval(task),
        beat: send
    }
}

export function createShardSession(memory: ShardMemory, id: string): ShardSession {
    let sequence: ShardSession["sequence"] = null;
    function resume() {
        const d: v10.GatewayResumeData = {
            token: memory.settings.token,
            seq: sequence ?? -1,
            session_id: id
        }

        return shardSend(memory, { op: v10.GatewayOpcodes.Resume, d }, true);
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
export const DEFAULT_SHARD_CONNECT_CONFIG: RequiredKeys<ShardConnectOptions, Exclude<keyof ShardConnectOptions, "presence" | "shard">> = {
    intents: 0,
    compression: ShardCompression.Payload,
    gateway: "wss://gateway.discord.gg",
    properties: {
        browser: "Kyu Bot",
        device: "Kyu Bot",
        os: "iOS",
    }
}

export function shardSend(memory: ShardMemory, payload: v10.GatewaySendPayload, important = false) {
    return memory.limiter.push(() => send0(memory, payload), important);
}

function shardClose0(memory: ShardMemory, reason: string, code = 4_420): boolean {
    try {
        if (memory.socket) ws.closeSocket(memory.socket, code, reason);
        return true
    } catch (e) {
        memory.settings.events?.error?.(e);
        memory.settings.events?.debug?.("ws", `unable to close ws connection: ${e}`);
        return false;
    } finally {
        memory.limiter.pause();
        memory.socket = null;
    }
}

async function shardConnect0(memory: ShardMemory) {
    const connect = memory.connect;
    if (!connect) {
        return;
    }

    if (connect.options.compression === ShardCompression.Transport) {
        memory.settings.events?.debug?.("ws", "transport compression is not supported, using payload compression instead.");
        connect.compression = ShardCompression.Payload;
    }

    /* create gateway url params */
    const params = new URLSearchParams();
    params.append("v", memory.settings.version.toString());
    params.append("encoding", "json");

    if (connect.compression === ShardCompression.Transport) {
        params.append("compress", "zlib-stream")
    }

    /* create socket. */
    const url = `${connect.gateway}?${params}`;
    memory.settings.events?.debug?.("ws", "creating connection to url", url);
    memory.state = ShardState.Connecting;
    memory.socket = await ws.connectPogSocket(url);

    /* return message stream */
    return readableStreamFromIterable(ws.readSocket(memory.socket)).pipeThrough(pogSocketEventTransform(memory))
}

export function shardReconnect(memory: ShardMemory) {
    if (memory.socket?.isClosed === false) {
        shardClose0(memory, "reconnecting...");
    }

    memory.settings.events?.debug?.("lifecycle", "attempting to", memory.session
        ? "resume the current session"
        : "reconnect to the gateway");

    return shardConnect(memory);
}

export function shardDisconnect(memory: ShardMemory, options: ShardDisconnectOptions) {
    if (!memory.socket) {
        return;
    }

    memory.state = ShardState.Disconnecting;
    memory.heart?.stop();
    memory.heart = null;

    if (!memory.socket.isClosed) {
        shardClose0(memory, "reconnecting...", options.reconnect && memory.session ? 4_420 : options.code);
    }

    memory.state = ShardState.Disconnected;
    if (options.fatal) {
        memory.session = null;
    }

    if (options.reconnect) {
        return shardReconnect(memory);
    }

    memory.settings.events?.debug?.("lifecycle", "disconnected from the gateway.");
}

async function shardConnect(memory: ShardMemory) {
    const events = await shardConnect0(memory);
    if (!events) {
        throw new Error("Unable to create socket.");
    }

    // todo(melike2d): queue identify
    if (memory.session) {
        memory.settings.events?.debug?.("identify", "found previous session, resuming.");
        await memory.session.resume();
    } else {
        memory.settings.events?.debug?.("identify", "couldn't find existing session, identifying.");
        await shardSend(memory, {
            op: v10.GatewayOpcodes.Identify,
            d: {
                intents: memory.connect!.options.intents!,
                properties: memory.connect!.options.properties!,
                token: memory.settings.token,
                presence: memory.connect!.options.presence,
                compress: memory.connect!.options.compression === ShardCompression.Payload,
                shard: memory.connect!.id
            }
        }, true);
    }

    for await (const event of events) {
        if (event.type === SocketEventType.Payload) {
            await handleReceivedPayload(memory, event.data);
        } else if (event.type === SocketEventType.Close) {
            if ([ShardState.Disconnecting, ShardState.Disconnected].includes(memory.state)) {
                /* we meant to disconnect, nothing to do here. */
                return;
            }

            const wasClean = event.code = 1006;
            memory.settings.events?.debug?.("[ws/close]", `${wasClean ? "" : "non-"}clean close... code:`, event.code, "reason:", event.reason ?? "no reason provided");

            /* reset heart state. */
            memory.heart?.stop();
            memory.heart = null;

            /* update our state. */
            memory.state = ShardState.Disconnected;

            /* handle the close code correctly. */
            const fatal = handleCloseCode(memory, event.code)   
                , unrecoverable = UNRECOVERABLE_CLOSE_CODES.includes(event.code);

            memory.settings.events?.debug?.(
                "ws",
                "received", unrecoverable ? "unrecoverable" : "recoverable", "close code"
            );

            shardDisconnect(memory, { reconnect: !unrecoverable, fatal })
        }
    }
}

export function createShard(settings: ShardSettings): Shard {
    const memory: ShardMemory = {
        settings,
        heart: null,
        session: null,
        socket: null,
        state: ShardState.Idle,
        limiter: createLimiter({ async: true, defaultTokens: 120, refreshAfter: 6e4 }),
        dispatch: readable<v10.GatewayDispatchPayload>(),
        connect: null
    }

    return {
        dispatch: memory.dispatch.stream,
        get state() {
            return memory.state
        },
        get heart() {
            return memory.heart
        },
        get session() {
            return memory.session
        },
        get token() {
            return settings.token;
        },
        async connect(id: ShardId, options: ShardConnectOptions = {}) {
            const connectOptions = Object.assign(DEFAULT_SHARD_CONNECT_CONFIG, options);
            memory.connect = {
                id,
                options: connectOptions,
                gateway: connectOptions.gateway,
                compression: connectOptions.compression
            };

            await shardConnect(memory);
        },
        disconnect(options: ShardDisconnectOptions) {
            shardDisconnect(memory, options);
        },
        detach() {
            shardDisconnect(memory, { code: 4_000, reconnect: false, fatal: true });
            memory.dispatch.controller.close();
        },
        async send(payload: v10.GatewaySendPayload, important = false) {
            await shardSend(memory, payload, important)
        }
    }
}


export interface ShardMemory extends BaseMemory {
    settings: ShardSettings;
    heart: Nullable<ShardHeart>;
    session: Nullable<ShardSession>;
    socket: Nullable<ws.PogSocket>;
    state: ShardState;
    limiter: Limiter;
    dispatch: Readable<v10.GatewayDispatchPayload>;
    connect: Nullable<{
        compression: ShardCompression;
        gateway: string;
        id: ShardId;
        options: typeof DEFAULT_SHARD_CONNECT_CONFIG;
    }>;
}
