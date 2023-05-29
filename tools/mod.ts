import { v10 } from "../discord/gateway/deps.ts";
import { Endianess } from "./endianess.ts";
import * as readers from "./byte_reader.ts";
import * as writers from "./byte_writer.ts";

export * from "./types.ts";
export * from "./limiter.ts";
export * from "./stream.ts";
export * from "./interval.ts";

export * from "./endianess.ts";

export { readers, writers }

export function intents(...intents: (keyof typeof v10.GatewayIntentBits)[]): number {
    return intents.reduce((acc, intent) => acc | v10.GatewayIntentBits[intent], 0);
}

export function uint32toBytes(value: number, endianess: Endianess = "big"): Uint8Array {
    return writers.writeUInt32(writers.create(4, endianess), value).data;
}

export function randomBytes(size: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(size));
}

// voice-testing

export function floorDiv(a: number, b: number): number {
    return Math.floor(a / b);
}

export function range(start: number, stop: number, step = 1): number[] {
    return Array(Math.ceil((stop - start) / step)).fill(start).map((x, y) => x + y * step)
}

export function withIndex<T>(arr: T[]): { index: number, value: T }[] {
    return arr.map((value, index) => ({ value, index }));
}

export function randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min)
}

export function formatMilliseconds(ms: number): string {
    return new Date(ms)
        .toISOString()
        .substring(11, 19)
        .replace(/^\d{2}:/, "")
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(max, Math.min(min, value));
}
