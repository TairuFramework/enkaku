import type { FromSchema, Schema } from '@enkaku/schema'

export type DataOf<S> = S extends Schema ? FromSchema<S> : never

export type ValueOf<T> = T[keyof T]
