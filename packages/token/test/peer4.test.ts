import { describe, expect, it } from 'vitest'
import { encodePeer4, validateDIDDoc } from '../src/peer4.js'

describe('validateDIDDoc', () => {
  it('accepts a minimal valid doc', () => {
    expect(
      validateDIDDoc({
        '@context': ['https://www.w3.org/ns/did/v1'],
        verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkAbc' }],
        authentication: ['#key-0'],
      }),
    ).toBe(true)
  })

  it('rejects a doc missing verificationMethod', () => {
    expect(
      validateDIDDoc({
        '@context': ['https://www.w3.org/ns/did/v1'],
      }),
    ).toBe(false)
  })

  it('rejects a verificationMethod entry missing publicKeyMultibase', () => {
    expect(
      validateDIDDoc({
        '@context': ['https://www.w3.org/ns/did/v1'],
        verificationMethod: [{ id: '#key-0', type: 'Multikey' }],
      }),
    ).toBe(false)
  })

  it('accepts a doc with keyAgreement entries', () => {
    expect(
      validateDIDDoc({
        '@context': ['https://www.w3.org/ns/did/v1'],
        verificationMethod: [
          { id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkAbc' },
          { id: '#key-1', type: 'Multikey', publicKeyMultibase: 'z6LSdef' },
        ],
        authentication: ['#key-0'],
        keyAgreement: ['#key-1'],
      }),
    ).toBe(true)
  })
})

describe('encodePeer4', () => {
  const doc = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkAbc' }],
    authentication: ['#key-0'],
  }

  it('produces a long form starting with did:peer:4', () => {
    const { longForm } = encodePeer4(doc)
    expect(longForm.startsWith('did:peer:4z')).toBe(true)
  })

  it('produces a short form prefix that matches the long form', () => {
    const { longForm, shortForm } = encodePeer4(doc)
    expect(longForm.startsWith(`${shortForm}:`)).toBe(true)
  })

  it('is deterministic — same doc → same long form', () => {
    const a = encodePeer4(doc)
    const b = encodePeer4({ ...doc })
    expect(a.longForm).toBe(b.longForm)
  })

  it('produces different output for different docs', () => {
    const a = encodePeer4(doc)
    const b = encodePeer4({ ...doc, authentication: [] })
    expect(a.longForm).not.toBe(b.longForm)
  })
})
