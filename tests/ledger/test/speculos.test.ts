/**
 * Integration tests: Ledger app (via Speculos) + @enkaku/ledger-identity.
 *
 * Run with: ./test.sh (or pnpm run test:speculos)
 *
 * These tests validate the full APDU round-trip between the TypeScript
 * client and the BOLOS C app running in the Speculos emulator.
 *
 * Speculos must be started with seed:
 *   "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
 *
 * Tests auto-skip if Speculos is not available.
 */

import { HDKeyStore } from '@enkaku/hd-keystore'
import {
  CLA,
  createLedgerIdentityProvider,
  encodeDerivationPath,
  INS,
  type LedgerTransport,
} from '@enkaku/ledger-identity'
import { createTokenEncrypter, isFullIdentity, verifyToken } from '@enkaku/token'
import { x25519 } from '@noble/curves/ed25519.js'
import { describe, expect, test } from 'vitest'

const SPECULOS_API_URL = process.env.SPECULOS_URL ?? 'http://127.0.0.1:9999'
const SPECULOS_AVAILABLE = await checkSpeculosAvailable()

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

async function checkSpeculosAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SPECULOS_API_URL}/events?currentscreenonly=true`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Transport that sends APDUs to Speculos via its REST API.
 * Auto-approves device button prompts for signing/ECDH operations.
 */
function createSpeculosTransport(): LedgerTransport {
  return {
    async send(
      cla: number,
      ins: number,
      p1: number,
      p2: number,
      data?: Uint8Array,
    ): Promise<Uint8Array> {
      const dataHex = data != null ? Buffer.from(data).toString('hex') : ''
      const lc = data != null ? data.length : 0
      const apduHex =
        cla.toString(16).padStart(2, '0') +
        ins.toString(16).padStart(2, '0') +
        p1.toString(16).padStart(2, '0') +
        p2.toString(16).padStart(2, '0') +
        lc.toString(16).padStart(2, '0') +
        dataHex

      const response = await fetch(`${SPECULOS_API_URL}/apdu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify({ data: apduHex }),
        keepalive: false,
      })

      if (!response.ok) {
        throw new Error(`Speculos APDU error: ${response.status} ${response.statusText}`)
      }

      const result = (await response.json()) as { data: string }
      const responseHex = result.data

      const swHex = responseHex.slice(-4)
      const sw = Number.parseInt(swHex, 16)

      if (sw !== 0x9000) {
        throw new Error(`APDU error: status word 0x${swHex}`)
      }

      const dataResponse = responseHex.slice(0, -4)
      if (dataResponse.length === 0) {
        return new Uint8Array(0)
      }
      return Uint8Array.from(
        dataResponse.match(/.{2}/g)?.map((b: string) => Number.parseInt(b, 16)) ?? [],
      )
    },
  }
}

// -- Ledger App Tests (raw APDU) --

describe.skipIf(!SPECULOS_AVAILABLE)('Ledger app: APDU protocol', () => {
  test('GET_APP_VERSION returns 3 bytes', async () => {
    const transport = createSpeculosTransport()
    const response = await transport.send(CLA, INS.GET_APP_VERSION, 0x00, 0x00)
    expect(response.length).toBe(3)
    expect(response[0]).toBe(0) // major
    expect(response[1]).toBe(1) // minor
    expect(response[2]).toBe(0) // patch
  })

  test('GET_PUBLIC_KEY returns 32-byte Ed25519 public key', async () => {
    const transport = createSpeculosTransport()
    const pathBytes = encodeDerivationPath("m/44'/903'/0'")
    const response = await transport.send(CLA, INS.GET_PUBLIC_KEY, 0x00, 0x00, pathBytes)
    expect(response.length).toBe(32)
  })

  test('GET_PUBLIC_KEY is deterministic for same path', async () => {
    const transport = createSpeculosTransport()
    const pathBytes = encodeDerivationPath("m/44'/903'/0'")
    const a = await transport.send(CLA, INS.GET_PUBLIC_KEY, 0x00, 0x00, pathBytes)
    const b = await transport.send(CLA, INS.GET_PUBLIC_KEY, 0x00, 0x00, pathBytes)
    expect(a).toEqual(b)
  })

  test('GET_PUBLIC_KEY returns different keys for different paths', async () => {
    const transport = createSpeculosTransport()
    const path0 = encodeDerivationPath("m/44'/903'/0'")
    const path1 = encodeDerivationPath("m/44'/903'/1'")
    const a = await transport.send(CLA, INS.GET_PUBLIC_KEY, 0x00, 0x00, path0)
    const b = await transport.send(CLA, INS.GET_PUBLIC_KEY, 0x00, 0x00, path1)
    expect(a).not.toEqual(b)
  })
})

