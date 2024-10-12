import { readers, writers } from "../../../tools/mod.ts";
import rtpHeader, { RtpHeader, RTP_HEADER_SIZE } from "./header.ts";

export interface RtpPacket {
    /**
     * The header of this packet.
     */
    readonly header:       RtpHeader;

    /**
     * The body of this packet.
     */
    readonly body:         Uint8Array;

    /**
     * The number of padding bytes added to this packet.
     */
    readonly paddingBytes: number;
}

/**
 * Creates a new RTP packet.
 * 
 * @param header       The RTP header.
 * @param body         The RTP body.
 * @param paddingBytes The number of padding bytes to add to the packet.
 * @returns the new RTP packet.
 */

function create(header: RtpHeader, body: Uint8Array, paddingBytes = 0): RtpPacket {
    return { header, body, paddingBytes };
}

/**
 * Writes the given RTP packet to the given writer.
 * 
 * @param packet The packet to write.
 * @param writer Where to write the packet to.
 */
function write(packet: RtpPacket, writer: writers.ByteWriter) {
    /* write the rtp header */
    rtpHeader.write(packet.header, writer);

    /* write the rtp body */
    writers.writeBytes(writer, packet.body);
    if (packet.paddingBytes != 0) {
        const padding = new Uint8Array(packet.paddingBytes - 1);
        writers.writeBytes(writer, padding)
        writers.writeByte(writer, packet.paddingBytes)
    }
}

/**
 * Reads an RTP packet from the given reader.
 * 
 * @param reader The reader to read the RTP packet from.
 * @returns the RTP packet.
 */
function read(reader: readers.ByteReader): RtpPacket {
    const header = rtpHeader.read(reader)
        , payload = readers.readBytes(reader)
        , paddingBytes = header.hasPadding ? payload[payload.length - 1] : 0;

    const body = header.hasPadding
        ? payload.slice(0, payload.length - paddingBytes)
        : payload;
    
    return { header, body, paddingBytes }
}

function calculateSize(packet: RtpPacket): number {
    return RTP_HEADER_SIZE + packet.body.length + packet.paddingBytes + (packet.header.csrcCount * 4);
}

export default { create, write, read, calculateSize }
