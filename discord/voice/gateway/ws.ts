import { mergeReadableStreams, readable, readableToWritableStream, streams } from "../../../tools/mod.ts";
import { JsonParseStream, v4, ws } from "../deps.ts";

export enum SocketEventType {
    Payload,
    Close
}

type createSocketEvent<Type extends SocketEventType, D extends Record<string, unknown>> = { type: Type } & D;

export type SocketEvent = SocketCloseEvent | SocketPayloadEvent;
export type SocketPayloadEvent = createSocketEvent<SocketEventType.Payload, { data: v4.VoiceReceivePayload }>;
export type SocketCloseEvent   = createSocketEvent<SocketEventType.Close, { code: number, reason?: string }>;

function payloadTransform(): TransformStream<string, v4.VoiceReceivePayload> {
    return new JsonParseStream() as unknown as TransformStream<string, v4.VoiceReceivePayload>;
}

export function payloadToEventTransform(): TransformStream<v4.VoiceReceivePayload, SocketPayloadEvent> {
    return streams.map(data => ({ type: SocketEventType.Payload, data }));
}

export function messageTransform(): TransformStream<string | Uint8Array, v4.VoiceReceivePayload> {
    const payloads = readable<string>(), decoderStream = new TextDecoderStream(), decoderStreamWriter = decoderStream.writable.getWriter();
    return {
        readable: mergeReadableStreams(decoderStream.readable, payloads.stream).pipeThrough(payloadTransform()),
        writable: new WritableStream({
            write: data => {
                typeof data === "string" ? payloads.controller.enqueue(data) : decoderStreamWriter.write(data);
            }
        })
    }
}

export function pogSocketEventTransform(): TransformStream<ws.PogSocketEvent, SocketEvent> {
    const payloads = readable<string>(), events = readable<SocketEvent>()
        , decoderStream = new TextDecoderStream(), decoderStreamWriter = decoderStream.writable.getWriter();

    mergeReadableStreams(payloads.stream, decoderStream.readable)
        .pipeThrough(payloadTransform())
        .pipeThrough(payloadToEventTransform())
        .pipeTo(readableToWritableStream(events));

    return {
        readable: events.stream,
        writable: new WritableStream({
            write: event => {
                switch (event.type) {
                    case "message": {
                        typeof event.data === "string" ? payloads.controller.enqueue(event.data) : decoderStreamWriter.write(event.data);
                        break
                    }

                    case "close": {
                        events.controller.enqueue({ type: SocketEventType.Close, code: event.code, reason: event.reason });
                        /* close events stream because the socket has closed. */
                        events.controller.close();
                        break;
                    }
                }
            }
        })
    }
}
