import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, it } from 'vitest'
import { createInMemoryDIDCache } from '../src/cache.js'
import { encodeMultibase } from '../src/multibase.js'
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

function makeDoc(seed: number) {
  const priv = new Uint8Array(32).fill(seed % 256)
  const pub = ed25519.getPublicKey(priv)
  const ed25519Codec = new Uint8Array([0xed, 0x01])
  const tagged = new Uint8Array(ed25519Codec.length + pub.length)
  tagged.set(ed25519Codec, 0)
  tagged.set(pub, ed25519Codec.length)
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    verificationMethod: [
      { id: '#key-0', type: 'Multikey', publicKeyMultibase: encodeMultibase(tagged) },
    ],
    authentication: ['#key-0'],
  }
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

describe('createInMemoryDIDCache LRU', () => {
  it('evicts oldest entry when maxEntries exceeded', async () => {
    const cache = createInMemoryDIDCache({ maxEntries: 2 })
    const a = encodePeer4(makeDoc(1))
    const b = encodePeer4(makeDoc(2))
    const c = encodePeer4(makeDoc(3))
    await cache.set(a.shortForm, a.doc)
    await cache.set(b.shortForm, b.doc)
    await cache.set(c.shortForm, c.doc)
    expect(await cache.get(a.shortForm)).toBeUndefined()
    expect(await cache.get(b.shortForm)).toEqual(b.doc)
    expect(await cache.get(c.shortForm)).toEqual(c.doc)
  })

  it('treats get as a recency hit, protecting from eviction', async () => {
    const cache = createInMemoryDIDCache({ maxEntries: 2 })
    const a = encodePeer4(makeDoc(4))
    const b = encodePeer4(makeDoc(5))
    const c = encodePeer4(makeDoc(6))
    await cache.set(a.shortForm, a.doc)
    await cache.set(b.shortForm, b.doc)
    await cache.get(a.shortForm) // bumps a
    await cache.set(c.shortForm, c.doc)
    expect(await cache.get(a.shortForm)).toEqual(a.doc) // survives
    expect(await cache.get(b.shortForm)).toBeUndefined() // evicted
    expect(await cache.get(c.shortForm)).toEqual(c.doc)
  })

  it('defaults to a generous maxEntries when omitted', async () => {
    const cache = createInMemoryDIDCache()
    const docs = []
    for (let i = 0; i < 100; i++) {
      const d = encodePeer4(makeDoc(i + 10))
      docs.push(d)
      await cache.set(d.shortForm, d.doc)
    }
    expect(await cache.get(docs[0].shortForm)).toEqual(docs[0].doc)
    expect(await cache.get(docs[99].shortForm)).toEqual(docs[99].doc)
  })
})
