import { derivePrivateKey, HDKeyStore } from '@enkaku/hd-keystore'
import { verifyToken } from '@enkaku/token'
import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { mnemonicToSeedSync } from '@scure/bip39'
import { describe, expect, test } from 'vitest'
import { INS } from '../src/apdu.js'
import { createLedgerIdentityProvider } from '../src/provider.js'
import type { LedgerTransport } from '../src/types.js'

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const SEED = mnemonicToSeedSync(MNEMONIC, '')

function createHDMockTransport(seed: Uint8Array): LedgerTransport {
  let messageBuffer = new Uint8Array(0)
  let signKey: Uint8Array = new Uint8Array(0)

  function getPrivateKeyFromAPDU(data: Uint8Array): Uint8Array {
    const componentCount = data[0]
    const components: Array<string> = []
    for (let i = 0; i < componentCount; i++) {
      const view = new DataView(data.buffer, data.byteOffset + 1 + i * 4, 4)
      const val = view.getUint32(0, false)
      components.push(`${val & 0x7fffffff}'`)
    }
    const path = `m/${components.join('/')}`
    return derivePrivateKey(seed, path)
  }

  return {
    async send(_cla: number, ins: number, p1: number, _p2: number, data?: Uint8Array) {
      if (data == null) throw new Error('Missing data')

      switch (ins) {
        case INS.GET_PUBLIC_KEY: {
          const privateKey = getPrivateKeyFromAPDU(data)
          return ed25519.getPublicKey(privateKey)
        }
        case INS.SIGN_MESSAGE: {
          if (p1 === 0x00) {
            const pathLen = 1 + data[0] * 4
            signKey = getPrivateKeyFromAPDU(data)
            messageBuffer = data.slice(pathLen)
          } else {
            const combined = new Uint8Array(messageBuffer.length + data.length)
            combined.set(messageBuffer)
            combined.set(data, messageBuffer.length)
            messageBuffer = combined
          }
          return ed25519.sign(messageBuffer, signKey)
        }
        case INS.ECDH_X25519: {
          const privateKey = getPrivateKeyFromAPDU(data)
          const pathLen = 1 + data[0] * 4
          const ephPub = data.slice(pathLen)
          const x25519Priv = ed25519.utils.toMontgomerySecret(privateKey)
          return x25519.getSharedSecret(x25519Priv, ephPub)
        }
        default:
          throw new Error(`Unknown INS: ${ins}`)
      }
    },
  }
}

describe('HD keystore + Ledger identity cross-compatibility', () => {
  test('same mnemonic produces same DID', async () => {
    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const ledgerProvider = createLedgerIdentityProvider(createHDMockTransport(SEED))

    const hdIdentity = await hdStore.provideIdentity('0')
    const ledgerIdentity = await ledgerProvider.provideIdentity('0')

    expect(hdIdentity.id).toBe(ledgerIdentity.id)
  })

  test('HD-signed token verifiable, Ledger-signed token verifiable', async () => {
    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const ledgerProvider = createLedgerIdentityProvider(createHDMockTransport(SEED))

    const hdIdentity = await hdStore.provideIdentity('0')
    const ledgerIdentity = await ledgerProvider.provideIdentity('0')

    const hdToken = await hdIdentity.signToken({ source: 'hd' })
    const ledgerToken = await ledgerIdentity.signToken({ source: 'ledger' })

    const hdVerified = await verifyToken(`${hdToken.data}.${hdToken.signature}`)
    const ledgerVerified = await verifyToken(`${ledgerToken.data}.${ledgerToken.signature}`)

    expect(hdVerified.payload.source).toBe('hd')
    expect(ledgerVerified.payload.source).toBe('ledger')
    expect(hdVerified.payload.iss).toBe(ledgerVerified.payload.iss)
  })

  test('ECDH key agreement produces same shared secret', async () => {
    const hdStore = HDKeyStore.fromMnemonic(MNEMONIC)
    const ledgerProvider = createLedgerIdentityProvider(createHDMockTransport(SEED))

    const hdIdentity = await hdStore.provideIdentity('0')
    const ledgerIdentity = await ledgerProvider.provideIdentity('0')

    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = x25519.getPublicKey(ephPriv)

    const hdShared = await hdIdentity.agreeKey(ephPub)
    const ledgerShared = await ledgerIdentity.agreeKey(ephPub)

    expect(hdShared).toEqual(ledgerShared)
  })
})
