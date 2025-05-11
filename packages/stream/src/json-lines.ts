import { map } from './map.js'

const SEPARATOR = '\n'

const decoder = new TextDecoder()

export class JSONLinesError extends Error {}

export type DecodeJSON<T = unknown> = (value: string) => T

function validateJSON(value: string): void {
  try {
    JSON.parse(value)
  } catch (error) {
    throw new JSONLinesError(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

export function fromJSONLines<T = unknown>(
  decode: DecodeJSON<T> = JSON.parse,
): TransformStream<Uint8Array | string, T> {
  let buffered = ''
  let lineNumber = 0

  return new TransformStream<Uint8Array | string, T>({
    transform: (chunk, controller) => {
      try {
        buffered += typeof chunk === 'string' ? chunk : decoder.decode(chunk)
        let index = buffered.indexOf(SEPARATOR)
        while (index !== -1) {
          lineNumber++
          const value = buffered.slice(0, index).trim()
          if (value !== '') {
            try {
              validateJSON(value)
              controller.enqueue(decode(value))
            } catch (cause) {
              controller.error(new JSONLinesError(`Error on line ${lineNumber}`, { cause }))
              return
            }
          }
          buffered = buffered.slice(index + SEPARATOR.length)
          index = buffered.indexOf(SEPARATOR)
        }
      } catch (cause) {
        controller.error(new JSONLinesError('Error processing chunk', { cause }))
      }
    },
    flush: (controller) => {
      try {
        const value = buffered.trim()
        if (value !== '') {
          lineNumber++
          try {
            validateJSON(value)
            controller.enqueue(decode(value))
          } catch (cause) {
            controller.error(new JSONLinesError(`Error on line ${lineNumber}`, { cause }))
          }
        }
      } catch (cause) {
        controller.error(new JSONLinesError('Error in final flush', { cause }))
      }
    },
  })
}

export type EncodeJSON<T = unknown> = (value: T) => string

function safeStringify<T>(value: T): string {
  try {
    const result = JSON.stringify(value)
    if (result === undefined) {
      throw new Error('JSON.stringify returned undefined')
    }
    return result
  } catch (error) {
    throw new JSONLinesError(
      `Failed to stringify value: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

export function toJSONLines<T = unknown>(
  encode: EncodeJSON<T> = safeStringify,
): TransformStream<T, string> {
  return map((value) => {
    try {
      return encode(value) + SEPARATOR
    } catch (cause) {
      throw cause instanceof JSONLinesError
        ? cause
        : new JSONLinesError('Error encoding value', { cause })
    }
  })
}
