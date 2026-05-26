import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, it } from 'vitest'
import { createInMemoryDIDCache } from '../src/cache.js'
import { createIdentity } from '../src/identity.js'
import { isPeer4 } from '../src/peer4.js'
import { verifyToken } from '../src/token.js'

describe('createIdentity', () => {
  it('emits did:key for a single classical signing key', async () => {
    const identity = await createIdentity({ keys: [{ purpose: 'sig', alg: 'EdDSA' }] })
    expect(identity.did.startsWith('did:key:')).toBe(true)
    expect(identity.longForm).toBe(identity.did)
  })

  it('emits did:peer:4 for multi-key identities', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    expect(isPeer4(identity.did)).toBe(true)
    expect(identity.longForm).not.toBe(identity.did)
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
    await cache.set(identity.did, identity.doc)
    const signed = await identity.sign({ aud: 'someone' })
    expect(signed.header.kid).toBeDefined()
    expect(signed.payload.iss).toBe(identity.did)
    const verified = await verifyToken(signed, undefined, undefined, {
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
    expect(identity.did.startsWith('did:key:')).toBe(true)
    const signed = await identity.sign({})
    expect(signed.payload.iss).toBe(identity.did)
  })
})