// -- IdentityProvider Integration Tests --

describe.skipIf(!SPECULOS_AVAILABLE)('Ledger app + ledger-identity integration', () => {
  test('provideIdentity() returns FullIdentity with valid DID', async () => {
    const provider = createLedgerIdentityProvider(createSpeculosTransport())
    const identity = await provider.provideIdentity('0')
    expect(identity.id).toMatch(/^did:key:z/)
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('signToken() produces verifiable JWT', async () => {
    const provider = createLedgerIdentityProvider(createSpeculosTransport())
    const identity = await provider.provideIdentity('0')
    const token = await identity.signToken({ data: 'speculos-test' })
    expect(token.payload.iss).toBe(identity.id)
    const verified = await verifyToken(`${token.data}.${token.signature}`)
    expect(verified.payload.data).toBe('speculos-test')
  })

  test('agreeKey() returns 32-byte shared secret', async () => {
    const provider = createLedgerIdentityProvider(createSpeculosTransport())
    const identity = await provider.provideIdentity('0')
    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = x25519.getPublicKey(ephPriv)
    const shared = await identity.agreeKey(ephPub)
    expect(shared).toBeInstanceOf(Uint8Array)
    expect(shared.length).toBe(32)
  })

  test('decrypt() decrypts JWE encrypted to ledger identity', async () => {
    const provider = createLedgerIdentityProvider(createSpeculosTransport())
    const identity = await provider.provideIdentity('0')
    const encrypter = createTokenEncrypter(identity.id)
    const plaintext = new TextEncoder().encode('secret message')
    const jwe = await encrypter.encrypt(plaintext)
    const decrypted = await identity.decrypt(jwe)
    expect(decrypted).toEqual(plaintext)
  })
})

// -- Cross-compatibility: Ledger app vs HD keystore --

describe.skipIf(!SPECULOS_AVAILABLE)('Ledger app + hd-keystore cross-compatibility', () => {
  test('same mnemonic produces same DID', async () => {
    const provider = createLedgerIdentityProvider(createSpeculosTransport())
    const ledgerIdentity = await provider.provideIdentity('0')

    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const hdIdentity = await hdStore.provideIdentity('0')

    expect(ledgerIdentity.id).toBe(hdIdentity.id)
  })

  test('tokens from both sources are verifiable and share same issuer', async () => {
    const provider = createLedgerIdentityProvider(createSpeculosTransport())
    const ledgerIdentity = await provider.provideIdentity('0')

    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const hdIdentity = await hdStore.provideIdentity('0')

    const ledgerToken = await ledgerIdentity.signToken({ source: 'ledger' })
    const hdToken = await hdIdentity.signToken({ source: 'hd' })

    const ledgerVerified = await verifyToken(`${ledgerToken.data}.${ledgerToken.signature}`)
    const hdVerified = await verifyToken(`${hdToken.data}.${hdToken.signature}`)

    expect(ledgerVerified.payload.iss).toBe(hdVerified.payload.iss)
  })

  test('ECDH produces same shared secret from both sources', async () => {
    const provider = createLedgerIdentityProvider(createSpeculosTransport())
    const ledgerIdentity = await provider.provideIdentity('0')

    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const hdIdentity = await hdStore.provideIdentity('0')

    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = x25519.getPublicKey(ephPriv)

    const ledgerShared = await ledgerIdentity.agreeKey(ephPub)
    const hdShared = await hdIdentity.agreeKey(ephPub)

    expect(ledgerShared).toEqual(hdShared)
  })

  test('JWE encrypted by HD identity is decryptable by Ledger identity', async () => {
    const provider = createLedgerIdentityProvider(createSpeculosTransport())
    const ledgerIdentity = await provider.provideIdentity('0')

    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const hdIdentity = await hdStore.provideIdentity('0')

    // Encrypt with HD identity's DID
    const encrypter = createTokenEncrypter(hdIdentity.id)
    const plaintext = new TextEncoder().encode('cross-compat secret')
    const jwe = await encrypter.encrypt(plaintext)

    // Decrypt with Ledger identity (same underlying key)
    const decrypted = await ledgerIdentity.decrypt(jwe)
    expect(decrypted).toEqual(plaintext)
  })
})
