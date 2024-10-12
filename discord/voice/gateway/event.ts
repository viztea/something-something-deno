import { VoiceConnection } from "../connections.ts";
import { discord } from "../deps.ts";
import type { SocketEvent } from "./ws.ts";

export enum VoiceGatewayEventType {
    /** Used for debugging purposes. */
    Debug,

    /** Voice Gateway is now Ready. */
    Ready,

    /** Encountered an error. */
    Error,

    /** ... */
    Close,

    /** A user joined the voice channel */
    UserJoin,

    /** A user left the voice channel */
    UserLeft,

    /** Socket event */
    Socket,
}

type createVoiceGatewayEvent<Type extends VoiceGatewayEventType, Data> = { t: Type, d: Data };

export type VoiceGatewayEvent =
    | VoiceGatewayDebugEvent
    | VoiceGatewayReadyEvent
    | VoiceGatewayErrorEvent
    | VoiceGatewayCloseEvent
    //
    | VoiceGatewayUserJoinEvent
    | VoiceGatewayUserLeaveEvent
    //
    | VoiceGatewaySocketEvent;

export type VoiceGatewayDebugEvent = createVoiceGatewayEvent<VoiceGatewayEventType.Debug, { category: string, msg: unknown[] }>;

export type VoiceGatewayReadyEvent = createVoiceGatewayEvent<VoiceGatewayEventType.Ready, VoiceConnection>;

export type VoiceGatewayUserJoinEvent = createVoiceGatewayEvent<VoiceGatewayEventType.UserJoin, { id: discord.Snowflake, ssrc: number }>;

export type VoiceGatewayUserLeaveEvent = createVoiceGatewayEvent<VoiceGatewayEventType.UserLeft, { id: discord.Snowflake }>;

export type VoiceGatewayErrorEvent = createVoiceGatewayEvent<VoiceGatewayEventType.Error, Error>;

export type VoiceGatewayCloseEvent = createVoiceGatewayEvent<VoiceGatewayEventType.Close, { code: number, reason?: string }>;

export type VoiceGatewaySocketEvent = createVoiceGatewayEvent<VoiceGatewayEventType.Socket, SocketEvent>;
