import { toTransformStream } from "https://deno.land/std@0.167.0/streams/to_transform_stream.ts";
import { Awaitable } from "./types.ts";

export interface Readable<T> {
    stream: ReadableStream<T>;
    controller: ReadableStreamDefaultController<T>;
}

export function readable<T>(): Readable<T> {
    let controller: ReadableStreamDefaultController<T>;

    const stream = new ReadableStream<T>({
        start: ctr => void (controller = ctr)
    });

    // @ts-expect-error: controller is assigned 
    return { stream, controller }
}

export function readableToWritableStream<T>(readable: Readable<T>): WritableStream<T> {
    return new WritableStream({ write: element => readable.controller.enqueue(element) });
}

export const streams = {
    tap: <T>(block: (element: T) => Awaitable<void>) => toTransformStream(
        async function* transform(src: ReadableStream<T>) {
            for await (const element of src) {
                await block(element);
                yield element;
            }
        }
    ),
    filter: <T>(block: (element: T) => Awaitable<boolean>) => toTransformStream(
        async function* transform(src: ReadableStream<T>) {
            for await (const element of src) if (await block(element)) yield element;
        }
    ),
    map: <I, O>(mapper: (element: I) => Awaitable<O>) => toTransformStream(
        async function* transform(src: ReadableStream<I>) {
            for await (const element of src) yield await mapper(element)
        }
    )
}
