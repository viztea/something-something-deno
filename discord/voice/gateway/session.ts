import type { VoiceConnection } from "../connections.ts";
import { v4 } from "../deps.ts";
import type { VoiceGateway } from "./gateway.ts";
import gateway from "./gateway.ts";
import { k_vgw_memory } from "./symbols.ts";

export interface VoiceGatewaySession {
    /**
     * The current session id.
     */
    readonly id: string;

    /**
     * The current voice connection.
     */
    readonly connection: VoiceConnection;
}

/**
 * Creates a new session.
 * 
 * @param id the session id.
 * @param connection the voice connection.
 * @returns the created session.
 */
function create(id: string, connection: VoiceConnection): VoiceGatewaySession {
    return { id, connection };
}

/**
 * Instructs the supplied gateway to resume this session.
 * 
 * @param session the session to resume.
 * @param vgw     the gateway to resume the session on.
 * @returns the supplied session.
 */
function resume(session: VoiceGatewaySession, vgw: VoiceGateway): VoiceGatewaySession {
    const connect = vgw[k_vgw_memory].connect
    if (!connect) {
        throw new Error("Cannot resume session without `connect` options.");
    }

    gateway.send(vgw, {
        op: v4.VoiceOpcodes.Resume,
        d: {
            server_id: connect.guildId,
            session_id: session.id,
            token: connect.token
        }
    });

    return session;
}

export default { create, resume };
