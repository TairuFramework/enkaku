import { b64uFromJSON } from '@enkaku/codec'
import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, test } from 'vitest'

import { createDecryptingIdentity, createFullIdentity, randomIdentity } from '../src/identity.js'
import { concatKDF, createTokenEncrypter, decryptToken, encryptToken } from '../src/jwe.js'
import { randomPrivateKey } from '../src/signer.js'

describe('concatKDF', () => {
  test('derives 256-bit key from shared secret', () => {
    const sharedSecret = new Uint8Array(32).fill(0xab)
    const key = concatKDF({
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256GCM',
      partyUInfo: new Uint8Array(0),
      partyVInfo: new Uint8Array(0),
    })
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  test('different algorithmID produces different key', () => {
    const sharedSecret = new Uint8Array(32).fill(0xab)
    const key1 = concatKDF({
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256GCM',
      partyUInfo: new Uint8Array(0),
      partyVInfo: new Uint8Array(0),
    })
    const key2 = concatKDF({
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256KW',
      partyUInfo: new Uint8Array(0),
      partyVInfo: new Uint8Array(0),
    })
    expect(Buffer.from(key1).equals(Buffer.from(key2))).toBe(false)
  })

  test('different partyInfo produces different key', () => {
    const sharedSecret = new Uint8Array(32).fill(0xab)
    const params = {
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256GCM',
    }
    const key1 = concatKDF({
      ...params,
      partyUInfo: new Uint8Array([1]),
      partyVInfo: new Uint8Array(0),
    })
    const key2 = concatKDF({
      ...params,
      partyUInfo: new Uint8Array([2]),
      partyVInfo: new Uint8Array(0),
    })
    expect(Buffer.from(key1).equals(Buffer.from(key2))).toBe(false)
  })
})

function edToX25519Public(edPrivateKey: Uint8Array): Uint8Array {
  const edPublicKey = ed25519.getPublicKey(edPrivateKey)
  return ed25519.utils.toMontgomery(edPublicKey)
}

describe('JWE encrypt and decrypt', () => {
  test('round-trip encrypt/decrypt with X25519 ECDH-ES', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const x25519Public = edToX25519Public(privateKey)

    const encrypter = createTokenEncrypter(x25519Public, { algorithm: 'X25519' })
    const decrypter = createDecryptingIdentity(privateKey)

    const plaintext = new TextEncoder().encode('hello world')
    const jwe = await encryptToken(encrypter, plaintext)
    const decrypted = await decryptToken(decrypter, jwe)

    expect(new TextDecoder().decode(decrypted)).toBe('hello world')
  })

  test('JWE compact serialization has 5 parts', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const x25519Public = edToX25519Public(privateKey)

    const encrypter = createTokenEncrypter(x25519Public, { algorithm: 'X25519' })
    const plaintext = new TextEncoder().encode('test')
    const jwe = await encryptToken(encrypter, plaintext)

    const parts = jwe.split('.')
    expect(parts.length).toBe(5)
    // For ECDH-ES direct, encrypted key is empty
    expect(parts[1]).toBe('')
  })

  test('decrypt fails with wrong key', async () => {
    const privateKey1 = ed25519.utils.randomSecretKey()
    const x25519Public1 = edToX25519Public(privateKey1)

    const privateKey2 = ed25519.utils.randomSecretKey()

    const encrypter = createTokenEncrypter(x25519Public1, { algorithm: 'X25519' })
    const decrypter = createDecryptingIdentity(privateKey2)

    const plaintext = new TextEncoder().encode('secret')
    const jwe = await encryptToken(encrypter, plaintext)

    await expect(decryptToken(decrypter, jwe)).rejects.toThrow()
  })
})

describe('createTokenEncrypter from DID', () => {
  test('creates encrypter from Ed25519 DID string', async () => {
    const identity = randomIdentity()
    const encrypter = createTokenEncrypter(identity.id)
    expect(encrypter.recipientID).toBe(identity.id)

    const plaintext = new TextEncoder().encode('from DID')
    const jwe = await encryptToken(encrypter, plaintext)
    const decrypted = await decryptToken(identity, jwe)
    expect(new TextDecoder().decode(decrypted)).toBe('from DID')
  })
})

describe('createTokenEncrypter', () => {
  test('caches recipient public key across encrypt calls', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const x25519Public = edToX25519Public(privateKey)

    const encrypter = createTokenEncrypter(x25519Public, { algorithm: 'X25519' })
    const decrypter = createDecryptingIdentity(privateKey)

    const plaintext = new TextEncoder().encode('test')
    const jwe1 = await encryptToken(encrypter, plaintext)
    const jwe2 = await encryptToken(encrypter, plaintext)

    // Different JWEs (different ephemeral keys / IVs)
    expect(jwe1).not.toBe(jwe2)

    // Both decrypt correctly
    const d1 = await decryptToken(decrypter, jwe1)
    const d2 = await decryptToken(decrypter, jwe2)
    expect(new TextDecoder().decode(d1)).toBe('test')
    expect(new TextDecoder().decode(d2)).toBe('test')
  })
})

describe('decryptToken() error paths', () => {
  test('rejects JWE with wrong number of parts', async () => {
    const decrypter = createDecryptingIdentity(ed25519.utils.randomSecretKey())
    await expect(decryptToken(decrypter, 'a.b.c')).rejects.toThrow('Invalid JWE format')
    await expect(decryptToken(decrypter, 'a.b.c.d')).rejects.toThrow('Invalid JWE format')
    await expect(decryptToken(decrypter, 'a.b.c.d.e.f')).rejects.toThrow('Invalid JWE format')
  })

  test('rejects JWE with unsupported algorithm', async () => {
    const decrypter = createDecryptingIdentity(ed25519.utils.randomSecretKey())
    const header = { alg: 'RSA-OAEP', enc: 'A256GCM', epk: { kty: 'RSA', crv: '', x: '' } }
    const encodedHeader = b64uFromJSON(header as unknown as Record<string, unknown>)
    const jwe = `${encodedHeader}..AAAA.BBBB.CCCC`
    await expect(decryptToken(decrypter, jwe)).rejects.toThrow('Unsupported JWE algorithm')
  })

  test('rejects JWE with unsupported encryption', async () => {
    const decrypter = createDecryptingIdentity(ed25519.utils.randomSecretKey())
    const header = { alg: 'ECDH-ES', enc: 'A128GCM', epk: { kty: 'OKP', crv: 'X25519', x: '' } }
    const encodedHeader = b64uFromJSON(header as unknown as Record<string, unknown>)
    const jwe = `${encodedHeader}..AAAA.BBBB.CCCC`
    await expect(decryptToken(decrypter, jwe)).rejects.toThrow('Unsupported JWE encryption')
  })
})

describe('createTokenEncrypter() error paths', () => {
  test('rejects Uint8Array recipient with unsupported algorithm', () => {
    const key = new Uint8Array(32)
    expect(() => createTokenEncrypter(key, { algorithm: 'RSA' as never })).toThrow(
      'Unsupported algorithm',
    )
  })
})

describe('DecryptingIdentity.decrypt()', () => {
  test('decrypts JWE encrypted to identity DID', async () => {
    const identity = createFullIdentity(randomPrivateKey())
    const encrypter = createTokenEncrypter(identity.id)
    const plaintext = new TextEncoder().encode('hello world')
    const jwe = await encrypter.encrypt(plaintext)
    const decrypted = await identity.decrypt(jwe)
    expect(decrypted).toEqual(plaintext)
  })
})
