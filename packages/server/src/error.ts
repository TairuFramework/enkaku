import type { ErrorReplyPayload } from '@enkaku/protocol'

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

export type InvocationRejectedErrorParams = {
  code: string
  message: string
  cause?: unknown
}

export class InvocationRejectedError extends Error {
  #code: string

  constructor(params: InvocationRejectedErrorParams) {
    super(params.message, { cause: params.cause })
    this.#code = params.code
  }

  get code(): string {
    return this.#code
  }
}
