import type { OptionalRecord } from './utils.js'

export type ErrorObject<
  Code extends string = string,
  Data extends OptionalRecord = OptionalRecord,
> = {
  code: Code
  message: string
  data: Data
}
