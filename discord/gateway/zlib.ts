import { ModernError, zlib } from "../deps.ts";

const ZLIB_SUFFIX = new Uint8Array([0x00, 0x00, 0xff, 0xff]);

export const DecompressError = ModernError.subclass("DecompressError");

export type Decompress = (data: Uint8Array) => void;

export interface DecompressorEvents {
    data: (data: Uint8Array) => void;
    error: (error: Error) => void;
}

export function createDecompressor(events: DecompressorEvents): Decompress {
    const inflate = new zlib.Inflate({ windowBits: 128 * 1024 });
    return data => {
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
    }
}
