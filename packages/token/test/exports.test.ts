import { describe, expect, it } from 'vitest'

import * as token from '../src/index.js'

describe('package exports', () => {
  it.each([
    'encodeMultibase',
    'decodeMultibase',
    'multihashSHA256',
    'verifyMultihash',
    'encodePeer4',
    'decodePeer4',
    'isPeer4',
    'getPeer4ShortForm',
    'validateDIDDoc',
    'createInMemoryDIDCache',
    'resolveIssuer',
    'createIdentity',
    'createRotationAssertion',
  ])('exports %s', (name) => {
    expect((token as Record<string, unknown>)[name]).toBeDefined()
  })
})
