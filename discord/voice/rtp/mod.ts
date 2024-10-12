import { streams, writers } from "../../../tools/mod.ts";
import packet, { type RtpPacket } from "./packet.ts";
import header, { type RtpHeader, RTP_HEADER_SIZE } from "./header.ts";

/**
 * Creates a transform stream that transforms RTP packets to RTP datagrams.
 * 
 * @returns the transform stream.
 */
function transform(): TransformStream<RtpPacket, Uint8Array> {
    const buffer = new Uint8Array(2048), writer = writers.create(buffer);

    return streams.map(rtp => {
        /* reset the writer position and  */
        writer.position = 0;
        packet.write(rtp, writer);

        /* return the written RTP packet */
        return buffer.slice(0, writer.position)
    });
}

export { RTP_HEADER_SIZE, type RtpPacket, type RtpHeader }
export default { header, packet, transform }
