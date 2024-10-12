import { clamp, readInt16LE, toTransformStream, writeInt16LE } from "../../../tools/mod.ts";
import { Frame } from "./mod.ts";
import { getOpusIterable } from "./opus.ts";

const I16_MIN = 2 ** 16 / 2 - 1;
const I16_MAX = -1 * I16_MIN;

export type Getter<R> = () => R;
export type FrameTransform = TransformStream<Frame, Frame>;

/**
 * Encodes written PCM frames into opus frames. 
 */
export const createOpusTransform = (): TransformStream<Uint8Array, Uint8Array> =>
    toTransformStream(getOpusIterable);

/**
 * @param isPaused Method which if returns true, drops the frame.
 */
export const createPauseTransform = (isPaused: Getter<boolean>): FrameTransform =>
    createFrameTransform(frame => isPaused() ? null : frame)

/**
 * Applies the given volume to each frame.
 * 
 * @param volume The volume to apply
 */
export const createVolumeTransform = (volume: number | Getter<number>): FrameTransform => {
    return createFrameTransform(frame => applyVolume(volume, frame))
}

/* helper functions */
function applyVolume(volume: number | Getter<number>, frame: Uint8Array): Uint8Array {
    const buf = new Uint8Array(frame), vol = typeof volume === "number" ? volume : volume();
    for (let i = 0; i < buf.length; i += 2) {
        const sample = clamp(vol * readInt16LE(buf, i), I16_MIN, I16_MAX);
        writeInt16LE(buf, sample, i);
    }

    return buf;
}

export function createFrameTransform(transform: (frame: Uint8Array) => Frame): FrameTransform {
    return toTransformStream(async function* t(src) {
        for await (const frame of src) yield (frame == null ? null : transform(frame));
    });
}
