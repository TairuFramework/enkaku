import { defer } from '@enkaku/async'

export function createArraySink<T>(): [WritableStream<T>, Promise<Array<T>>] {
  const done = defer<Array<T>>()
  const result: Array<T> = []
  const stream = new WritableStream<T>({
    write(value) {
      result.push(value)
    },
    close() {
      done.resolve(result)
    },
  })
  return [stream, done.promise]
}
