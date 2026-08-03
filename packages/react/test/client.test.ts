import { describe, expect, it } from 'vitest'

import { createRequestKey } from '../src/client.js'

describe('createRequestKey', () => {
  it('returns the procedure with an empty argument part when no argument is provided', () => {
    expect(createRequestKey('test/procedure')).toBe('test/procedure:')
  })

  it('serializes the argument as canonical JSON', () => {
    expect(createRequestKey('test/procedure', { one: 1, two: 'two' })).toBe(
      'test/procedure:{"one":1,"two":"two"}',
    )
  })

  it('is independent of the argument key order', () => {
    expect(createRequestKey('test/procedure', { one: 1, two: 2 })).toBe(
      createRequestKey('test/procedure', { two: 2, one: 1 }),
    )
  })

  it('distinguishes different arguments for the same procedure', () => {
    expect(createRequestKey('test/procedure', { one: 1 })).not.toBe(
      createRequestKey('test/procedure', { one: 2 }),
    )
  })
})
