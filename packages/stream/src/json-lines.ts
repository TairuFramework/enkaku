import { map, transform } from './transform.js'

const SEPARATOR = '\n'

const decoder = new TextDecoder()

export class JSONLinesError extends Error {}

export type DecodeJSON<T = unknown> = (value: string) => T

export type FromJSONLinesOptions<T = unknown> = {
  decode?: DecodeJSON<unknown>
  maxBufferSize?: number
  maxMessageSize?: number
  onInvalidJSON?: (value: string, controller: TransformStreamDefaultController<T>) => void
}

export function fromJSONLines<T = unknown>(
  options: FromJSONLinesOptions<T> = {},
): TransformStream<Uint8Array | string, T> {
  const { decode = JSON.parse, maxBufferSize, maxMessageSize, onInvalidJSON } = options

  let input = ''
  let output: Array<string> = []
  let nestingDepth = 0
  let isInString = false
  let isEscapingChar = false

  function processChar(char: string): void {
    if (isInString) {
      if (char === '\\') {
        isEscapingChar = !isEscapingChar
      } else {
        if (char === '"' && !isEscapingChar) {
          isInString = false
        }
        isEscapingChar = false
      }
      output.push(char)
    } else {
      switch (char) {
        case '"':
          isInString = true
          output.push(char)
          break
        case '{':
        case '[':
          nestingDepth++
          output.push(char)
          break
        case '}':
        case ']':
          nestingDepth--
          output.push(char)
          break
        default:
          // Ignore whitespace using charCode comparison instead of regex
          if (char.charCodeAt(0) > 32) {
            output.push(char)
          }
      }
    }
  }

  function checkOutputSize(): void {
    if (maxMessageSize != null && output.length > maxMessageSize) {
      throw new JSONLinesError(
        `Message size ${output.length} exceeds maximum message size of ${maxMessageSize}`,
      )
    }
  }

  return transform<Uint8Array | string, T>(
    (chunk, controller) => {
      try {
        input += typeof chunk === 'string' ? chunk : decoder.decode(chunk)
        if (maxBufferSize != null && input.length > maxBufferSize) {
          throw new JSONLinesError(
            `Buffer size ${input.length} exceeds maximum buffer size of ${maxBufferSize}`,
          )
        }
        let newLineIndex = input.indexOf(SEPARATOR)
        while (newLineIndex !== -1) {
          for (const char of input.slice(0, newLineIndex)) {
            processChar(char)
          }
          if (nestingDepth === 0 && !isInString && output.length > 0) {
            checkOutputSize()
            try {
              controller.enqueue(decode(output.join('')))
            } catch {
              onInvalidJSON?.(output.join(''), controller)
            }
            output = []
          } else if (isInString) {
            // If we're in a string, we need to keep the newline in the output
            output.push('\\n')
          }
          input = input.slice(newLineIndex + SEPARATOR.length)
          newLineIndex = input.indexOf(SEPARATOR)
        }
      } catch (cause) {
        if (cause instanceof JSONLinesError) {
          throw cause
        }
        controller.error(new JSONLinesError('Error processing chunk', { cause }))
      }
    },
    (controller) => {
      for (const char of input) {
        processChar(char)
      }
      if (nestingDepth === 0 && !isInString && output.length > 0) {
        checkOutputSize()
        try {
          controller.enqueue(decode(output.join('')))
        } catch {
          onInvalidJSON?.(output.join(''), controller)
        }
      }
    },
  )
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
