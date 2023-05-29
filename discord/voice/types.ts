import type  * as v4 from "https://deno.land/x/discord_api_types@0.37.21/voice/mod.ts";
import type { discord } from "../deps.ts";

export * from "https://deno.land/x/discord_api_types@0.37.21/voice/mod.ts";

// #region Shared
interface BasePayload {
	/**
	 * Opcode for the payload
	 */
	op: v4.VoiceOpcodes;
	/**
	 * Event data
	 */
	d?: unknown;
}

export type VoiceReceivePayload = VoiceReady | VoiceHello | VoiceSessionDescription | VoiceClientConnect | VoiceClientDisconnect | VoiceHeartbeatAck | VoiceSpeakingReceive | VoiceResumed;

export type VoiceSendPayload    = VoiceSelectProtocol | VoiceIdentify | VoiceSpeakingSend | VoiceResume | VoiceHeartbeat;

/*  */
// todo(melike2d): verify this:
export type VoiceEncryptionMode = 
    | "xsalsa20_poly1305" 
    | "xsalsa20_poly1305_lite" 
    | "xsalsa20_poly1305_suffix" 
    | "aead_aes256_gcm" 
    | "aead_aes256_gcm_rtpsize";

export interface VoiceReadyData {
    ssrc: number;
    ip: string;
    port: number;
    modes: VoiceEncryptionMode[];
}

export interface VoiceReady extends BasePayload {
    op: v4.VoiceOpcodes.Ready;
    d: VoiceReadyData;
}

/*  */
export interface VoiceHelloData {
    heartbeat_interval: number;
}

export interface VoiceHello extends BasePayload {
    op: v4.VoiceOpcodes.Hello;
    d: VoiceHelloData;
}

/*  */
export interface VoiceSelectProtocolData {
    protocol: "udp";
    data: {
        address: string;
        port: number;
        mode: VoiceEncryptionMode;
    }
}

export interface VoiceSelectProtocol extends BasePayload {
    op: v4.VoiceOpcodes.SelectProtocol;
    d: VoiceSelectProtocolData;
}

/*  */
export interface VoiceSessionDescriptionData {
    mode: VoiceEncryptionMode;
    secret_key: number[];
}

export interface VoiceSessionDescription extends BasePayload {
    op: v4.VoiceOpcodes.SessionDescription;
    d: VoiceSessionDescriptionData;
}

/*  */
export interface VoiceSpeakingReceiveData {
    speaking: number;
    ssrc: number;
    user_id: discord.Snowflake;
}

export interface VoiceSpeakingReceive extends BasePayload {
    op: v4.VoiceOpcodes.Speaking;
    d: VoiceSpeakingReceiveData;
}

/*  */
export interface VoiceSpeakingSendData {
    speaking: number;
    delay: number;
    ssrc: number;
}

export interface VoiceSpeakingSend extends BasePayload {
    op: v4.VoiceOpcodes.Speaking;
    d: VoiceSpeakingSendData;
}

/*  */
export interface VoiceResumeData {
    server_id: string;
    session_id: string;
    token: string;
}

export interface VoiceResume extends BasePayload {
    op: v4.VoiceOpcodes.Resume;
    d: VoiceResumeData;
}

/*  */
export interface VoiceResumed extends BasePayload {
    op: v4.VoiceOpcodes.Resumed;
    d: null;
}

/* heartbeat */
export interface VoiceHeartbeat extends BasePayload {
    op: v4.VoiceOpcodes.Heartbeat;
    d: number;
}

/* heartbeat_ack */
export interface VoiceHeartbeatAck extends BasePayload {
    op: v4.VoiceOpcodes.HeartbeatAck;
    d: number;
}

/* identify */
export interface VoiceIdentifyData {
    server_id: string;
    user_id: string;
    session_id: string;
    token: string;
}

export interface VoiceIdentify extends BasePayload {
    op: v4.VoiceOpcodes.Identify;
    d: VoiceIdentifyData;
}

/* client_connect */
export interface VoiceClientConnect extends BasePayload {
    op: v4.VoiceOpcodes.ClientConnect;
    d: null; // TODO(melike2d)
}

/* client_disconnect */
export interface VoiceClientDisconnectData {
    user_id: discord.Snowflake;
    
}

export interface VoiceClientDisconnect extends BasePayload {
    op: v4.VoiceOpcodes.ClientDisconnect;
    d: VoiceClientDisconnectData;
}
