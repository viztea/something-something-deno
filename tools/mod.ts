import { v10 } from "../discord/deps.ts";

export * from "./types.ts";
export * from "./limiter.ts";
export * from "./stream.ts";

export function intents(...intents: (keyof typeof v10.GatewayIntentBits)[]): number {
    return intents.reduce((acc, intent) => acc | v10.GatewayIntentBits[intent], 0);
}
