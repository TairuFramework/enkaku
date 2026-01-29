import type { ErrorReplyPayload } from '@enkaku/protocol'

/**
 * Error codes:
 * - EK01: Handler execution failed
 * - EK02: Access denied (authorization failure)
 * - EK03: Server controller limit reached
 * - EK04: Server handler concurrency limit reached
 * - EK05: Request timeout (controller expired)
 * - EK06: Message exceeds maximum size
 */

export type HandlerErrorParams<
  Code extends string = string,
  Data extends Record<string, unknown> = Record<string, unknown>,
> = {
  cause?: unknown
  code: Code
  data?: Data
  message?: string
}

export class HandlerError<
  Code extends string,
  Data extends Record<string, unknown> = Record<string, unknown>,
> extends Error {
  static from<Code extends string, Data extends Record<string, unknown> = Record<string, unknown>>(
    cause: unknown,
    params: HandlerErrorParams<Code, Data>,
  ): HandlerError<Code, Data> {
    return cause instanceof HandlerError
      ? cause
      : cause instanceof Error
        ? new HandlerError({ message: cause.message, ...params, cause })
        : new HandlerError({ message: 'Unknown error', ...params, cause })
  }

  #code: Code
  #data: Data

  constructor(params: HandlerErrorParams<Code, Data>) {
    const { cause, code, data, message } = params
    super(message ?? `Handler error code: ${code}`, { cause })
    this.#code = code
    this.#data = data ?? ({} as Data)
  }

  get code(): Code {
    return this.#code
  }

  get data(): Data {
    return this.#data
  }

  toPayload(rid: string): ErrorReplyPayload<Code, Data> {
    return {
      typ: 'error',
      rid,
      code: this.#code,
      data: this.#data,
      msg: this.message,
    } as ErrorReplyPayload<Code, Data>
  }
}
