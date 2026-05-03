import type { Encryptor } from '../../src/encryptor.js'

const DEFAULT_KEY = new Uint8Array([0x42, 0x13, 0x37, 0x99])
const TAG_BYTE_0 = 0xaa
const TAG_BYTE_1 = 0x55
const TAG_LENGTH = 2

export type FakeEncryptorOptions = {
  key?: Uint8Array
}

export class FakeEncryptor implements Encryptor {
  #key: Uint8Array
  #pendingEncryptFailures = 0
  #pendingDecryptFailures = 0
  #pendingCorruptions = 0

  constructor(options: FakeEncryptorOptions = {}) {
    const key = options.key ?? DEFAULT_KEY
    if (key.length === 0) {
      throw new Error('FakeEncryptor: key must be non-empty')
    }
    this.#key = key
  }

  async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    if (this.#pendingEncryptFailures > 0) {
      this.#pendingEncryptFailures--
      throw new Error('FakeEncryptor: encrypt failure')
    }

    const out = new Uint8Array(plaintext.length + TAG_LENGTH)
    for (let i = 0; i < plaintext.length; i++) {
      out[i] = plaintext[i] ^ this.#key[i % this.#key.length]
    }
    out[plaintext.length] = TAG_BYTE_0
    out[plaintext.length + 1] = TAG_BYTE_1

    if (this.#pendingCorruptions > 0) {
      this.#pendingCorruptions--
      // WHY: flip a tag byte to simulate wire tamper that decrypt's tag check catches deterministically
      out[out.length - 1] ^= 0xff
    }

    return out
  }

  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
    if (this.#pendingDecryptFailures > 0) {
      this.#pendingDecryptFailures--
      throw new Error('FakeEncryptor: decrypt failure')
    }

    if (
      ciphertext.length < TAG_LENGTH ||
      ciphertext[ciphertext.length - TAG_LENGTH] !== TAG_BYTE_0 ||
      ciphertext[ciphertext.length - 1] !== TAG_BYTE_1
    ) {
      throw new Error('FakeEncryptor: invalid tag')
    }

    const bodyLength = ciphertext.length - TAG_LENGTH
    const out = new Uint8Array(bodyLength)
    for (let i = 0; i < bodyLength; i++) {
      out[i] = ciphertext[i] ^ this.#key[i % this.#key.length]
    }
    return out
  }

  failNextEncrypts(n: number): void {
    this.#pendingEncryptFailures += n
  }

  failNextDecrypts(n: number): void {
    this.#pendingDecryptFailures += n
  }

  corruptNextCiphertexts(n: number): void {
    this.#pendingCorruptions += n
  }
}
