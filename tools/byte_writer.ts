import { Endianess } from "./endianess.ts";

export interface ByteWriter {
    /**
     * The current position of the cursor.
     */
    get position(): number;

    /**
     * Sets the current position to the given {@link value offset}.
     * Warning: this may cause data to be overwritten.
     *
     * @param {number} value the value to set the position to.
     */
    set position(value: number);

    /**
     * The endianess of the writer.
     */
    readonly endianess: Endianess;

    /**
     * The underlying buffer.
     */
    data: Uint8Array;
}

/**
 * Creates a new {@link ByteWriter} with an underlying buffer of the supplied {@link size}.
 * @param size
 * @param endianess
 * @returns the new writer.
 */
export function create(size: number, endianess?: Endianess): ByteWriter

/**
 * Creates a new {@link ByteWriter} with the supplied {@link data} as the underlying buffer.
 * 
 * @param data the data to use as the underlying buffer.
 * @param endianess the endianess of the writer.
 * @returns the new writer.
 */
export function create(data: Uint8Array, endianess?: Endianess): ByteWriter

export function create(p0: Uint8Array | number, endianess: Endianess = "big"): ByteWriter {
    const data = typeof p0 === "number"
        ? new Uint8Array(p0)
        : p0;

    return { data, endianess, position: 0 };
}

/**
 * Returns `true` if the supplied {@link writer} is exhausted, `false` otherwise.
 * 
 * @param writer the writer to check.
 * @returns`true` if the supplied {@link writer} is exhausted, `false` otherwise.
 */
export function isExhausted(writer: ByteWriter): boolean {
    return writer.position === writer.data.length + 1;
}

export function ensureNotExhausted(writer: ByteWriter) {
    if (isExhausted(writer)) throw new Error("ByteWriter exhausted");
}

/**
 * Returns a slice of the underlying buffer of the supplied {@link writer}.
 * 
 * @param writer the writer to slice.
 * @param start the start index of the slice.
 * @param end the end index of the slice.
 * @returns a slice of the underlying buffer of the supplied {@link writer}.
 */
export function slice(writer: ByteWriter, start = 0, end = writer.position): Uint8Array {
    return writer.data.subarray(start, end);
}

/**
 * Resets the supplied {@link writer} to the beginning of the underlying buffer.
 * 
 * @param writer the writer to reset.
 * @returns the supplied {@link writer}.
 */
export function reset(writer: ByteWriter): ByteWriter {
    writer.position = 0;
    return writer
}

/**
 * Grows the underlying buffer of the supplied {@link writer} by the given {@link size}.
 * 
 * @param writer the writer to grow.
 * @param size the size to grow the underlying buffer by.
 * @returns `true` if the underlying buffer was grown, `false` otherwise.
 */
export function grow(writer: ByteWriter, size: number): boolean {
    return resize(writer, writer.position + size);
}

/**
 * Resizes the underlying buffer of the supplied {@link writer} to the given {@link size}.
 * 
 * @param writer the writer to resize.
 * @param size the size to resize the underlying buffer to.
 * @param ifSmaller if `true`, the underlying buffer will only be resized if it is smaller than the given {@link size}.
 * @returns `true` if the underlying buffer was resized, `false` otherwise.
 */
export function resize(writer: ByteWriter, size: number, ifSmaller = false): boolean {
    if (writer.data.length < size || ifSmaller) {
        const source = size < writer.data.length
            ? new Uint8Array(writer.data, writer.data.byteOffset, size)
            : writer.data;

        const newData = new Uint8Array(size);
        source.set(newData);
        writer.data = newData;

        return true;
    }

    return false;
}

/**
 * Writes the supplied {@link value} to the underlying buffer of the supplied {@link writer} at the current position.
 * 
 * @param writer the writer to write to.
 * @param value the value to write.
 */
export function writeByte(writer: ByteWriter, value: number): ByteWriter {
    ensureNotExhausted(writer);
    writer.data[writer.position++] = value;
    return writer;
}

/**
 * Copies the supplied byte array to the underlying buffer at the current position.
 * 
 * @param writer the writer to write to.
 * @param bytes the byte array to copy.
 * @returns the supplied {@link writer}.
 */
export function writeBytes(writer: ByteWriter, bytes: ArrayBufferLike | Array<number>): ByteWriter {
    if (Array.isArray(bytes)) {
        for (const byte of bytes) writeByte(writer, byte);
    } else if (bytes instanceof Uint8Array) {
        const source = new Uint8Array(bytes, bytes.byteOffset, bytes.length);
        writer.data.set(source, writer.position);
        advance(writer, source.length);
    } else {
        writeBytes(writer, new Uint8Array(bytes));
    }

    return writer;
}

/**
 * Writes the supplied value to the underlying buffer at the current position.
 *
 * @param value the 16-bit integer to write.
 * @returns the supplied {@link writer}.
 */
export function writeUInt16(writer: ByteWriter, value: number, endianess: Endianess = writer.endianess): ByteWriter {
    const bytes = [value & 0xff, value >> 8];
    return writeBytes(writer, endianess === "big" ? bytes.reverse() : bytes);
}

/**
 * Writes the supplied value to the underlying buffer at the current position.
 *
 * @param value the 32-bit integer to write.
 * @returns the supplied {@link writer}.
 */
export function writeUInt32(writer: ByteWriter, value: number, endianess: Endianess = writer.endianess): ByteWriter {
    const bytes = [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >> 24];
    return writeBytes(writer, endianess === "big" ? bytes.reverse() : bytes);
}

/**
 * Advances the position of the supplied {@link writer} by the given {@link count}.
 * 
 * @param writer the writer to advance.
 * @param count the number of bytes to advance by.
 * @returns the supplied {@link writer}.
 */
export function advance(writer: ByteWriter, count: number): ByteWriter {
    writer.position += count;
    return writer;
}

