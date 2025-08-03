import type { Schema } from './types.js'

export function resolveReference(root: Schema, ref: string): Schema {
  if (!ref.startsWith('#')) {
    throw new Error(`Invalid reference format: ${ref}`)
  }

  const segments = ref.split('/').slice(1)
  // biome-ignore lint/suspicious/noExplicitAny: mixed type
  let current: any = root
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      throw new Error(`Invalid reference path: ${ref}`)
    }
    current = current[segment]
    if (current == null) {
      throw new Error(`Reference not found: ${ref}`)
    }
  }
  return current as Schema
}

export function resolveSchema(root: Schema, schema: Schema): Schema {
  const ref = schema.$ref
  return ref ? resolveReference(root, ref) : schema
}
