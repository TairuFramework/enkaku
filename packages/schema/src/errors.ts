import type { ErrorObject } from 'ajv'

import type { Schema } from './types.js'

/**
 * JSON schema validation error for a specified input.
 */
export class ValidationErrorObject extends Error {
  #details: ErrorObject

  constructor(errorObject: ErrorObject) {
    super(
      errorObject.message ??
        `Validation failed for ${errorObject.keyword} at ${errorObject.schemaPath}`,
    )
    this.#details = errorObject
  }

  get details(): ErrorObject {
    return this.#details
  }
}

/**
 * Aggregate of errors raised when validating a `data` input against a JSON `schema`.
 */
export class ValidationError extends AggregateError {
  #data: unknown
  #schema: Schema

  constructor(schema: Schema, data: unknown, errorObjects?: Array<ErrorObject> | null) {
    const schemaInfo = schema.$id ?? schema.type
    super(
      (errorObjects ?? []).map((err) => new ValidationErrorObject(err)),
      schemaInfo ? `Validation failed for schema ${schemaInfo}` : 'Schema validation failed',
    )
    this.#data = data
    this.#schema = schema
  }

  get data(): unknown {
    return this.#data
  }

  get schema(): Schema {
    return this.#schema
  }
}
