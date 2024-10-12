import { readers, uint16, uint32, writers } from "../../../tools/mod.ts";

export const RTP_HEADER_SIZE = 12;

export interface RtpHeader {
    sequence:  uint16;
    timestamp: uint32;
    ssrc:      uint32;

    version:         number;
    hasPadding:      boolean;
    hasExtension:    boolean;
    csrcCount:       number;
    csrcIdentifiers: number[];
    marker:          boolean;
    payloadType:     number;
}

function create(timestamp: number, sequence: number, ssrc: number): RtpHeader {
    return {
        version: 2,
        hasExtension: false,
        hasPadding: false,
        csrcCount: 0,
        marker: false,
        payloadType: 0x78,
        sequence,
        timestamp,
        ssrc,
        csrcIdentifiers: [],
    };
}

function write(header: RtpHeader, writer: writers.ByteWriter) {
    if (writer.data.length < RTP_HEADER_SIZE) {
        throw new Error(`Writer buffer is too short, must be (atleast) ${RTP_HEADER_SIZE} bytes`);
    }

    // 00
    const padding   = header.hasPadding   ? 0x20 : 0x00;
    const extension = header.hasExtension ? 0x10 : 0x00;
    writers.writeByte(writer, (header.version << 6) | padding | extension | (header.csrcCount & 0x0F));

    // 01
    const marker = header.marker          ? 0x80 : 0x00;
    writers.writeByte(writer, header.payloadType | marker);

    // 02 03
    writers.writeUInt16(writer, header.sequence);

    // 04 05 06 07
    writers.writeUInt32(writer, header.timestamp);

    // 08 09 10 11
    writers.writeUInt32(writer, header.ssrc);

    /* write constributing-source identifiers. */
    if (header.csrcCount === 0) {
        return;
    }

    const size = RTP_HEADER_SIZE + header.csrcCount * 2;
    if (writer.data.length < size) {
        throw new Error(`Writer buffer is too short, must be (at least) ${size} bytes long.`);
    }

    for (const identifier of header.csrcIdentifiers) {
        writers.writeUInt32(writer, identifier);
    }
}

function read(reader: readers.ByteReader): RtpHeader {
    if (reader.data.length < RTP_HEADER_SIZE) {
        throw new Error(`Reader contains too few bytes, must contain (atleast) ${RTP_HEADER_SIZE} bytes`);
    }

    const fb = readers.readByte(reader)
        , sb = readers.readByte(reader);

    / read the header bytes./
    const header: RtpHeader = {
        sequence:        readers.readUInt16BE(reader),
        timestamp:       readers.readUInt32BE(reader),
        ssrc:            readers.readUInt32BE(reader),

        version:        (fb & 0xC0) >> 6,
        hasPadding:     (fb & 0x20) === 0x20,
        hasExtension:   (fb & 0x10) === 0x10,
        csrcCount:       fb & 0x0F,
        marker:         (sb & 0x80) === 0x80,
        payloadType:     sb & 0x7F,
        csrcIdentifiers: [],
    };

    for (let i = 0; i < header.csrcCount; i++) {
        const csrcIdentifier = readers.readUInt32BE(reader);
        header.csrcIdentifiers.push(csrcIdentifier);
    }

    return header;
}

export default { create, read, write }
