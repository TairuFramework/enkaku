import { defer } from '@enkaku/async'

export function writeTo<T>(
  write: UnderlyingSinkWriteCallback<T>,
  close?: UnderlyingSinkCloseCallback,
  abort?: UnderlyingSinkAbortCallback,
): WritableStream<T> {
  return new WritableStream<T>({ write, close, abort })
}

export function createArraySink<T>(): [WritableStream<T>, Promise<Array<T>>] {
  const done = defer<Array<T>>()
  const result: Array<T> = []
  const stream = new WritableStream<T>({
    write: (value) => {
      result.push(value)
    },
    close: () => done.resolve(result),
    abort: (reason) => done.reject(reason),
  })
  return [stream, done.promise]
}
