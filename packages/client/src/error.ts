import type { ErrorReplyPayload } from '@enkaku/protocol'

export type ErrorObjectType<
  Code extends string = string,
  Data extends Record<string, unknown> = Record<string, unknown>,
> = {
  code: Code
  message: string
  data?: Data
}

export type RequestErrorParams<
  Code extends string = string,
  Data extends Record<string, unknown> = Record<string, unknown>,
> = ErrorOptions & ErrorObjectType<Code, Data>

export class RequestError<
    Code extends string = string,
    Data extends Record<string, unknown> = Record<string, unknown>,
  >
  extends Error
  implements ErrorObjectType<Code, Data>
{
  static fromPayload<
    Code extends string = string,
    Data extends Record<string, unknown> = Record<string, unknown>,
  >(payload: ErrorReplyPayload<Code, Data>): RequestError<Code, Data> {
    return new RequestError({
      code: payload.code,
      data: payload.data as Data,
      message: payload.msg,
    })
  }

  #code: Code
  #data: Data

  constructor(params: RequestErrorParams<Code, Data>) {
    const { code, data, message, ...options } = params
    super(message, options)
    this.#code = code
    this.#data = data as Data
  }

  get code(): Code {
    return this.#code
  }

  get data(): Data {
    return this.#data
  }

  toString() {
    return `[RequestError] code ${this.#code}: ${this.message}`
  }

  toJSON(): ErrorObjectType<Code, Data> {
    return { code: this.#code, data: this.#data, message: this.message }
  }
}

export class RequestTimeoutError extends RequestError<
  'RequestTimeout',
  { procedure: string; timeoutMs: number }
> {
  constructor(procedure: string, timeoutMs: number) {
    super({
      code: 'RequestTimeout',
      data: { procedure, timeoutMs },
      message: `Request '${procedure}' timed out after ${timeoutMs}ms`,
    })
    this.name = 'RequestTimeoutError'
  }
}
