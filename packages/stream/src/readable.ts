/**
 * Create a tuple of [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) and associated [ReadableStreamDefaultController](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController).
 */
export function createReadable<T>(
  cancel?: (reason?: unknown) => void,
): [ReadableStream<T>, ReadableStreamDefaultController<T>] {
  let controller: ReadableStreamDefaultController<T> | undefined
  const stream = new ReadableStream<T>({
    start(ctrl) {
      controller = ctrl
    },
    cancel,
  })
  return [stream, controller as ReadableStreamDefaultController<T>]
}
