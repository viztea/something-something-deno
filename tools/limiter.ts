import { delay } from "../deps.ts";
import { Awaitable } from "./types.ts";

export type Callback = () => Awaitable<void>;

export interface Limiter {
    /**  */
    push(callback: Callback, important?: boolean): Promise<void>

    /** Pause this limiter for a specified duration. */
    pause(duration?: number): Promise<void>;

    /** Resume this limiter. */
    resume(): Promise<void>;
}

export interface LimiterOptions {
    /** Number of tokens to allocate */
    readonly defaultTokens: number;

    /** How long to wait until resetting available tokens */
    readonly refreshAfter: number;

    /** Whether to await callbacks */
    readonly async: boolean;

    onLimit?: (duration: number) => void;
}

interface LimiterState {
    readonly queue: Callback[];
    readonly options: LimiterOptions;

    tokens: number;
    executing: boolean;
    paused: boolean;
    last: number;
}

function reset(state: LimiterState) {
    state.tokens = state.options.defaultTokens;
}

async function pause(state: LimiterState, duration = 0) {  
    state.paused = true;
    if (duration) {
        await delay(duration);
        await resume(state);
    }
}

async function resume(state: LimiterState) {  
    state.paused = false;
    reset(state);
    await check(state);
}

async function check(state: LimiterState) {
    if (state.paused || state.executing || !state.queue.length) {
        return;
    }

    if (state.tokens <= 0) {
        const waitTime = Math.max(state.options.refreshAfter - (Date.now() - state.last), 0);
        state.options.onLimit?.(waitTime);
        return pause(state, waitTime);
    }

    const token = state.queue.shift();
    if (token) {
        /* make sure to reset our tokens after the specified wait time. */
        if (state.tokens === state.options.defaultTokens) {
            setTimeout(reset, state.options.refreshAfter, state);
        }

        state.tokens--;
        state.last = Date.now();

        /* execute the token */
        try {
            state.executing = true;
            if (state.options.async) {
                await token();
            } else {
                token();
            }
        } finally {
            state.executing = false;
            check(state);
        }
    }
}

export function createLimiter(options: LimiterOptions): Limiter {
    const state: LimiterState = {
        options,
        tokens: options.defaultTokens, 
        queue: [], 
        paused: false, 
        executing: false,
        last: 0
    };

    return {
        push: async (callback, important = false) => {
            state.queue[important ? "unshift" : "push"](callback);
            await check(state);
        },
        pause: duration => pause(state, duration),
        resume: () => resume(state)
    }
}
