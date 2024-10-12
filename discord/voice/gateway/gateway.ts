import { Nullable, Readable, readable } from "../../../tools/mod.ts";
import { discord, readableStreamFromIterable, v4, ws } from "../deps.ts";
import { pogSocketEventTransform, SocketEvent, SocketEventType } from "./ws.ts";
import { VoiceGatewayEvent, VoiceGatewayEventType } from "./event.ts";
import { handleReceivedPayload } from "./handlers.ts";
import type { VoiceGatewayHeart } from "./heart.ts";
import type { VoiceGatewaySession } from "./session.ts";
import session from "./session.ts";
import { k_vgw_memory } from "./symbols.ts";

const defaultVgw = {
    get events() {
        return this[k_vgw_memory].events.stream;
    },
    get heart() {
        return this[k_vgw_memory].heart;
    },
    get session() {
        return this[k_vgw_memory].session;
    },
} as VoiceGateway;

interface VoiceGatewayMemory {
    settings: VoiceGatewaySettings;
    heart: Nullable<VoiceGatewayHeart>;
    session: Nullable<VoiceGatewaySession>;
    socket: Nullable<ws.PogSocket>;
    connect: Nullable<Readonly<VoiceGatewayConnectOptions>>;
    events: Readable<VoiceGatewayEvent>;
}

export interface VoiceGateway {
    [k_vgw_memory]: VoiceGatewayMemory;

    /**
     * The current session of this gateway connection, or null if not yet available.
     */
    readonly session: Nullable<VoiceGatewaySession>;

    /**
     * The heart of this gateway connection, or null if not yet available.
     */
    readonly heart: Nullable<VoiceGatewayHeart>;

    /**
     * Stream of events from this Voice Gateway instance, stream is active indefintely unless detached.
     */
    readonly events: ReadableStream<VoiceGatewayEvent>;
}

export interface VoiceGatewaySettings {
    readonly encryptionMode: v4.VoiceEncryptionMode;
}

export interface VoiceGatewayConnectOptions {
    /**
     * The voice gateway endpoint to connect to.
     */
    endpoint: string;

    /**
     * The token to use.
     */
    token: string;

    /**
     * Voice session ID to use.
     */
    sessionId: string;

    /**
     * The ID of the user this connection is for.
     */
    userId: discord.Snowflake

    /** 
     * The ID of the guild this connection is for.
     */
    guildId: discord.Snowflake;
}

async function vgwCreateSocket(gateway: VoiceGateway): Promise<ReadableStream<SocketEvent> | null> {
    const connect = gateway[k_vgw_memory].connect;
    if (!connect) {
        return null;
    }

    /* create socket */
    const url = `wss://${connect.endpoint}/?v=4`

    emitDebug(gateway, "ws", "creating connection to url", url);
    const socket = gateway[k_vgw_memory].socket = await ws.connectPogSocket(url);

    /* return message stream. */
    return readableStreamFromIterable(ws.readSocket(socket))
        .pipeThrough(pogSocketEventTransform());
}

async function vgwConnect(gateway: VoiceGateway) {
    const memory = gateway[k_vgw_memory]

    /* connect to the voice gateway. */
    const events = await vgwCreateSocket(gateway);
    if (!events) {
        throw new Error("Failed to connect to voice gateway.");
    }

    /* resume the current session or identify as a new session */
    if (gateway.session) {
        session.resume(gateway.session, gateway);
    } else send(gateway, {
        op: v4.VoiceOpcodes.Identify,
        d: {
            server_id: memory.connect!.guildId,
            user_id: memory.connect!.userId,
            session_id: memory.connect!.sessionId,
            token: memory.connect!.token,
        }
    });

    /* handle socket vents */
    for await (const event of events) {
        if (event.type === SocketEventType.Payload) {
            handleReceivedPayload(gateway, event.data);
        } else if (event.type === SocketEventType.Close) {
            break
        }

        emit(gateway, {
            t: VoiceGatewayEventType.Socket,
            d: event
        });
    }
}

/**
 * Creates a new gateway.
 * 
 * @returns the created gateway.
 */
function create(settings: VoiceGatewaySettings): VoiceGateway {
    const memory: VoiceGatewayMemory = {
        settings,
        connect: null,
        session: null,
        socket: null,
        heart: null,
        events: readable()
    }

    return Object.assign(defaultVgw, { [k_vgw_memory]: memory });
}

/**
 * Connects to the gateway.
 * 
 * @param gateway the gateway to connect.
 * @returns the connected gateway.
 */
async function connect(gateway: VoiceGateway, options: VoiceGatewayConnectOptions): Promise<void> {
    gateway[k_vgw_memory].connect = options;
    await vgwConnect(gateway);
}

/**
 * Disconnects from the gateway.
 * 
 * @param gateway the gateway to disconnect.
 * @returns the disconnected gateway.
 */
function disconnect(gateway: VoiceGateway): Promise<VoiceGateway> {
    return Promise.resolve(gateway);
}

/**
 * Detach this gateway connection.
 * 
 * @param gateway the gateway to detach.
 * @returns the detached gateway.
 */
function detach(gateway: VoiceGateway): Promise<VoiceGateway> {
    return Promise.resolve(gateway);
}

/**
 * Emits an event on the provided {@link gateway}.
 * 
 * @param gateway the gateway to emit the {@link event} on.
 * @param event   the event to emit.
 * @returns the provided {@link gateway}.
 */
function emit(gateway: VoiceGateway, event: VoiceGatewayEvent): VoiceGateway {
    gateway[k_vgw_memory].events.controller.enqueue(event);
    return gateway;
}

/**
 * Emits a debug event on the provided {@link gateway} with the supplied {@link category} and {@link msg}.
 * 
 * @param gateway  the gateway to emit the debug event on.
 * @param category the category of the debug message.
 * @param msg      the message to emit.
 * @returns the provided {@link gateway}.
 */
function emitDebug(gateway: VoiceGateway, category: string, ...msg: unknown[]): VoiceGateway {
    return emit(gateway, {
        t: VoiceGatewayEventType.Debug,
        d: { category, msg },
    });
}

/**
 * Sends a payload to the gateway.
 * 
 * @param gateway the gateway to send the {@link payload} to.
 * @param payload the payload to send.
 * @returns `true` if the payload was sent, `false` otherwise.
 */
function send(gateway: VoiceGateway, payload: v4.VoiceSendPayload): boolean {
    if (!gateway[k_vgw_memory].socket) {
        throw new Error("Gateway is not connected.");
    }

    /* encode payload into JSON */
    let encoded;
    try {
        encoded = JSON.stringify(payload)
    } catch (cause) {
        emitDebug(gateway, "ws", "unable to encode payload:", payload);

        emit(gateway, {
            t: VoiceGatewayEventType.Error,
            d: new Error("Could not encode JSON", { cause })
        });

        return false;
    }

    /* send encoded payload to socket */
    ws.sendMessage(gateway[k_vgw_memory].socket, encoded);
    emitDebug(gateway, "ws", ">>>", encoded);

    return true;
}

export default { create, connect, disconnect, detach, send, emitDebug, emit }
