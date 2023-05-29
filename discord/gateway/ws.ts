import { readable, streams, readableToWritableStream } from "../../tools/mod.ts";
import { JsonParseStream, v10, ws } from "./deps.ts";
import { decompressor } from "./zlib.ts";
import { decoder } from "https://deno.land/x/pogsocket@2.0.0/encoding.ts";
import { ShardMemory } from "./shard_impl.ts";

const decode = decoder();

export enum SocketEventType {
    Payload,
    Close
}

type createSocketEvent<Type extends SocketEventType, D extends Record<string, unknown>> = { type: Type } & D;

export type SocketEvent = SocketCloseEvent | SocketPayloadEvent;
export type SocketPayloadEvent = createSocketEvent<SocketEventType.Payload, { data: v10.GatewayReceivePayload }>;
export type SocketCloseEvent   = createSocketEvent<SocketEventType.Close, { code: number, reason?: string }>;

function payloadTransform(): TransformStream<string, v10.GatewayReceivePayload> {
    return new JsonParseStream() as unknown as TransformStream<string, v10.GatewayReceivePayload>;
}

export function payloadToEventTransform(): TransformStream<v10.GatewayReceivePayload, SocketPayloadEvent> {
    return streams.map(data => ({ type: SocketEventType.Payload, data }));
}

export function pogSocketEventTransform(memory: ShardMemory): TransformStream<ws.PogSocketEvent, SocketEvent> {
    const payloads = readable<string>(), events = readable<SocketEvent>(), decompress = decompressor(
        memory.connect!.compression,
        {
            data: data => payloads.controller.enqueue(decode(data)),
            error: memory.settings.events?.error
        }
    );

    payloads.stream
        .pipeThrough(payloadTransform())
        .pipeThrough(payloadToEventTransform())
        .pipeTo(readableToWritableStream(events));

    return {
        readable: events.stream,
        writable: new WritableStream({
            write: event => {
                switch (event.type) {
                    case "message": {
                        typeof event.data === "string" ? payloads.controller.enqueue(event.data) : decompress(event.data);
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
