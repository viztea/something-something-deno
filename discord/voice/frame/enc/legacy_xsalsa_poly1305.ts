import { randomBytes, writers } from "../../../../tools/mod.ts";
import { sodium } from "../../deps.ts";
import { CryptoSuite } from "./legacy_suite.ts";
import rtp, { type RtpHeader } from "../../rtp/mod.ts";

export enum NonceStrategyType {
    Normal,
    Suffix,
    Lite
}

export const NONCE_LENGTH = 24;

export async function create(secretKey: Uint8Array, nonceStrategy: NonceStrategy): Promise<CryptoSuite> {
    await sodium.ready;
    const nonceWriter = writers.create(NONCE_LENGTH);
    return {
        name: getSuiteName(nonceStrategy.type),
        encrypt: (writer: writers.ByteWriter, header: RtpHeader, payload: Uint8Array) => {
            /* reset the nonce cursor and generate a new nonce. */
            writers.reset(nonceWriter);
            nonceStrategy.generate(nonceWriter, header);

            /* encrypt the payload. */
            const encrypted = sodium.crypto_secretbox_easy(payload, nonceWriter.data, secretKey);
            writers.writeBytes(writer, encrypted);

            /* append the nonce to the cursor */
            nonceStrategy.append(writer, nonceWriter.data);
        },
        decrypt: () => {
            throw new Error("Not Implemented Yet");
        },
        nextSequence: seq => seq + 1
    }
}

function getSuiteName(nonceStrategy: NonceStrategyType): string {
    const base = "xsalsa20_poly1305";
    return nonceStrategy === NonceStrategyType.Normal
        ? base
        : `${base}_${NonceStrategyType[nonceStrategy].toLowerCase()}`;
}

export function createNormalNonceStrategy(): NonceStrategy {
    return {
        type: NonceStrategyType.Normal,
        generate: (writer, header) => rtp.header.write(header, writer),
        append: () => void 0,
    }
}

export function createSuffixNonceStrategy(): NonceStrategy {
    return {
        type: NonceStrategyType.Suffix,
        generate: writer => writers.writeBytes(writer, randomBytes(NONCE_LENGTH)),
        append: (writer, nonce) => writers.writeBytes(writer, nonce),
    }
}

export function createLiteNonceStrategy(): NonceStrategy {
    let seq = 0;
    return {
        type: NonceStrategyType.Normal,
        generate: writer => writers.writeUInt32(writer, ++seq, "little"),
        append: writer => writers.writeUInt32(writer, seq, "little"),
    }
}

interface NonceStrategy {
    type: NonceStrategyType;

    generate(cursor: writers.ByteWriter, header: RtpHeader): void;
    append(cursor: writers.ByteWriter, nonce: Uint8Array): void;
}
