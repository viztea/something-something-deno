import { v10 } from "../deps.ts";
import { closeReasons } from "./constants.ts";
import { ShardState } from "./shard.ts";
import { createShardHeart, createShardSession, shardDisconnect, ShardMemory, shardReconnect } from "./shard_impl.ts";

export function handleCloseCode(memory: ShardMemory, code: number): boolean {
    let invalidate = false;
    switch (code) {
        case v10.GatewayCloseCodes.UnknownError:
            memory.settings.events?.debug?.("lifecycle", "gateway encountered an unknown error, reconnecting...");
            shardReconnect(memory);
            break;
        case v10.GatewayCloseCodes.UnknownOpcode:
        case v10.GatewayCloseCodes.DecodeError:
        case v10.GatewayCloseCodes.AuthenticationFailed:
        case v10.GatewayCloseCodes.AlreadyAuthenticated:
        case v10.GatewayCloseCodes.RateLimited:
            memory.settings.events?.debug?.("ws", closeReasons[code]);
            break;
        case v10.GatewayCloseCodes.InvalidSeq:
            memory.settings.events?.debug?.("error", "[lifecycle] invalid sequence");
            memory.session?.updateSequence(-1);
            break;
        case v10.GatewayCloseCodes.NotAuthenticated:
        case v10.GatewayCloseCodes.SessionTimedOut:
        case v10.GatewayCloseCodes.InvalidShard:
        case v10.GatewayCloseCodes.ShardingRequired:
        case v10.GatewayCloseCodes.InvalidAPIVersion:
        case v10.GatewayCloseCodes.InvalidIntents:
        case v10.GatewayCloseCodes.DisallowedIntents:
            memory.settings.events?.debug?.("ws", ...closeReasons[code]);
            invalidate = true;
            break;
        case 1006:
            memory.settings.events?.debug?.("ws", "connection was reset.");
            break;
    }

    return invalidate;
}

export async function handleReceivedPayload(memory: ShardMemory, payload: v10.GatewayReceivePayload) {
    memory.settings.events?.debug?.("ws", "<<<", JSON.stringify(payload));
    switch (payload.op) {
        case v10.GatewayOpcodes.Hello: {
            memory.settings.events?.debug?.("lifecycle", `received HELLO, heartbeat_interval=${payload.d.heartbeat_interval}`);

            memory.heart = createShardHeart(memory, payload.d.heartbeat_interval);
            memory.state = ShardState.Identifying;
            break;
        }

        case v10.GatewayOpcodes.Heartbeat: {
            memory.settings.events?.debug?.("ws/heart", "gateway requested heartbeat...");
            await memory.heart?.beat("request");
            break;
        }

        case v10.GatewayOpcodes.HeartbeatAck: {
            memory.heart?.ack();
            break;
        }

        case v10.GatewayOpcodes.Dispatch: {
            await handleDispatchPayload(memory, payload);
            break;
        }

        case v10.GatewayOpcodes.InvalidSession: {
            memory.settings.events?.debug?.("lifecycle", `received INVALID_SESSION, resumable=${payload.d}`);
            if (payload.d) {
                memory.state = ShardState.Resuming;
                await memory.session?.resume();
                break;
            }

            memory.state = ShardState.Identifying;
            memory.session = null;
            break;
        }

        case v10.GatewayOpcodes.Reconnect: {
            memory.settings.events?.debug?.("ws", "gateway asked us to reconnect...");
            shardDisconnect(memory, { reconnect: true });
            break;
        }
    }
}

async function handleDispatchPayload(memory: ShardMemory, payload: v10.GatewayDispatchPayload) {
    memory.session?.updateSequence(payload.s);
    switch (payload.t) {
        case v10.GatewayDispatchEvents.Ready: {
            memory.state = ShardState.Ready;

            /* send a ready heartbeat. */
            await memory.heart?.beat("ready", true);
            
            /* create a new session. */
            memory.session = createShardSession(memory, payload.d.session_id);
            memory.connect!.gateway = payload.d.resume_gateway_url;
            
            const user = payload.d.user;
            if (user) {
                memory.settings.events?.debug?.("lifecycle", `identified as ${user.username}#${user.discriminator}.`, "session_id:", payload.d.session_id);
            } else {
                memory.settings.events?.debug?.("lifecycle", "identified as an unknown bot?", "session_id:", payload.d.session_id);
            }

            break;
        }

        case v10.GatewayDispatchEvents.Resumed: {
            memory.settings.events?.debug?.("lifecycle", "session has been resumed.");
            memory.state = ShardState.Ready;
            await memory.heart?.beat("resumed", true);
            break;
        }
    }

    memory.dispatch.controller.enqueue(payload);
}
