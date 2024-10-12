import { streams, writers } from "../../../tools/mod.ts";
import rtp, { type RtpHeader } from "../rtp/mod.ts";
import { EncryptionStrategy } from "./enc/legacy_suite.ts";

export function createPacketProvider(
    ssrc: number,
    encryptionStrategy: EncryptionStrategy
): TransformStream<Uint8Array, Uint8Array> {
    const writer = writers.create(2048);

    let sequence = 0, timestamp = 0;
    function getRtpHeader(): RtpHeader {
        const ts = timestamp;
        timestamp += 960;

        return rtp.header.create(
            ts,
            sequence = encryptionStrategy.nextSequence(sequence),
            ssrc,
        );
    }

    return streams.map(frame => {
        writers.reset(writer);
        writer.data.fill(0)

        /* write the rtp header to the byte cursor */
        const header = getRtpHeader();
        rtp.header.write(header, writer);

        /* encrypt the packet. */
        encryptionStrategy.encrypt(writer, header, frame)
        return writers.slice(writer);
    });
}
