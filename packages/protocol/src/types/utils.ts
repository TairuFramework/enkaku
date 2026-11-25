import type { FromSchema, Schema } from '@sozai/schema'

// Open runtime schemas cannot retain literal keyword inference.
export type DataOf<S> = S extends Schema
  ? string extends keyof S
    ? S extends { type: 'object' }
      ? Record<string, unknown>
      : unknown
    : FromSchema<S>
  : never

// biome-ignore lint/suspicious/noConfusingVoidType: return type
export type ReturnOf<S> = S extends Schema ? DataOf<S> : void

export type ValueOf<T> = T[keyof T]
