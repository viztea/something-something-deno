export type Endianess = "big" | "little";

/* uint 32 */
export function readUInt32BE(bytes: Uint8Array, offset = 0): number {
    return (
        bytes[offset + 3]       | 
        bytes[offset + 2] <<  8 | 
        bytes[offset + 1] << 16 | 
        bytes[offset + 0] << 24
    );
}

export function writeUInt32BE(bytes: Uint8Array, value: number, offset = 0) {
    bytes[offset + 0] = (value >> 24)
    bytes[offset + 1] = (value >> 16) & 0xFF
    bytes[offset + 2] = (value >>  8) & 0xFF
    bytes[offset + 3] = (value      )
}

/* uint 16 */
export function readUInt16BE(bytes: Uint8Array, offset = 0): number {
    return bytes[offset + 1] | bytes[offset + 0] << 8;
}


export function readInt16LE(bytes: Uint8Array, offset = 0) {
    return ((bytes[offset + 0] | bytes[offset + 1] << 8) << 16) >> 16;
}


export function writeInt16LE(bytes: Uint8Array, value: number, offset = 0) {
    bytes[offset + 0] = (value      ) & 0xFF
    bytes[offset + 1] = (value >>  8);
}
