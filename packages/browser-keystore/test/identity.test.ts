import { beforeAll, describe, expect, test, vi } from 'vitest'

// Use vi.hoisted so the mock fn is available inside the hoisted vi.mock factory
const { mockProvideAsync } = vi.hoisted(() => ({
  mockProvideAsync: vi.fn(),
}))

let testKeyPair: CryptoKeyPair

vi.mock('../src/store.js', () => ({
  BrowserKeyStore: {
    open: vi.fn().mockResolvedValue({
      entry: vi.fn().mockReturnValue({
        provideAsync: mockProvideAsync,
      }),
    }),
  },
}))

import { provideSigningIdentity } from '../src/identity.js'

beforeAll(async () => {
  testKeyPair = (await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )) as CryptoKeyPair
  mockProvideAsync.mockResolvedValue(testKeyPair)
})

describe('provideSigningIdentity()', () => {
  test('returns identity with valid DID', async () => {
    const identity = await provideSigningIdentity('test-key')
    expect(identity.id).toMatch(/^did:key:z/)
  })

  test('returns identity with signToken function', async () => {
    const identity = await provideSigningIdentity('test-key')
    expect(identity.signToken).toBeInstanceOf(Function)
  })

  test('signs token with ES256 algorithm', async () => {
    const identity = await provideSigningIdentity('test-key')
    const token = await identity.signToken({ test: true })
    expect(token.header.alg).toBe('ES256')
    expect(token.header.typ).toBe('JWT')
  })

  test('signed token includes issuer matching identity', async () => {
    const identity = await provideSigningIdentity('test-key')
    const token = await identity.signToken({ foo: 'bar' })
    expect(token.payload.iss).toBe(identity.id)
    expect(token.payload.foo).toBe('bar')
  })

  test('signed token has valid JWT structure', async () => {
    const identity = await provideSigningIdentity('test-key')
    const token = await identity.signToken({ x: 1 })
    expect(token.data).toContain('.')
    expect(token.signature).toBeDefined()
    expect(token.signature.length).toBeGreaterThan(0)
  })

  test('rejects payload with mismatched issuer', async () => {
    const identity = await provideSigningIdentity('test-key')
    await expect(identity.signToken({ iss: 'did:key:wrong' })).rejects.toThrow('Invalid payload')
  })

  test('accepts payload with matching issuer', async () => {
    const identity = await provideSigningIdentity('test-key')
    const token = await identity.signToken({ iss: identity.id })
    expect(token.payload.iss).toBe(identity.id)
  })

  test('accepts string store parameter', async () => {
    const identity = await provideSigningIdentity('test-key', 'custom-db')
    expect(identity.id).toMatch(/^did:key:z/)
  })
})
