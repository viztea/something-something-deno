import { Nullable } from "../tools/types.ts";
import { ws } from "./deps.ts";

export interface BaseSettings {
    readonly events?: {
        debug?: (category: string, ...msg: unknown[]) => void;
        error?: (error: Error) => void;
    }
}

export interface BaseMemory {
    settings: BaseSettings;
    socket: Nullable<ws.PogSocket>;
}

// TODO(melike2d): convert function events to event stream
export function send0(memory: BaseMemory, payload: unknown) {
    if (!memory.socket) return;

    /* encode payload into JSON */
    let encoded;
    try {
        encoded = JSON.stringify(payload)
    } catch (cause) {
        memory.settings.events?.error?.(new Error("Could not encode JSON", { cause }));
        memory.settings.events?.debug?.("ws", "unable to encode payload:", payload);
        return
    }

    /* send encoded payload to socket */
    ws.sendMessage(memory.socket, encoded);
    memory.settings.events?.debug?.("ws", ">>>", encoded);
}
