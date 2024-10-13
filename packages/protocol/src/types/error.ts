export type ErrorObject<
  Code extends string = string,
  Data extends Record<string, unknown> = Record<string, unknown>,
> = {
  code: Code
  data: Data
  message: string
}
