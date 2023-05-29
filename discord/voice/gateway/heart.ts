import { interval, Interval, Nullable } from "../../../tools/mod.ts";
import { v4 } from "../deps.ts";
import gateway, { VoiceGateway } from "./gateway.ts";

const k_memory: unique symbol = Symbol.for("VoiceGatewayHeart#memory");
const defaultHeart = {
    get acknowledged() {
        return this[k_memory].acknowledged;
    },
    get latency() {
        return this[k_memory].latency;
    }
} as VoiceGatewayHeart

interface VoiceGatewayHeartMemory {
    acknowledged: boolean;
    latency: Nullable<number>;
    lastHeartbeat: Nullable<number>;
    gateway: VoiceGateway;
    task: Interval;
}

/**
 * The heart of a voice gateway connection.
 */
export interface VoiceGatewayHeart {
    [k_memory]: VoiceGatewayHeartMemory;

    /**
     * Whether the latest heartbeat was acknowledged.
     */
    readonly acknowledged: boolean;

    /**
     * The latency between heartbeats & their acknowledgements, or null if not available yet.
     */
    readonly latency: Nullable<number>;
}

/**
 * Creates a new heart for the supplied {@link gateway}.
 * 
 * @param gateway the gateway to create the heart for.
 * @returns the created heart.
 */
function create(gateway: VoiceGateway, heartbeatInterval: number): VoiceGatewayHeart {
    const heart: VoiceGatewayHeart = Object.assign(defaultHeart, {
        [k_memory]: {
            acknowledged: false,
            gateway,
            lastHeartbeat: 0,
            latency: null,
            task: interval()
        },
    });

    heart[k_memory].task.start(
        heartbeatInterval,
        () => beat(heart, "heartbeat task", true), 
    );

    return heart;
}

/**
 * Sends a heartbeat to the gateway.
 * 
 * @param heart          the heart to beat.
 * @param reason         The reason for the heartbeat.
 * @param ignoreNonAcked Whether to ignore the heartbeat if the last one was not acknowledged.
 * @returns the heart.
 */
function beat(heart: VoiceGatewayHeart, reason: string, ignoreNonAcked = false): VoiceGatewayHeart {
    const memory = heart[k_memory];
    if (!memory.acknowledged) {
        gateway.emitDebug(memory.gateway, "ws/heart", "last heartbeat was not acknowledged, reconnecting...");
        if (!ignoreNonAcked) {
            // TODO(melike2d): disconnect from gateway
            // return shardDisconnect(memory, { reconnect: true, code: 1_012 })
        }
    }

    gateway.emitDebug(memory.gateway, "ws/heart", "sending heartbeat, reason:", reason)
    memory.lastHeartbeat = performance.now();
    memory.acknowledged = false;

    gateway.send(
        memory.gateway,
        { op: v4.VoiceOpcodes.Heartbeat, d: memory.lastHeartbeat },
    );

    return heart;
}

/**
 * Acknowledges the heartbeat with the supplied nonce.
 * 
 * @param heart The heart to acknowledge the heartbeat for.
 * @param nonce The nonce of the heartbeat to acknowledge.
 * @returns `true` if the heartbeat was acknowledged, `false` otherwise.
 */
function ack(heart: VoiceGatewayHeart, nonce: number): boolean {
    const memory = heart[k_memory];
    if (nonce === memory.lastHeartbeat) {
        memory.acknowledged = true;
        memory.latency = performance.now() - memory.lastHeartbeat!;

        gateway.emitDebug(
            memory.gateway, 
            "ws/heart", 
            "last heartbeat was acknowledged.", "latency:", memory.latency
        );

        return true;
    }
    
    gateway.emitDebug(memory.gateway, "ws/heart", "received acknowledement with a different nonce, ignoring...");
    return false;
}

/**
 * Stops the heartbeat task.
 * 
 * @param heart the heart to stop.
 * @returns the stopped heart.
 */
function stop(heart: VoiceGatewayHeart): VoiceGatewayHeart {
    heart[k_memory].task?.stop?.();
    return heart;
}

export default { create, ack, stop, beat }
