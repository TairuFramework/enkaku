import type { FromSchema, JSONSchema } from 'json-schema-to-ts'

export type Schema = Exclude<JSONSchema, boolean>
export type SchemaWithID = Schema & { $id: string }

export type SchemaType<S extends SchemaWithID, T = FromSchema<S>> = {
  Type: T
  assert: (data: unknown) => asserts data is T
  cast: (data: unknown) => T
  is: (data: unknown) => data is T
  schema: S
}
