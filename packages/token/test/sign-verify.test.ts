import { ed25519 } from '@noble/curves/ed25519.js'
import { p256 } from '@noble/curves/nist.js'

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
    const { publicKey, secretKey } = p256.keygen()
    const signer: GenericSigner = {
      algorithm: 'ES256',
      publicKey,
      sign: (message) => p256.sign(message, secretKey),
    }

    const message = new Uint8Array([1, 2, 3])
    const signature = await signer.sign(message)
    const verify = getVerifier('ES256')
    const verified = await verify(signature, message, signer.publicKey)
    expect(verified).toBe(true)

    const failed = await verify(signature, message, p256.keygen().publicKey)
    expect(failed).toBe(false)
  })
})
