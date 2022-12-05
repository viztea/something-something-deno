export function createReadableStream<T>(): { stream: ReadableStream<T>, controller: ReadableStreamDefaultController<T> } {
    let controller: ReadableStreamDefaultController<T>;

    const stream = new ReadableStream<T>({
        start: ctr => void (controller = ctr)
    });

    // @ts-expect-error: controller is assigned 
    return { stream, controller }
}
