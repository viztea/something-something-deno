import { inflate } from "../deps.ts";
import { ShardCompression } from "./shard.ts";

export type Decompress = (data: Uint8Array) => void;

export interface DecompressorEvents {
    data: (data: Uint8Array) => void;
    error?: (error: Error) => void;
}

export function decompressor(type: ShardCompression, events: DecompressorEvents): Decompress {
    let decompress: Decompress;
    if (type === ShardCompression.Payload) {
        decompress = data => {
            let decompressed: Uint8Array;
            try {
                decompressed = inflate(data);
            } catch (cause) {
                const error = new Error("Unable to decompress data: " + cause);
                return events.error?.(error);
            }

            events.data(decompressed);
        }
    } else {
        /* const inflate = new zlib.Inflate({ windowBits: 128 * 1024 });
        decompress = data => {
            let flushing = true;

            const suffix = data.slice(data.length - 4, data.length);
            for (let pos = 0; pos < suffix.length; pos++) {
                if (suffix[pos] !== ZLIB_SUFFIX[pos]) {
                    flushing = false;
                    break;
                }
            }

            inflate.push(data, flushing ? 2 : 0);
            if (!flushing) {
                return;
            }

            if (inflate.err) {
                const error = new DecompressError("Unable to decompress data", {
                    cause: `${inflate.err}: ${inflate.msg}`
                });

                return events.error(error);
            }

            if (typeof inflate.result !== "string") {
                events.data(inflate.result);
            }
        } */
        decompress = data => events.data(data);
    }

    return decompress;
}
