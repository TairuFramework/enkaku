import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'
import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, it } from 'vitest'

import { createInMemoryDIDCache } from '../src/cache.js'
import { encodeMultibase } from '../src/multibase.js'
import { encodePeer4 } from '../src/peer4.js'
import { verifyToken } from '../src/token.js'

function buildPeer4Token(privateKey: Uint8Array) {
  const pub = ed25519.getPublicKey(privateKey)
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
  const header = { typ: 'JWT' as const, alg: 'EdDSA' as const, kid: '#key-0' }
  const payload = { iss: shortForm }
  const data = `${b64uFromJSON(header)}.${b64uFromJSON(payload)}`
  const signature = toB64U(ed25519.sign(fromUTF(data), privateKey))
  return { token: { header, payload, signature, data }, shortForm, doc }
}

describe('verifyToken with did:peer:4', () => {
  it('verifies a peer:4 token when the doc is cached', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const { token, shortForm, doc } = buildPeer4Token(priv)
    const cache = createInMemoryDIDCache()
    await cache.set(shortForm, doc)
    const verified = await verifyToken(token, {
      resolver: (did) => cache.get(did),
    })
    expect((verified as { verifiedPublicKey: Uint8Array }).verifiedPublicKey).toEqual(
      ed25519.getPublicKey(priv),
    )
  })

  it('throws UnknownDID when peer:4 doc is not cached', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const { token } = buildPeer4Token(priv)
    await expect(verifyToken(token, { resolver: () => undefined })).rejects.toThrow(/Unknown DID/)
  })

  it('still verifies a did:key token without a resolver', async () => {
    const { createSigningIdentity } = await import('../src/identity.js')
    const priv = ed25519.utils.randomSecretKey()
    const id = createSigningIdentity(priv)
    const signed = await id.signToken({ iss: id.id })
    const verified = await verifyToken(signed)
    expect((verified as { verifiedPublicKey: Uint8Array }).verifiedPublicKey).toEqual(id.publicKey)
  })
})
