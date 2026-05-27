import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, it } from 'vitest'
import { createInMemoryDIDCache } from '../src/cache.js'
import { createIdentity } from '../src/identity.js'
import { createTokenEncrypter, encryptToken } from '../src/jwe.js'
import { isPeer4 } from '../src/peer4.js'
import { verifyToken } from '../src/token.js'

describe('createIdentity', () => {
  it('emits did:key for a single classical signing key', async () => {
    const identity = await createIdentity({ keys: [{ purpose: 'sig', alg: 'EdDSA' }] })
    expect(identity.id.startsWith('did:key:')).toBe(true)
    expect(identity.longForm).toBe(identity.id)
  })

  it('emits did:peer:4 for multi-key identities', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    expect(isPeer4(identity.id)).toBe(true)
    expect(identity.longForm).not.toBe(identity.id)
    expect(identity.doc.verificationMethod.length).toBe(2)
  })

  it('rejects didMethod: "key" with multi-key input', async () => {
    await expect(
      createIdentity({
        keys: [
          { purpose: 'sig', alg: 'EdDSA' },
          { purpose: 'kem', alg: 'X25519' },
        ],
        didMethod: 'key',
      }),
    ).rejects.toThrow(/InvalidMethod/)
  })

  it('signs and verifies a token using a peer:4 multi-key identity', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'sig', alg: 'EdDSA' },
      ],
    })
    const cache = createInMemoryDIDCache()
    await cache.set(identity.id, identity.doc)
    const signed = await identity.sign({ aud: 'someone' })
    expect(signed.header.kid).toBeDefined()
    expect(signed.payload.iss).toBe(identity.longForm)
    const verified = await verifyToken(signed, {
      resolver: (did) => cache.get(did),
    })
    expect((verified as { verifiedPublicKey: Uint8Array }).verifiedPublicKey.length).toBe(32)
  })

  it('allows explicit kid selection', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'sig', alg: 'EdDSA' },
      ],
    })
    const signed = await identity.sign({ aud: 'a' }, { kid: '#key-1' })
    expect(signed.header.kid).toBe('#key-1')
  })

  it('accepts caller-provided private keys', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA', privateKey: priv }],
    })
    expect(identity.id.startsWith('did:key:')).toBe(true)
    const signed = await identity.sign({})
    expect(signed.payload.iss).toBe(identity.id)
  })

  it('decrypts a token addressed to its KEM key', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    const kemKey = identity.keys.find((k) => k.purpose === 'kem')
    if (kemKey == null) throw new Error('no kem key')
    const plaintext = new TextEncoder().encode('hello world')
    const encrypter = createTokenEncrypter(kemKey.publicKey, { algorithm: 'X25519' })
    const jwe = await encryptToken(encrypter, plaintext)
    const decrypted = await identity.decrypt(jwe)
    expect(new TextDecoder().decode(decrypted)).toBe('hello world')
  })

  it('throws when decrypting without a KEM key', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
    })
    await expect(identity.decrypt('fake.jwe')).rejects.toThrow(/no KEM key|no kem key/i)
  })
})
