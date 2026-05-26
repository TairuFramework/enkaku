import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, it } from 'vitest'
import { createInMemoryDIDCache } from '../src/cache.js'
import { CODECS, getDID, resolveIssuer, resolveIssuerWithDoc } from '../src/did.js'
import { encodeMultibase } from '../src/multibase.js'
import { encodePeer4 } from '../src/peer4.js'

describe('resolveIssuer', () => {
  it('resolves a did:key issuer to alg + pubkey without a resolver', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const did = getDID(CODECS.EdDSA, pub)
    const [alg, key] = await resolveIssuer(did)
    expect(alg).toBe('EdDSA')
    expect(key).toEqual(pub)
  })

  it('resolves a did:peer:4 short-form issuer via cache + kid', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { shortForm, doc } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    const cache = createInMemoryDIDCache()
    await cache.set(shortForm, doc)
    const resolver = (did: string) => cache.get(did)
    const [alg, key] = await resolveIssuer(shortForm, { kid: '#key-0' }, resolver)
    expect(alg).toBe('EdDSA')
    expect(key).toEqual(pub)
  })

  it('throws UnknownDID when peer:4 short form is unresolvable', async () => {
    await expect(
      resolveIssuer('did:peer:4zAAAAA', { kid: '#key-0' }, () => undefined),
    ).rejects.toThrow(/Unknown DID/)
  })

  it('falls back to first authentication entry when kid missing', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { shortForm, doc } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    const resolver = (did: string) => (did === shortForm ? doc : undefined)
    const [alg, key] = await resolveIssuer(shortForm, {}, resolver)
    expect(alg).toBe('EdDSA')
    expect(key).toEqual(pub)
  })

  it('throws KidNotFound when kid does not exist in doc', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { shortForm, doc } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    const resolver = (did: string) => (did === shortForm ? doc : undefined)
    await expect(resolveIssuer(shortForm, { kid: '#missing' }, resolver)).rejects.toThrow(
      /KidNotFound/,
    )
  })

  it('decodes a did:peer:4 long-form issuer inline without calling the resolver', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { longForm } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    let resolverCalled = false
    const resolver = () => {
      resolverCalled = true
      return undefined
    }
    const [alg, key] = await resolveIssuer(longForm, { kid: '#key-0' }, resolver)
    expect(resolverCalled).toBe(false)
    expect(alg).toBe('EdDSA')
    expect(key).toEqual(pub)
  })

  it('decodes long form inline even without a resolver', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { longForm } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    const [alg, key] = await resolveIssuer(longForm, { kid: '#key-0' })
    expect(alg).toBe('EdDSA')
    expect(key).toEqual(pub)
  })
})

describe('resolveIssuerWithDoc', () => {
  it('returns the decoded doc when iss is a long-form did:peer:4', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { longForm, shortForm, doc } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    const result = await resolveIssuerWithDoc(longForm, { kid: '#key-0' })
    expect(result.alg).toBe('EdDSA')
    expect(result.publicKey).toEqual(pub)
    expect(result.peer4Doc).toEqual({ shortForm, doc })
  })

  it('returns no peer4Doc for short-form resolved via resolver', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { shortForm, doc } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    const resolver = (did: string) => (did === shortForm ? doc : undefined)
    const result = await resolveIssuerWithDoc(shortForm, { kid: '#key-0' }, resolver)
    expect(result.peer4Doc).toEqual({ shortForm, doc })
  })

  it('verifies hash-binding of resolver-returned doc and throws on mismatch', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const fakeShortForm = 'did:peer:4zAAAAAAAAAAAAAAAAAAAAAA'
    const resolver = () => ({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    await expect(resolveIssuerWithDoc(fakeShortForm, { kid: '#key-0' }, resolver)).rejects.toThrow(
      /hash mismatch/i,
    )
  })
})
