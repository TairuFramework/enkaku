import { isFullIdentity, verifyToken } from '@enkaku/token'

import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { describe, expect, test } from 'vitest'
import { CLA, INS } from '../src/apdu.js'
import { createLedgerIdentityProvider } from '../src/provider.js'
import type { LedgerTransport } from '../src/types.js'

// Fixed test private key (simulates what's on the Ledger at a given path)
const TEST_PRIVATE_KEY = ed25519.utils.randomSecretKey()
const TEST_PUBLIC_KEY = ed25519.getPublicKey(TEST_PRIVATE_KEY)

function createMockTransport(): LedgerTransport {
  let messageBuffer = new Uint8Array(0)

  return {
    async send(cla: number, ins: number, p1: number, _p2: number, data?: Uint8Array) {
      if (cla !== CLA) throw new Error(`Unknown CLA: ${cla}`)

      switch (ins) {
        case INS.GET_PUBLIC_KEY:
          return TEST_PUBLIC_KEY

        case INS.SIGN_MESSAGE: {
          if (p1 === 0x00) {
            const pathLen = 1 + (data?.[0] ?? 0) * 4
            messageBuffer = data?.slice(pathLen) ?? new Uint8Array(0)
          } else {
            const combined = new Uint8Array(messageBuffer.length + (data?.length ?? 0))
            combined.set(messageBuffer)
            if (data != null) combined.set(data, messageBuffer.length)
            messageBuffer = combined
          }
          return ed25519.sign(messageBuffer, TEST_PRIVATE_KEY)
        }

        case INS.ECDH_X25519: {
          const pathLen = 1 + (data?.[0] ?? 0) * 4
          const ephPub = data?.slice(pathLen)
          if (ephPub == null) throw new Error('Missing ephemeral public key')
          const x25519Private = ed25519.utils.toMontgomerySecret(TEST_PRIVATE_KEY)
          return x25519.getSharedSecret(x25519Private, ephPub)
        }

        default:
          throw new Error(`Unknown INS: ${ins}`)
      }
    },
  }
}

describe('createLedgerIdentityProvider()', () => {
  test('provideIdentity() returns FullIdentity', async () => {
    const provider = createLedgerIdentityProvider(createMockTransport())
    const identity = await provider.provideIdentity('0')
    expect(identity.id).toMatch(/^did:key:z/)
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('same keyID returns same DID', async () => {
    const provider = createLedgerIdentityProvider(createMockTransport())
    const a = await provider.provideIdentity('0')
    const b = await provider.provideIdentity('0')
    expect(a.id).toBe(b.id)
  })

  test('signToken() produces verifiable JWT', async () => {
    const provider = createLedgerIdentityProvider(createMockTransport())
    const identity = await provider.provideIdentity('0')
    const token = await identity.signToken({ data: 'test' })
    expect(token.payload.iss).toBe(identity.id)
    const verified = await verifyToken(`${token.data}.${token.signature}`)
    expect(verified.payload.data).toBe('test')
  })

  test('agreeKey() returns valid shared secret', async () => {
    const provider = createLedgerIdentityProvider(createMockTransport())
    const identity = await provider.provideIdentity('0')
    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = x25519.getPublicKey(ephPriv)
    const shared = await identity.agreeKey(ephPub)
    expect(shared).toBeInstanceOf(Uint8Array)
    expect(shared.length).toBe(32)
  })

  test('signToken() throws LedgerUserRejectedError on user rejection', async () => {
    const { LedgerUserRejectedError } = await import('../src/errors.js')
    const rejectTransport: LedgerTransport = {
      async send(_cla, ins, _p1, _p2, _data) {
        if (ins === INS.GET_PUBLIC_KEY) return TEST_PUBLIC_KEY
        if (ins === INS.SIGN_MESSAGE) {
          throw new LedgerUserRejectedError()
        }
        throw new Error(`Unexpected INS: ${ins}`)
      },
    }
    const provider = createLedgerIdentityProvider(rejectTransport)
    const identity = await provider.provideIdentity('0')
    await expect(identity.signToken({ data: 'test' })).rejects.toThrow(LedgerUserRejectedError)
  })
})
