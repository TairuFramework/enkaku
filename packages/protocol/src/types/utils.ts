import type { FromSchema, Schema } from '@enkaku/schema'

export type DataOf<S> = S extends Schema ? FromSchema<S> : never

// biome-ignore lint/suspicious/noConfusingVoidType: return type
export type ReturnOf<S> = S extends Schema ? FromSchema<S> : void

export type ValueOf<T> = T[keyof T]
