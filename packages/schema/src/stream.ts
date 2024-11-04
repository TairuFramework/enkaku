import { createTransformStep } from '@enkaku/stream'

import type { ValidationError } from './errors.js'
import { type Validator, assertType } from './validation.js'

export function createValidationStream<T>(validator: Validator<T>) {
  return createTransformStep<unknown, T, ValidationError>((value) => {
    assertType(validator, value)
    return value
  })
}
