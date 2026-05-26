import { isType } from '@enkaku/schema'
import { describe, expect, it } from 'vitest'
import { validateSignedHeader } from '../src/schemas.js'

describe('signedHeaderSchema kid', () => {
  it('accepts a header with kid', () => {
    expect(isType(validateSignedHeader, { typ: 'JWT', alg: 'EdDSA', kid: '#key-0' })).toBe(true)
  })

  it('accepts a header without kid', () => {
    expect(isType(validateSignedHeader, { typ: 'JWT', alg: 'EdDSA' })).toBe(true)
  })

  it('rejects a header with non-string kid', () => {
    expect(isType(validateSignedHeader, { typ: 'JWT', alg: 'EdDSA', kid: 42 })).toBe(false)
  })
})
