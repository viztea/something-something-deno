import type { writers } from "../../../../tools/mod.ts";
import type { RtpHeader } from "../../rtp/mod.ts";

export interface EncryptionSuite {
    /**
     * 
     * @param writer  The writer to write the encrypted packet to.
     * @param header  The RTP header.
     * @param payload The RTP payload.
     */
    encrypt(writer: writers.ByteWriter, header: RtpHeader, payload: Uint8Array): void;

    /**
     * Get the next sequence number for this encryption suite.
     * 
     * @param previous The previous sequence number.
     * @returns the next sequence number.
     */
    sequence(previous: number): number;
}
