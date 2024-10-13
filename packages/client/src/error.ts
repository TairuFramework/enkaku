import type { ErrorObject, ErrorReplyPayload } from '@enkaku/protocol'

export type RequestErrorParams<
  Code extends string = string,
  Data extends Record<string, unknown> = Record<string, unknown>,
> = ErrorOptions & ErrorObject<Code, Data>

export class RequestError<
    Code extends string = string,
    Data extends Record<string, unknown> = Record<string, unknown>,
  >
  extends Error
  implements ErrorObject<Code, Data>
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
}