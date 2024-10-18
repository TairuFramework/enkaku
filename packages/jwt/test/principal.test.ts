import { getPublicKeyAsync } from '@noble/ed25519'

import {
  getSigner,
  getVerifier,
  randomPrivateKey,
  randomSigner,
  verifySignature,
} from '../src/principal.js'

describe('getSigner()', () => {
  test('returns the signer for the given private key', async () => {
    const privateKey = randomPrivateKey()
    const signer1 = await getSigner(privateKey)
    const signer2 = await getSigner(privateKey)
    expect(signer2.did).toBe(signer1.did)
  })
})

describe('randomSigner()', () => {
  test('returns a random signer', async () => {
    const signer1 = await randomSigner()
    const signer2 = await randomSigner()
    expect(signer2.did).not.toBe(signer1.did)
  })
})

describe('sign and verify', () => {
  test('using verifySignature()', async () => {
    const signer = await randomSigner()
    const message = new Uint8Array([1, 2, 3])
    const signature = await signer.sign(message)
    const publicKey = await getPublicKeyAsync(signer.privateKey)
    const verified = await verifySignature(signature, message, publicKey)
    expect(verified).toBe(true)
    const failed = await verifySignature(signature, message, new Uint8Array(32))
    expect(failed).toBe(false)
  })

  test('using getVerifier()', async () => {
    const signer = await randomSigner()
    const message = new Uint8Array([1, 2, 3])
    const signature = await signer.sign(message)
    const publicKey = await getPublicKeyAsync(signer.privateKey)

    const correctVerifier = getVerifier(publicKey)
    expect(correctVerifier.did).toBe(signer.did)
    await expect(correctVerifier.verify(signature, message)).resolves.toBe(true)

    const incorrectVerifier = getVerifier(new Uint8Array(32))
    expect(incorrectVerifier.did).not.toBe(signer.did)
    await expect(incorrectVerifier.verify(signature, message)).resolves.toBe(false)
  })
})
