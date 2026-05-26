import { describe, expect, it } from 'vitest'
import { createInMemoryDIDCache } from '../src/cache.js'
import { encodePeer4 } from '../src/peer4.js'

const docA = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkAbc' }],
  authentication: ['#key-0'],
}

const docB = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkDef' }],
  authentication: ['#key-0'],
}

describe('createInMemoryDIDCache', () => {
  it('stores and retrieves a doc by short form', async () => {
    const cache = createInMemoryDIDCache()
    const { shortForm, doc } = encodePeer4(docA)
    await cache.set(shortForm, doc)
    expect(await cache.get(shortForm)).toEqual(doc)
  })

  it('returns undefined for unknown short form', async () => {
    const cache = createInMemoryDIDCache()
    expect(await cache.get('did:peer:4zUnknown')).toBeUndefined()
  })

  it('rejects set when short form does not match the doc hash', async () => {
    const cache = createInMemoryDIDCache()
    const { shortForm: shortA } = encodePeer4(docA)
    await expect(cache.set(shortA, docB)).rejects.toThrow(/hash mismatch/i)
  })

  it('rejects set for non-peer:4 short form', async () => {
    const cache = createInMemoryDIDCache()
    await expect(cache.set('did:key:z6Mk', docA)).rejects.toThrow(/did:peer:4/)
  })

  it('is idempotent — repeated set with same doc is fine', async () => {
    const cache = createInMemoryDIDCache()
    const { shortForm } = encodePeer4(docA)
    await cache.set(shortForm, docA)
    await cache.set(shortForm, docA)
    expect(await cache.get(shortForm)).toEqual(docA)
  })
})
