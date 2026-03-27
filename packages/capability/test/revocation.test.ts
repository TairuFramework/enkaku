import { randomIdentity, stringifyToken } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import { checkDelegationChain, createCapability, now } from '../src/index.js'
import {
  createMemoryRevocationBackend,
  createRevocationChecker,
  createRevocationRecord,
} from '../src/revocation.js'

describe('revocation', () => {
  test('createMemoryRevocationBackend tracks revocations', async () => {
    const backend = createMemoryRevocationBackend()
    expect(await backend.isRevoked('some-jti')).toBe(false)
    await backend.add({ jti: 'some-jti', iss: 'did:key:alice', rev: true, iat: now() })
    expect(await backend.isRevoked('some-jti')).toBe(true)
  })

  test('createRevocationChecker returns a VerifyTokenHook', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)
    expect(typeof checker).toBe('function')
  })

  test('checker passes for non-revoked token', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)

    const signer = randomIdentity()
    const capability = await createCapability(signer, {
      sub: signer.id,
      aud: 'did:key:bob',
      act: '*',
      res: '*',
      jti: 'cap-1',
    })

    // Should not throw
    await checker(capability, stringifyToken(capability))
  })

  test('checker rejects revoked token', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)

    const signer = randomIdentity()
    const capability = await createCapability(signer, {
      sub: signer.id,
      aud: 'did:key:bob',
      act: '*',
      res: '*',
      jti: 'cap-revoked',
    })

    await backend.add({ jti: 'cap-revoked', iss: signer.id, rev: true, iat: now() })

    await expect(checker(capability, stringifyToken(capability))).rejects.toThrow('revoked')
  })

  test('checker integrates with checkDelegationChain', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)

    const root = randomIdentity()
    const device = randomIdentity()

    const delegation = await createCapability(root, {
      sub: root.id,
      aud: device.id,
      act: '*',
      res: '*',
      jti: 'delegation-1',
    })

    const subDelegation = await createCapability(
      device,
      {
        sub: root.id,
        aud: 'did:key:service',
        act: 'read',
        res: 'data/*',
        jti: 'sub-delegation-1',
      },
      undefined,
      { parentCapability: stringifyToken(delegation) },
    )

    // Valid before revocation
    await checkDelegationChain(subDelegation.payload, [stringifyToken(delegation)], {
      verifyToken: checker,
    })

    // Revoke root delegation
    await backend.add({ jti: 'delegation-1', iss: root.id, rev: true, iat: now() })

    // Should fail after revocation
    await expect(
      checkDelegationChain(subDelegation.payload, [stringifyToken(delegation)], {
        verifyToken: checker,
      }),
    ).rejects.toThrow('revoked')
  })

  test('createRevocationRecord produces a signed revocation', async () => {
    const signer = randomIdentity()
    const record = await createRevocationRecord(signer, 'cap-to-revoke')
    expect(record.jti).toBe('cap-to-revoke')
    expect(record.iss).toBe(signer.id)
    expect(record.rev).toBe(true)
    expect(typeof record.iat).toBe('number')
  })
})
