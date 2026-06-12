import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Ajv } from 'ajv'
import { Ajv2020 } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { FromSchema } from 'json-schema-to-ts'

import { ValidationError } from './errors.js'
import type { Schema } from './types.js'

/**
 * Options for creating a validator.
 */
export type ValidatorOptions = { draft?: '07' | '2020-12'; strict?: boolean | 'log' }

// AJV instances are locked to a single dialect AND a single strict setting, so
// we cache one instance per (draft, strict) pair and construct them lazily.
const instances = new Map<string, Ajv | Ajv2020>()

function getAjv(draft: '07' | '2020-12', strict?: boolean | 'log'): Ajv | Ajv2020 {
  const key = `${draft}:${strict ?? 'default'}`
  let instance = instances.get(key)
  if (instance == null) {
    const options = {
      allErrors: true,
      useDefaults: false,
      ...(strict !== undefined && { strict }),
    }
    instance = draft === '2020-12' ? new Ajv2020(options) : new Ajv(options)
    // @ts-expect-error missing type definition
    addFormats(instance)
    instances.set(key, instance)
  }
  return instance
}

/**
 * Validator function, returning a Result of the validation.
 */
export type Validator<T> = (value: unknown) => StandardSchemaV1.Result<T>

/**
 * Validator function factory using a JSON schema.
 */
export function createValidator<S extends Schema, T = FromSchema<S>>(
  schema: S,
  options?: ValidatorOptions,
): Validator<T> {
  const ajv = getAjv(options?.draft ?? '07', options?.strict)
  const check = ajv.compile(schema)
  // Remove from AJV's internal cache
  ajv.removeSchema(schema.$id)

  return (value: unknown) => {
    return check(value) ? { value: value as T } : new ValidationError(schema, value, check.errors)
  }
}

/**
 * Asserts the type of the given `value` using the `validator`.
 */
export function assertType<T>(validator: Validator<T>, value: unknown): asserts value is T {
  const result = validator(value)
  if (result instanceof ValidationError) {
    throw result
  }
}

/**
 * Asserts the type of the given `value` using the `validator` and returns it.
 */
export function asType<T>(validator: Validator<T>, value: unknown): T {
  assertType(validator, value)
  return value
}

/**
 * Checks the type of the given `value` using the `validator`.
 */
export function isType<T>(validator: Validator<T>, value: unknown): value is T {
  return !(validator(value) instanceof ValidationError)
}

/**
 * Turn a `Validator` function into a standard schema validator.
 */
export function toStandardValidator<T>(validator: Validator<T>): StandardSchemaV1<T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'enkaku',
      validate: validator,
    },
  }
}

/**
 * Create a standard schema validator.
 */
export function createStandardValidator<S extends Schema, T = FromSchema<S>>(
  schema: S,
  options?: ValidatorOptions,
): StandardSchemaV1<T> {
  return toStandardValidator(createValidator(schema, options))
}
