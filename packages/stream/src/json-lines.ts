import { map } from './map.js'

const SEPARATOR = '\n'

const decoder = new TextDecoder()

export type DecodeJSON<T = unknown> = (value: string) => T

export function fromJSONLines<T = unknown>(
  decode: DecodeJSON<T> = JSON.parse,
): TransformStream<Uint8Array | string, T> {
  let buffered = ''
  return new TransformStream<Uint8Array | string, T>({
    transform: (chunk, controller) => {
      buffered += typeof chunk === 'string' ? chunk : decoder.decode(chunk)
      let index = buffered.indexOf(SEPARATOR)
      while (index !== -1) {
        const value = buffered.slice(0, index).trim()
        if (value !== '') {
          controller.enqueue(decode(value))
        }
        buffered = buffered.slice(index + SEPARATOR.length)
        index = buffered.indexOf(SEPARATOR)
      }
    },
  })
}

export type EncodeJSON<T = unknown> = (value: T) => string

export function toJSONLines<T = unknown>(
  encode: EncodeJSON<T> = JSON.stringify,
): TransformStream<T, string> {
  return map((value) => encode(value) + SEPARATOR)
}
