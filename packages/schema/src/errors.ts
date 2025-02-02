import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ErrorObject } from 'ajv'

import type { Schema } from './types.js'

/**
 * JSON schema validation error for a specified input.
 */
export class ValidationErrorObject extends Error implements StandardSchemaV1.Issue {
  #details: ErrorObject
  #path: Array<string>

  constructor(errorObject: ErrorObject) {
    super(
      errorObject.message ??
        `Validation failed for ${errorObject.keyword} at ${errorObject.schemaPath}`,
    )
    this.#details = errorObject
    this.#path = errorObject.instancePath.split('/')
  }

  get details(): ErrorObject {
    return this.#details
  }

  get path(): ReadonlyArray<string> {
    return this.#path
  }
}

/**
 * Aggregate of errors raised when validating a `data` input against a JSON `schema`.
 */
export class ValidationError extends AggregateError implements StandardSchemaV1.FailureResult {
  #schema: Schema
  #value: unknown

  constructor(schema: Schema, value: unknown, errorObjects?: Array<ErrorObject> | null) {
    const schemaInfo = schema.$id ?? schema.type
    super(
      (errorObjects ?? []).map((err) => new ValidationErrorObject(err)),
      schemaInfo ? `Validation failed for schema ${schemaInfo}` : 'Schema validation failed',
    )
    this.#schema = schema
    this.#value = value
  }

  get issues(): ReadonlyArray<ValidationErrorObject> {
    return this.errors
  }

  get schema(): Schema {
    return this.#schema
  }

  get value(): unknown {
    return this.#value
  }
}
