import type { ErrorObject, OptionalRecord } from '@enkaku/protocol'

import { ErrorRejection, type ErrorRejectionOptions } from './rejections.js'

export type HandlerErrorParams<
  Code extends string = string,
  Data extends OptionalRecord = OptionalRecord,
  Info extends OptionalRecord = OptionalRecord,
> = Partial<ErrorRejectionOptions<Info>> & {
  code: Code
  data?: Data
  message?: string
}

export class HandlerError<
    Code extends string = string,
    Data extends OptionalRecord = OptionalRecord,
    Info extends OptionalRecord = OptionalRecord,
  >
  extends ErrorRejection<Info>
  implements ErrorObject<Code, Data>
{
  static from<
    Code extends string = string,
    Data extends OptionalRecord = OptionalRecord,
    Info extends OptionalRecord = OptionalRecord,
  >(cause: unknown, params: HandlerErrorParams<Code, Data, Info>): HandlerError<Code, Data, Info> {
    return cause instanceof HandlerError
      ? cause
      : cause instanceof Error
        ? new HandlerError({ message: cause.message, ...params, cause })
        : new HandlerError({ message: 'Unknown error', ...params, cause })
  }

  #code: Code
  #data: Data

  constructor(params: HandlerErrorParams<Code, Data, Info>) {
    const { code, data, message, ...options } = params
    super(message ?? `Handler error code: ${code}`, options as ErrorRejectionOptions<Info>)
    this.#code = code
    this.#data = data as Data
  }

  get code(): Code {
    return this.#code
  }

  get data(): Data {
    return this.#data
  }

  toJSON(): ErrorObject<Code, Data> {
    return {
      code: this.#code,
      data: this.#data,
      message: this.message,
    }
  }
}
