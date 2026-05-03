import { describe, expect, test } from 'vitest'

import { FakeEncryptor } from './fixtures/fake-encryptor.js'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

describe('FakeEncryptor fixture', () => {
  test('round-trips a non-trivial plaintext through encrypt and decrypt', async () => {
    const encryptor = new FakeEncryptor()
    const plaintext = textEncoder.encode('The quick brown fox jumps over the lazy dog. '.repeat(3))
    expect(plaintext.length).toBeGreaterThan(100)

    const ciphertext = await encryptor.encrypt(plaintext)
    expect(ciphertext).not.toEqual(plaintext)

    const recovered = await encryptor.decrypt(ciphertext)
    expect(textDecoder.decode(recovered)).toBe(textDecoder.decode(plaintext))
  })

  test('failNextEncrypts(1) makes the next encrypt throw, then recovers', async () => {
    const encryptor = new FakeEncryptor()
    encryptor.failNextEncrypts(1)

    await expect(encryptor.encrypt(textEncoder.encode('first'))).rejects.toThrow(/encrypt failure/)

    const second = await encryptor.encrypt(textEncoder.encode('second'))
    const recovered = await encryptor.decrypt(second)
    expect(textDecoder.decode(recovered)).toBe('second')
  })

  test('failNextDecrypts(1) makes the next decrypt throw, then recovers', async () => {
    const encryptor = new FakeEncryptor()
    const ciphertextA = await encryptor.encrypt(textEncoder.encode('alpha'))
    const ciphertextB = await encryptor.encrypt(textEncoder.encode('beta'))

    encryptor.failNextDecrypts(1)
    await expect(encryptor.decrypt(ciphertextA)).rejects.toThrow(/decrypt failure/)

    const recovered = await encryptor.decrypt(ciphertextB)
    expect(textDecoder.decode(recovered)).toBe('beta')
  })

  test('corruptNextCiphertexts(1) yields a ciphertext that fails to decrypt', async () => {
    const encryptor = new FakeEncryptor()
    encryptor.corruptNextCiphertexts(1)

    const corrupted = await encryptor.encrypt(textEncoder.encode('payload'))
    await expect(encryptor.decrypt(corrupted)).rejects.toThrow(/invalid tag/)

    const clean = await encryptor.encrypt(textEncoder.encode('payload'))
    const recovered = await encryptor.decrypt(clean)
    expect(textDecoder.decode(recovered)).toBe('payload')
  })

  test('decrypt throws when the trailing tag is wrong', async () => {
    const encryptor = new FakeEncryptor()
    const bogus = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00, 0x00])
    await expect(encryptor.decrypt(bogus)).rejects.toThrow(/invalid tag/)
  })
})
