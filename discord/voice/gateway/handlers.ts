import connections, { useSecretKey } from "../connections.ts";
import { v4 } from "../deps.ts";
import { formatAddress } from "../utils.ts";
import { VoiceGatewayEventType } from "./event.ts";
import gateway, { VoiceGateway } from "./gateway.ts";
import heart from "./heart.ts";
import session from "./session.ts";
import { k_vgw_memory } from "./symbols.ts";

/* 
Voice close event codes
4001 unknown opcode:           reconnect? yes, not fatal (most likely a user error)
4002 failed to decode payload: reconnect? yes, not fatal (most likely a user error)
4003 not authenticated:        reconnect? no
4004 authentication failed:    reconnect? no
4005 already authenticated:    reconnect? no
4006 session no longer valid:  reconnect? yes, fatal
4009 session timeout:          reconnect? yes, fatal
4011 server not found:         reconnect? no
4002 unknown protocol:         reconnect? no
4014 disconnected:             reconnect? no
4015 voice server crashed:     reconnect? yes, not fatal
4016 unknown encryption mode:  reconnect? no (most likely a user error)
*/

export async function handleReceivedPayload(vgw: VoiceGateway, payload: v4.VoiceReceivePayload) {
    gateway.emitDebug(vgw, "ws", "<<<", JSON.stringify(payload));

    switch (payload.op) {
        case v4.VoiceOpcodes.Hello:
            gateway.emitDebug(vgw, "lifecycle", `received HELLO, heartbeat_interval=${payload.d.heartbeat_interval}`);
            vgw[k_vgw_memory].heart = heart.create(vgw, payload.d.heartbeat_interval);
            break;

        case v4.VoiceOpcodes.Ready: {
            /* ensure that the set encryption mode is supported. */
            const encryptionMode = vgw[k_vgw_memory].settings.encryptionMode;
            if (!payload.d.modes.includes(encryptionMode)) {
                break;
            }

            /* create a voice connection. */
            const connection = await connections.create(vgw, {
                mode: encryptionMode,
                ssrc: payload.d.ssrc,
                server: {
                    ip: payload.d.ip,
                    port: payload.d.port,
                }
            });

            if (!connection) {
                throw new Error("Could not create voice connection.");
            }

            /* create voice gateway session. */
            gateway.emitDebug(
                vgw,
                "lifecycle",
                "created voice connection, our local address:", formatAddress(connection.localAddress)
            );

            vgw[k_vgw_memory].session = session.create(
                vgw[k_vgw_memory].connect!.sessionId,
                connection
            );

            /* send select protocol. */
            gateway.emitDebug(vgw, "lifecycle", "sending SELECT_PROTOCOL...");

            gateway.send(vgw, {
                op: v4.VoiceOpcodes.SelectProtocol,
                d: {
                    protocol: "udp",
                    data: {
                        address: connection.localAddress.ip,
                        port: connection.localAddress.port,
                        mode: encryptionMode
                    }
                }
            });

            break;
        }

        case v4.VoiceOpcodes.ClientConnect:
            break;

        case v4.VoiceOpcodes.ClientDisconnect:
            gateway.emit(vgw, {
                t: VoiceGatewayEventType.UserLeft,
                d: { id: payload.d.user_id }
            });

            break;

        case v4.VoiceOpcodes.SessionDescription: {
            const session = vgw[k_vgw_memory].session;
            if (!session) {
                throw new Error("Received session description but no session was created.");
            }

            useSecretKey(session.connection, new Uint8Array(payload.d.secret_key));

            /* emit ready event */
            gateway.emit(vgw, {
                t: VoiceGatewayEventType.Ready,
                d: session.connection
            });

            break;
        }

        case v4.VoiceOpcodes.Resumed:
            break;

        case v4.VoiceOpcodes.HeartbeatAck:
            if (vgw.heart) heart.ack(vgw.heart, payload.d);
            break;
    }
}
