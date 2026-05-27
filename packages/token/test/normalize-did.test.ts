import { describe, expect, it } from 'vitest'

import { normalizeDID } from '../src/did.js'
import { encodePeer4 } from '../src/peer4.js'

const sampleDoc = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkSampleKey' }],
  authentication: ['#key-0'],
}

describe('normalizeDID', () => {
  it('folds did:peer:4 long form to short form', () => {
    const { longForm, shortForm } = encodePeer4(sampleDoc)
    expect(normalizeDID(longForm)).toBe(shortForm)
  })

  it('returns did:peer:4 short form unchanged', () => {
    const { shortForm } = encodePeer4(sampleDoc)
    expect(normalizeDID(shortForm)).toBe(shortForm)
  })

  it('passes did:key through unchanged', () => {
    const did = 'did:key:z6MkExampleKey1234567890'
    expect(normalizeDID(did)).toBe(did)
  })

  it('passes other strings through unchanged', () => {
    expect(normalizeDID('not-a-did')).toBe('not-a-did')
    expect(normalizeDID('')).toBe('')
  })
})
