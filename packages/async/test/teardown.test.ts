import { describe, expect, test } from 'vitest'

import { DisposeInterruption } from '../src/interruptions.js'
import { isBenignTeardownError } from '../src/teardown.js'

describe('isBenignTeardownError', () => {
  test('returns false for null / undefined / non-error input', () => {
    expect(isBenignTeardownError(null)).toBe(false)
    expect(isBenignTeardownError(undefined)).toBe(false)
    expect(isBenignTeardownError(42)).toBe(false)
    expect(isBenignTeardownError({})).toBe(false)
  })

  test('recognises AbortError by name', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    expect(isBenignTeardownError(err)).toBe(true)
  })

  test('recognises DisposeInterruption instances', () => {
    expect(isBenignTeardownError(new DisposeInterruption())).toBe(true)
  })

  test('recognises WritableStream-closed messages', () => {
    expect(isBenignTeardownError(new TypeError('Invalid state: WritableStream is closed'))).toBe(
      true,
    )
  })

  test('recognises Writer/Reader closed messages', () => {
    expect(isBenignTeardownError(new TypeError('The writer has been closed'))).toBe(true)
    expect(isBenignTeardownError(new TypeError('The reader has been closed'))).toBe(true)
  })

  test('recognises bare string teardown reasons', () => {
    expect(isBenignTeardownError('Close')).toBe(true)
    expect(isBenignTeardownError('Transport')).toBe(true)
  })

  test('returns false for unrelated errors', () => {
    expect(isBenignTeardownError(new Error('boom'))).toBe(false)
    expect(isBenignTeardownError(new RangeError('out of range'))).toBe(false)
    expect(isBenignTeardownError('something else')).toBe(false)
  })
})
