import { toTransformStream } from "../../../tools/mod.ts";
import { updateSpeaking, VoiceConnection } from "../connections.ts";
import { delay } from "../deps.ts";
import gateway from "../gateway/gateway.ts";
import type { Frame } from "./types.ts";

const silentFrame = new Uint8Array([0xFC, 0xFF, 0xFE]);

export function createFrameSender(connection: VoiceConnection): TransformStream<Frame, Uint8Array> {
    // const frames = readable<Uint8Array>();
    // return {
    //     readable: frames.stream,
    //     writable: new WritableStream({

    //     })
    // }

    return toTransformStream(async function* transform(src) {
        let next = performance.now(), speaking = false, silence = 5, position = 0;
        function setSpeaking(state: boolean) {
            gateway.emitDebug(connection.gateway, "frame/sender", `setting speaking state: ${state}`);
            if (state) {
                silence = 5;
            }

            speaking = state;
            updateSpeaking(connection, state);
        }

        const xd = performance.now();
        try {
            for await (let frame of src) {
                /* handle speaking state. */
                if (frame != null && !speaking) {
                    setSpeaking(true);
                } else if ((frame == null) && speaking && silence == 0) {
                    setSpeaking(false);
                }
    
                /* if there are more silent frames to be sent make sure the frame is not null. */
                if (frame == null && silence > 0) {
                    frame = silentFrame;
                    silence--
                }
    
                if (frame != null) {
                    position += 20;
                    yield frame;
                }
    
                /* queue the next frame timestamp. */
                next += 20;
                await delay(Math.max(0, next - (performance.now() - xd)))
            }
        } catch (ex) {
            console.log(ex);
        }

        setSpeaking(false);
        gateway.emitDebug(connection.gateway, "frame/sender", "stopping...");
    })
}
