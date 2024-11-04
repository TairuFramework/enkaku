import type { ErrorObject } from 'ajv'

import type { Schema } from './types.js'

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

export class ValidationError extends AggregateError {
  #data: unknown
  #schema: Schema

  constructor(schema: Schema, data: unknown, errorObjects?: Array<ErrorObject> | null) {
    super(
      (errorObjects ?? []).map((err) => new ValidationErrorObject(err)),
      `Validation failed for schema ${schema.$id ?? schema.type}`,
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
