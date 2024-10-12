import type { writers } from "../../../../tools/mod.ts";
import { v4 } from "../../deps.ts";
import type { RtpHeader } from "../../rtp/mod.ts";
import { create, createLiteNonceStrategy, createNormalNonceStrategy, createSuffixNonceStrategy } from "./legacy_xsalsa_poly1305.ts";

export interface ICryptoStrategy {
    name: string;
}

export interface EncryptionStrategy extends ICryptoStrategy {
    encrypt(cursor: writers.ByteWriter, header: RtpHeader, payload: Uint8Array): void;

    nextSequence(previous: number): number;
}

export interface DecryptionStrategy extends ICryptoStrategy {
    decrypt(cursor: writers.ByteWriter, header: RtpHeader, payload: Uint8Array): void;
}

export type CryptoSuite = EncryptionStrategy & DecryptionStrategy;

export function createSuite(key: Uint8Array, mode: v4.VoiceEncryptionMode): Promise<CryptoSuite> {
    switch (mode) {
        case "xsalsa20_poly1305":        return create(key, createNormalNonceStrategy());
        case "xsalsa20_poly1305_lite":   return create(key, createLiteNonceStrategy());
        case "xsalsa20_poly1305_suffix": return create(key, createSuffixNonceStrategy());
        default: throw new Error("Unsupported Encryption Mode: " + mode);
    }
}
