import { defer } from '@enkaku/async'

export function writeTo<T>(
  write: UnderlyingSinkWriteCallback<T>,
  close?: UnderlyingSinkCloseCallback,
): WritableStream<T> {
  return new WritableStream<T>({ write, close })
}

export function createArraySink<T>(): [WritableStream<T>, Promise<Array<T>>] {
  const done = defer<Array<T>>()
  const result: Array<T> = []
  const stream = writeTo<T>(
    (value) => {
      result.push(value)
    },
    () => done.resolve(result),
  )
  return [stream, done.promise]
}
