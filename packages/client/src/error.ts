import type { ErrorObject, OptionalRecord } from '@enkaku/protocol'

export type RequestErrorParams<
  Code extends string = string,
  Data extends OptionalRecord = OptionalRecord,
> = ErrorOptions & ErrorObject<Code, Data>

export class RequestError<
    Code extends string = string,
    Data extends OptionalRecord = OptionalRecord,
  >
  extends Error
  implements ErrorObject<Code, Data>
{
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
