import * as endianess from "./endianess.ts";

/**
 * A {@link Uint8Array} reader.
 */
export interface ByteReader {
    /**
     * The current position of the reader.
     */
    get position(): number;

    /**
     * Sets the current position to the given {@link value}.
     */
    set position(value: number);

    /**
     * The underlying buffer that is being read from.
     */
    data: Uint8Array;
}

/**
 * Creates a new {@link ByteReader} with the supplied {@link data} as the underlying buffer.
 * 
 * @param data the data to use as the underlying buffer.
 * @returns the new reader.
 */
export function create(data: Uint8Array): ByteReader {
    return { data, position: 0 };
}

/**
 * Returns the number of bytes remaining to be read.
 * 
 * @param reader the reader.
 * @returns the number of bytes remaining to be read.
 */
export function remaining(reader: ByteReader): number {
    return reader.data.length - reader.position;
}

/**
 * Reads a single byte from the supplied {@link reader}.
 * 
 * @param reader the reader to read from.
 * @returns the byte that was read.
 */
export function readByte(reader: ByteReader): number {
    return reader.data[reader.position++];
}

/**
 * Reads {@link count} bytes from the supplied {@link reader}.
 * 
 * @param reader the reader to read from.
 * @param count the number of bytes to read.
 * @returns the bytes that were read.
 */
export function readBytes(reader: ByteReader, count: number = reader.data.length - reader.position): Uint8Array {
    const result = reader.data.slice(reader.position, reader.position + count);
    reader.position += count;

    return result;
}

/**
 * Reads a 16-bit unsigned integer from the supplied {@link reader}.
 * 
 * @param reader the reader to read from.
 * @returns the 16-bit unsigned integer that was read.
 */
export function readUInt16BE(reader: ByteReader): number {
    requireBytes(reader, 2);

    const value = endianess.readUInt16BE(reader.data, reader.position);
    reader.position += 2;

    return value;
}

/**
 * Reads a 32-bit unsigned integer from the supplied {@link reader}.
 * 
 * @param reader the reader to read from.
 * @returns the 32-bit unsigned integer that was read.
 */
export function readUInt32BE(reader: ByteReader): number {
    requireBytes(reader, 4);

    const value = endianess.readUInt32BE(reader.data, reader.position);
    reader.position += 4;

    return value;
}

/**
 * Resizes the supplied {@link reader} to the supplied {@link start} and {@link end} offsets.
 * 
 * @param reader the reader to resize.
 * @param start the start offset.
 * @param end the end offset.
 * @returns `true` if the reader was resized, `false` otherwise.
 */
export function resize(reader: ByteReader, start = 0, end = reader.data.length): boolean {
    if (start >= 0 && end <= reader.data.length) {
        // reader.position = start;
        reader.data = reader.data.slice(start, end);
        return true;
    }

    return false;
}

/**
 * Throws an error if the supplied {@link reader} cannot read {@link count} bytes.
 */
export function requireBytes(reader: ByteReader, count: number) {
    if (remaining(reader) < count) throw new Error("Not enough bytes remaining.");
}
