import { Nullable } from "../../tools/types.ts";
import { v10 } from "../deps.ts";

export enum ShardCompression {
    /** Enable optional compression for all packets when Discord is sending events over the connection. */
    Transport,
    /** Enable optional per-packet compression for some events when Discord is sending events over the connection. */
    Payload
}

export enum ShardState {
    /**
     * The shard is currently idle, doing nothing.
     * @type {ShardState.Idle}
     */
    Idle,
    /**
     * The shard has
     * @type {ShardState.Ready}
     */
    Ready,
    /**
     * The shard is currently disconnecting.
     * @type {ShardState.Disconnecting}
     */
    Disconnecting,
    /**
     * The shard has been disconnected.
     * @type {ShardState.Disconnected}
     */
    Disconnected,
    /**
     * The shard is currently reconnecting.
     * @type {ShardState.Reconnecting}
     */
    Reconnecting,
    /**
     * The shard is currently connecting.
     * @type {ShardState.Connecting}
     */
    Connecting,
    /**
     * The shard is resuming the current session.
     * @type {ShardState.Resuming}
     */
    Resuming,
    /**
     * The shard is identifying with the gateway.
     * @type {ShardState.Identifying}
     */
    Identifying,
    /**
     * The shard has been destroyed, it must be remade to function again.
     * @type {ShardState.Destroyed}
     */
    Destroyed
}

export interface ShardSession {
    /** The current session id. */
    readonly id: string;

    /** The current dispatch sequence */
    readonly sequence: Nullable<number>;

    /** Resume the current session. */
    resume(): Promise<void>;

    /** Update the current session dispatch sequence. */
    updateSequence(value: number): void;
}

export interface ShardHeart {
    /** Whether our last heartbeat was acknowledged. */
    readonly acknowledged: boolean;

    /** The latency between heartbeats & their acknowledgements, or null if not available yet. */
    readonly latency: Nullable<number>;

    /** The heartbeating task */
    readonly task: number;

    /** Acknolwedge our last heartbeat. */
    ack(): void;
}

export interface ShardSettings {
    /** The token to use. */
    readonly token: string;

    // EVENTS
    readonly events?: {
        error?(error: Error): void;
        debug?(category: string, ...args: unknown[]): void;
    }

    /** Function used for creating a custom shard session. */
    // readonly createHeart?: (shard: Shard, heartbeatInterval: number) => ShardHeart;

    /** Function used for creating a custom Shard session. */
    // readonly createSession?: (shard: Shard, id: string) => ShardSession;

    /** Function used for creating a send payload limiter. */
    // readonly createLimiter?: () => Limiter
}

export interface ShardConnectOptions {
    /** The intents to use. */
    readonly intents?: number;

    /** Presence data to use when identifying. */
    readonly presence?: v10.GatewayPresenceUpdateData;

    /** Identification properties to use. */
    readonly properties?: v10.GatewayIdentifyProperties;

    /** Whether compression should be enabled. */
    readonly compression?: ShardCompression;

    /** The gateway to use, e.g. "wss://gateway.discord.gg/" */
    readonly gateway?: string

}

export interface ShardDisconnectOptions {
    /** Close code to use. */
    code?: number;

    /** Whether to reconnect. */
    reconnect?: boolean;

    /** Whether this is fatal. */
    fatal?: boolean;
}

export interface Shard {
    /** Current state of this Shard. */
    readonly state: ShardState;

    /** The current session of this shard. */
    readonly session: Nullable<ShardSession>;

    /** The heart of this shard, responsible for heartbeating. */
    readonly heart: Nullable<ShardHeart>

    /** Stream of incoming dispatch events. */
    readonly dispatch: ReadableStream<v10.GatewayDispatchPayload>;

    /** The current token */
    get token(): string;

    /**
     * Connect this shard to the gateway.
     * 
     * @param options Options to use.
     */
    connect(options?: ShardConnectOptions): Promise<void>;

    /**
     * Disconnect this shard from the gateway.
     * 
     * @param options Options to use.
     */
    disconnect(options: ShardDisconnectOptions): Promise<void>;

    /** Detach this shard, making it unusable afterwards. */
    detach(): Promise<void>;

    /** 
     * Send a payload to the gateway.
     * 
     * @param payload   Payload to send.
     * @param important Whether this payload is important.
     */
    send(payload: v10.GatewaySendPayload, important?: boolean): Promise<void>;
}
