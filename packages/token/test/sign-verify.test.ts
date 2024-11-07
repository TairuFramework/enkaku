import { getPublicKeyAsync } from '@noble/ed25519'

import { getTokenSigner, randomPrivateKey, randomSigner, randomTokenSigner } from '../src/signer.js'
import { getVerifier } from '../src/verifier.js'

describe('getTokenSigner()', () => {
  test('returns the signer for the given private key', async () => {
    const privateKey = randomPrivateKey()
    const signer1 = getTokenSigner(privateKey)
    const signer2 = getTokenSigner(privateKey)
    const [id1, id2] = await Promise.all([signer1.getIssuer(), signer2.getIssuer()])
    expect(id2).toBe(id1)
  })
})

describe('randomTokenSigner()', () => {
  test('returns a random signer', async () => {
    const signer1 = randomTokenSigner()
    const signer2 = randomTokenSigner()
    const [id1, id2] = await Promise.all([signer1.getIssuer(), signer2.getIssuer()])
    expect(id2).not.toBe(id1)
  })
})

describe('sign and verify', () => {
  test('using getVerifier()', async () => {
    const signer = await randomSigner()
    const message = new Uint8Array([1, 2, 3])
    const signature = await signer.sign(message)
    const publicKey = await getPublicKeyAsync(signer.privateKey)
    const verify = getVerifier('EdDSA')
    const verified = await verify(signature, message, publicKey)
    expect(verified).toBe(true)
    const failed = await verify(signature, message, new Uint8Array(32))
    expect(failed).toBe(false)
  })
})
