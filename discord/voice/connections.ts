import { Nullable, Readable, readable, readableToWritableStream } from "../../tools/mod.ts";
import type { BaseSettings } from "../socket.ts";
import type { Address } from "./utils.ts";
import type { Frame } from "./frame/mod.ts";
import { v4 } from "./deps.ts";

import transports, { VoiceTransport } from "./transports.ts";
import { VoiceGateways, VoiceGateway } from "./gateway/mod.ts";
import { createOpusTransform } from "./frame/opus.ts";

// legacy
import { createFrameSender } from "./frame/legacy_sender.ts";
import { createSuite } from "./frame/enc/legacy_suite.ts";
import { createPacketProvider } from "./frame/legacy_provider.ts";
import type { CryptoSuite } from "./frame/enc/legacy_suite.ts";
ts
const k_memory = Symbol.for("VoiceConnection#memory");

interface VoiceConnectionMemory {
    settings: VoiceConnectionSettings;
    secretKey: Nullable<Uint8Array>;
    frames: Readable<Frame>;
}

export interface VoiceConnectionSettings extends BaseSettings {
    /**
     * The address of the voice server to connect to.
     */
    readonly server: Address;

    /**
     * The SSRC of this voice connection.
     */
    readonly ssrc: number;

    /**
     * The encryption mode to use.
     */
    readonly mode: v4.VoiceEncryptionMode;
}

export interface VoiceConnection {
    [k_memory]: VoiceConnectionMemory;

    /**
     * The local address of this voice connection.
     */
    readonly localAddress: Address;

    /**
     * The transport for this voice connection.
     */
    readonly transport: VoiceTransport;

    /**
     * The current SSRC of this voice connection.
     */
    readonly ssrc: number;

    /**
     * The gateway for this voice connection.
     */
    get gateway(): VoiceGateway;
}

/**
 * Creates a new voice connection with the supplied {@link settings}.
 * 
 * @param settings the settings to use for the voice connection.
 * @returns the new voice connection.
 */
async function create(gateway: VoiceGateway, settings: VoiceConnectionSettings): Promise<Nullable<VoiceConnection>> {
    const memory: VoiceConnectionMemory = {
        settings,
        secretKey: null,
        frames: readable()
    }

    const transport = transports.create(settings.server);
    return {
        transport,
        gateway,
        localAddress: await transports.holepunch(transport, settings.ssrc),
        [k_memory]: memory,
        get ssrc() {
            return memory.settings.ssrc;
        }
    }
}

function suite(connection: VoiceConnection): Promise<CryptoSuite> {
    return createSuite(
        connection[k_memory].secretKey!,
        connection[k_memory].settings.mode
    )
}

/**
 * Create a new writable stream for the supplied {@link connection} to write to.
 * 
 * @param connection the voice connection to provide the stream to.
 */
async function provide(connection: VoiceConnection, source: ReadableStream<Frame>) {
    await source.pipeTo(readableToWritableStream(connection[k_memory].frames))
}

/**
 * Instructs the supplied {@link connection} to use the specified secret key.
 * 
 * @param connection The voice connection to use the secret key on.
 * @param key        The secret key to use.
 * @returns The voice connection.
 */
export async function useSecretKey(connection: VoiceConnection, key: Uint8Array): Promise<VoiceConnection> {
    connection[k_memory].secretKey = key;

    /* create crypto suite. */
    const suite = await createSuite(
        connection[k_memory].secretKey!,
        connection[k_memory].settings.mode
    )

    /* pipe frames to voice transport */
    connection[k_memory].frames.stream
        .pipeThrough(createOpusTransform())
        .pipeThrough(createFrameSender(connection))
        .pipeThrough(createPacketProvider(connection.ssrc, suite))
        .pipeTo(transports.writable(connection.transport));

    return connection;
}

export function updateSpeaking(connection: VoiceConnection, speaking: boolean): VoiceConnection {
    VoiceGateways.send(connection.gateway, {
        op: v4.VoiceOpcodes.Speaking,
        d: {
            delay: 0,
            speaking: speaking ? 1 : 0,
            ssrc: connection.ssrc
        }
    });

    return connection
}

export default { create, provide, suite }
