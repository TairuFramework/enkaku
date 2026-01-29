import { describe, expect, test } from 'vitest'

import { assertTimeClaimsValid, now } from '../src/time.js'

describe('now()', () => {
  test('returns current time in seconds', () => {
    const before = Math.floor(Date.now() / 1000)
    const result = now()
    const after = Math.floor(Date.now() / 1000)
    expect(result).toBeGreaterThanOrEqual(before)
    expect(result).toBeLessThanOrEqual(after)
  })
})

describe('assertTimeClaimsValid()', () => {
  const fixedTime = 1700000000 // Fixed timestamp for testing

  describe('exp (expiration) claim', () => {
    test('accepts token without exp claim', () => {
      expect(() => assertTimeClaimsValid({}, { atTime: fixedTime })).not.toThrow()
    })

    test('accepts token with future exp', () => {
      expect(() =>
        assertTimeClaimsValid({ exp: fixedTime + 3600 }, { atTime: fixedTime }),
      ).not.toThrow()
    })

    test('accepts token with exp equal to current time', () => {
      // exp is "at or after" - equal should pass
      expect(() =>
        assertTimeClaimsValid({ exp: fixedTime }, { atTime: fixedTime }),
      ).not.toThrow()
    })

    test('rejects token with past exp', () => {
      expect(() =>
        assertTimeClaimsValid({ exp: fixedTime - 1 }, { atTime: fixedTime }),
      ).toThrow('Token expired')
    })

    test('respects clockTolerance for exp', () => {
      // Expired by 5 seconds, but tolerance is 10
      expect(() =>
        assertTimeClaimsValid(
          { exp: fixedTime - 5 },
          { atTime: fixedTime, clockTolerance: 10 },
        ),
      ).not.toThrow()

      // Expired by 15 seconds, tolerance is 10 - should fail
      expect(() =>
        assertTimeClaimsValid(
          { exp: fixedTime - 15 },
          { atTime: fixedTime, clockTolerance: 10 },
        ),
      ).toThrow('Token expired')
    })
  })

  describe('nbf (not before) claim', () => {
    test('accepts token without nbf claim', () => {
      expect(() => assertTimeClaimsValid({}, { atTime: fixedTime })).not.toThrow()
    })

    test('accepts token with past nbf', () => {
      expect(() =>
        assertTimeClaimsValid({ nbf: fixedTime - 3600 }, { atTime: fixedTime }),
      ).not.toThrow()
    })

    test('accepts token with nbf equal to current time', () => {
      expect(() =>
        assertTimeClaimsValid({ nbf: fixedTime }, { atTime: fixedTime }),
      ).not.toThrow()
    })

    test('rejects token with future nbf', () => {
      expect(() =>
        assertTimeClaimsValid({ nbf: fixedTime + 1 }, { atTime: fixedTime }),
      ).toThrow('Token not yet valid')
    })

    test('respects clockTolerance for nbf', () => {
      // nbf is 5 seconds in future, but tolerance is 10
      expect(() =>
        assertTimeClaimsValid(
          { nbf: fixedTime + 5 },
          { atTime: fixedTime, clockTolerance: 10 },
        ),
      ).not.toThrow()

      // nbf is 15 seconds in future, tolerance is 10 - should fail
      expect(() =>
        assertTimeClaimsValid(
          { nbf: fixedTime + 15 },
          { atTime: fixedTime, clockTolerance: 10 },
        ),
      ).toThrow('Token not yet valid')
    })
  })

  describe('combined claims', () => {
    test('validates both exp and nbf', () => {
      // Valid window: nbf in past, exp in future
      expect(() =>
        assertTimeClaimsValid(
          { nbf: fixedTime - 100, exp: fixedTime + 100 },
          { atTime: fixedTime },
        ),
      ).not.toThrow()
    })

    test('exp failure takes precedence', () => {
      expect(() =>
        assertTimeClaimsValid(
          { nbf: fixedTime - 100, exp: fixedTime - 1 },
          { atTime: fixedTime },
        ),
      ).toThrow('Token expired')
    })

    test('iat claim is ignored (informational only)', () => {
      // iat in future should not cause validation to fail
      expect(() =>
        assertTimeClaimsValid({ iat: fixedTime + 1000 }, { atTime: fixedTime }),
      ).not.toThrow()
    })
  })

  describe('uses current time by default', () => {
    test('uses now() when atTime not provided', () => {
      const futureExp = now() + 3600
      expect(() => assertTimeClaimsValid({ exp: futureExp })).not.toThrow()

      const pastExp = now() - 3600
      expect(() => assertTimeClaimsValid({ exp: pastExp })).toThrow('Token expired')
    })
  })
})
