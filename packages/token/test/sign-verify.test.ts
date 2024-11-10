import { ed25519 } from '@noble/curves/ed25519'
import { p256 } from '@noble/curves/p256'
import { sha256 } from '@noble/hashes/sha256'

import { getTokenSigner, randomPrivateKey, randomSigner, randomTokenSigner } from '../src/signer.js'
import type { GenericSigner } from '../src/types.js'
import { getVerifier } from '../src/verifier.js'

describe('getTokenSigner()', () => {
  test('returns the signer for the given private key', () => {
    const privateKey = randomPrivateKey()
    const signer1 = getTokenSigner(privateKey)
    const signer2 = getTokenSigner(privateKey)
    expect(signer2.id).toBe(signer1.id)
  })
})

describe('randomTokenSigner()', () => {
  test('returns a random signer', () => {
    const signer1 = randomTokenSigner()
    const signer2 = randomTokenSigner()
    expect(signer2.id).not.toBe(signer1.id)
  })
})

describe('sign and verify', () => {
  test('EdDSA signature', async () => {
    const signer = randomSigner()
    const message = new Uint8Array([1, 2, 3])
    const signature = await signer.sign(message)
    const publicKey = ed25519.getPublicKey(signer.privateKey)
    const verify = getVerifier('EdDSA')
    const verified = await verify(signature, message, publicKey)
    expect(verified).toBe(true)
    const failed = await verify(signature, message, new Uint8Array(32))
    expect(failed).toBe(false)
  })

  test('ES256 signature', async () => {
    const privateKey = p256.utils.randomPrivateKey()
    const signer: GenericSigner = {
      algorithm: 'ES256',
      publicKey: p256.getPublicKey(privateKey, true),
      sign: (message) => {
        return p256.sign(sha256(message), privateKey).toCompactRawBytes()
      },
    }

    const message = new Uint8Array([1, 2, 3])
    const signature = await signer.sign(message)
    const verify = getVerifier('ES256')
    const verified = await verify(signature, message, signer.publicKey)
    expect(verified).toBe(true)

    const otherKey = p256.utils.randomPrivateKey()
    const failed = await verify(signature, message, p256.getPublicKey(otherKey, true))
    expect(failed).toBe(false)
  })
})
