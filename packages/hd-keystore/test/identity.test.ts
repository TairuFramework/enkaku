import { isFullIdentity, verifyToken } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import { HDKeyStore } from '../src/store.js'

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('HDKeyStore as IdentityProvider', () => {
  test('provideIdentity() returns FullIdentity', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const identity = await store.provideIdentity('0')
    expect(identity.id).toMatch(/^did:key:z/)
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('same keyID produces same DID', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const a = await store.provideIdentity('0')
    const b = await store.provideIdentity('0')
    expect(a.id).toBe(b.id)
  })

  test('different keyID produces different DID', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const a = await store.provideIdentity('0')
    const b = await store.provideIdentity('1')
    expect(a.id).not.toBe(b.id)
  })

  test('identity can sign and verify tokens', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const identity = await store.provideIdentity('0')
    const token = await identity.signToken({ data: 'test' })
    expect(token.payload.iss).toBe(identity.id)
    const verified = await verifyToken(`${token.data}.${token.signature}`)
    expect(verified.payload.data).toBe('test')
  })

  test('identity can perform ECDH key agreement', async () => {
    const store = HDKeyStore.fromMnemonic(MNEMONIC)
    const identity = await store.provideIdentity('0')
    const { x25519 } = await import('@noble/curves/ed25519.js')
    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = x25519.getPublicKey(ephPriv)
    const shared = await identity.agreeKey(ephPub)
    expect(shared).toBeInstanceOf(Uint8Array)
    expect(shared.length).toBe(32)
  })

  test('same mnemonic produces same identity', async () => {
    const a = HDKeyStore.fromMnemonic(MNEMONIC)
    const b = HDKeyStore.fromMnemonic(MNEMONIC)
    const idA = await a.provideIdentity('0')
    const idB = await b.provideIdentity('0')
    expect(idA.id).toBe(idB.id)
  })
})
