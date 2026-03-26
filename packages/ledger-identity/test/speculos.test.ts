/**
 * Integration tests against Speculos emulator.
 *
 * These tests require Speculos running with the Enkaku app:
 *
 *   cd apps/ledger && docker compose up --build
 *
 * Speculos must be started with a known seed:
 *   --seed "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
 *
 * The tests auto-approve button prompts via the Speculos REST API.
 * Skip these tests if Speculos is not available (SPECULOS_URL not set).
 */

import { HDKeyStore } from '@enkaku/hd-keystore'
import { isFullIdentity, verifyToken } from '@enkaku/token'
import { x25519 } from '@noble/curves/ed25519.js'
import { describe, expect, test } from 'vitest'

import { CLA, encodeDerivationPath, encodeSignMessageChunks, INS } from '../src/apdu.js'
import { createLedgerIdentityProvider } from '../src/provider.js'
import type { LedgerTransport } from '../src/types.js'

const SPECULOS_API_URL = process.env.SPECULOS_URL ?? 'http://127.0.0.1:5000'
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
 * Create a transport that sends APDUs to Speculos via its REST API.
 * Also auto-approves any button prompts after each APDU that requires confirmation.
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
      // Build the hex-encoded APDU
      const dataHex = data != null ? Buffer.from(data).toString('hex') : ''
      const lc = data != null ? data.length : 0
      const apduHex =
        cla.toString(16).padStart(2, '0') +
        ins.toString(16).padStart(2, '0') +
        p1.toString(16).padStart(2, '0') +
        p2.toString(16).padStart(2, '0') +
        lc.toString(16).padStart(2, '0') +
        dataHex

      // If this command requires user confirmation (SIGN_MESSAGE final chunk or ECDH),
      // auto-approve by pressing right + both buttons after a short delay
      const needsApproval =
        (ins === INS.SIGN_MESSAGE && (p1 === 0x00 || p2 === 0x01)) || ins === INS.ECDH_X25519

      // Send APDU via Speculos REST API
      const response = await fetch(`${SPECULOS_API_URL}/apdu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: apduHex }),
      })

      if (needsApproval) {
        // Auto-approve: navigate to "Approve" and press both buttons
        // Wait a moment for the UI to render
        await new Promise((resolve) => setTimeout(resolve, 200))
        // Press right to navigate to approve
        await fetch(`${SPECULOS_API_URL}/button/right`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'press-and-release' }),
        })
        await new Promise((resolve) => setTimeout(resolve, 200))
        // Press both buttons to confirm
        await fetch(`${SPECULOS_API_URL}/button/both`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'press-and-release' }),
        })
      }

      if (!response.ok) {
        throw new Error(`Speculos APDU error: ${response.status} ${response.statusText}`)
      }

      const result = (await response.json()) as { data: string }
      const responseHex = result.data

      // Last 4 hex chars are the status word
      const swHex = responseHex.slice(-4)
      const sw = Number.parseInt(swHex, 16)

      if (sw !== 0x9000) {
        throw new Error(`APDU error: status word 0x${swHex}`)
      }

      // Return response data (excluding status word)
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

describe.skipIf(!SPECULOS_AVAILABLE)('Speculos integration', () => {
  test('GET_PUBLIC_KEY returns 32-byte Ed25519 public key', async () => {
    const transport = createSpeculosTransport()
    const pathBytes = encodeDerivationPath("m/44'/903'/0'")
    const response = await transport.send(CLA, INS.GET_PUBLIC_KEY, 0x00, 0x00, pathBytes)
    expect(response.length).toBe(32)
  })

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

  test('same DID as HD keystore with same mnemonic', async () => {
    const provider = createLedgerIdentityProvider(createSpeculosTransport())
    const ledgerIdentity = await provider.provideIdentity('0')

    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const hdIdentity = await hdStore.provideIdentity('0')

    expect(ledgerIdentity.id).toBe(hdIdentity.id)
  })

  test('ECDH produces same shared secret as HD keystore', async () => {
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
})
