import { createSignedToken, randomSigner, stringifyToken } from '@enkaku/jwt'

import {
  type CapabilityPayload,
  can,
  checkCapability,
  checkDelegationChain,
  checkExpired,
  checkValidParent,
  createCapability,
  now,
} from '../src/index.js'

describe('can()', () => {
  test('with single resource', () => {
    expect(can('foo/bar', 'foo/bar')).toBe(true)
    expect(can('foo/bar', 'foo/baz')).toBe(false)
    expect(can('foo/bar', 'foo/*')).toBe(true)
    expect(can('foo/bar', '*')).toBe(true)
    expect(can('foo/bar', '')).toBe(false)
  })

  test('with multiple resources granted, check for any match', () => {
    expect(can('foo/bar', ['foo/foo', 'foo/bar'])).toBe(true)
    expect(can('foo/bar', ['foo/foo', 'foo/baz'])).toBe(false)
    expect(can('foo/bar', ['foo/foo', 'foo/*'])).toBe(true)
    expect(can('foo/bar', ['foo/foo', '*'])).toBe(true)
    expect(can('foo/bar', ['foo/foo', ''])).toBe(false)
  })

  test('with multiple resources expected, check for every match', () => {
    expect(can(['foo/foo', 'foo/bar'], ['foo/foo', 'foo/bar'])).toBe(true)
    expect(can(['foo/foo', 'foo/bar'], ['foo/foo', 'foo/baz'])).toBe(false)
    expect(can(['foo/foo', 'foo/bar'], ['foo/foo', 'foo/*'])).toBe(true)
    expect(can(['foo/foo', 'foo/bar'], ['foo/foo', ''])).toBe(false)
    expect(can(['foo/foo', 'foo/bar'], 'foo/*')).toBe(true)
    expect(can(['foo/foo', 'foo/bar'], '*')).toBe(true)
    expect(can(['foo/foo', 'foo/bar'], '')).toBe(false)
  })
})

describe('checkExpired()', () => {
  test('with no expiration', () => {
    expect(() => checkExpired({})).not.toThrow()
    expect(() => checkExpired({ exp: undefined })).not.toThrow()
  })

  test('with valid expiration', () => {
    const exp = now() + 1000
    expect(() => checkExpired({ exp })).not.toThrow()
    expect(() => checkExpired({ exp }, exp - 100)).not.toThrow()
  })

  test('with invalid expiration', () => {
    const exp = now() - 1000
    expect(() => checkExpired({ exp })).toThrow('Invalid token: expired')
    expect(() => checkExpired({ exp: exp - 1000 }, exp)).toThrow('Invalid token: expired')
  })
})

describe('checkValidParent()', () => {
  test('checks matching issuer and audience', () => {
    expect(() => {
      checkValidParent(
        { iss: 'did:test:123' } as CapabilityPayload,
        { aud: 'did:test:123' } as CapabilityPayload,
      )
    }).not.toThrow()
    expect(() => {
      checkValidParent(
        { iss: 'did:test:123' } as CapabilityPayload,
        { aud: 'did:test:456' } as CapabilityPayload,
      )
    }).toThrow('Invalid capability: audience mismatch')
  })

  test('checks matching subject', () => {
    expect(() => {
      checkValidParent(
        { iss: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
        { aud: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
      )
    }).not.toThrow()
    expect(() => {
      checkValidParent(
        { iss: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
        { aud: 'did:test:123', sub: 'did:test:789' } as CapabilityPayload,
      )
    }).toThrow('Invalid capability: subject mismatch')
  })

  test('checks expired parent', () => {
    expect(() => {
      checkValidParent(
        { iss: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
        { aud: 'did:test:123', sub: 'did:test:456', exp: now() + 1000 } as CapabilityPayload,
      )
    }).not.toThrow()
    expect(() => {
      checkValidParent(
        { iss: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
        { aud: 'did:test:123', sub: 'did:test:456', exp: now() - 1000 } as CapabilityPayload,
      )
    }).toThrow('Invalid token: expired')
  })

  test('checks matching resources', () => {
    expect(() => {
      checkValidParent(
        {
          iss: 'did:test:123',
          sub: 'did:test:456',
          res: ['foo/bar', 'foo/baz'],
        } as CapabilityPayload,
        { aud: 'did:test:123', sub: 'did:test:456', res: ['foo/*'] } as CapabilityPayload,
      )
    }).not.toThrow()
    expect(() => {
      checkValidParent(
        {
          iss: 'did:test:123',
          sub: 'did:test:456',
          res: ['foo/bar', 'foo/baz'],
        } as CapabilityPayload,
        {
          aud: 'did:test:123',
          sub: 'did:test:456',
          res: ['foo/bar', 'foo/foo'],
        } as CapabilityPayload,
      )
    }).toThrow('Invalid capability: resource mismatch')
  })
})

describe('checkDelegationChain()', () => {
  test('last payload should be issued by subject and not expired', async () => {
    await expect(
      checkDelegationChain({ iss: 'did:test:123', sub: 'did:test:123' } as CapabilityPayload, []),
    ).resolves.toBeUndefined()
    await expect(async () => {
      await checkDelegationChain(
        { iss: 'did:test:123', sub: 'did:test:123', exp: now() - 1000 } as CapabilityPayload,
        [],
      )
    }).rejects.toThrow('Invalid token: expired')
    await expect(async () => {
      await checkDelegationChain(
        { iss: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
        [],
      )
    }).rejects.toThrow('Invalid capability: issuer should be subject')
  })

  test('validates the full chain', async () => {
    const [signerA, signerB, signerC, signerD] = await Promise.all([
      randomSigner(),
      randomSigner(),
      randomSigner(),
      randomSigner(),
    ])
    const delegateToB = await createCapability(signerA, {
      sub: signerA.did,
      aud: signerB.did,
      res: ['foo/*'],
    })
    const delegateToC = await createCapability(signerB, {
      sub: signerA.did,
      aud: signerC.did,
      res: ['foo/bar', 'foo/baz'],
    })
    const delegateToD = await createCapability(signerC, {
      sub: signerA.did,
      aud: signerD.did,
      res: ['foo/baz'],
    })
    await expect(
      checkDelegationChain(delegateToD.payload, [
        stringifyToken(delegateToC),
        stringifyToken(delegateToB),
      ]),
    ).resolves.not.toThrow()
  })
})

describe('checkCapability()', () => {
  test('validates the full chain', async () => {
    const [signerA, signerB, signerC, signerD] = await Promise.all([
      randomSigner(),
      randomSigner(),
      randomSigner(),
      randomSigner(),
    ])
    const delegateToB = await createCapability(signerA, {
      sub: signerA.did,
      aud: signerB.did,
      res: ['foo/*'],
    })
    const delegateToC = await createCapability(signerB, {
      sub: signerA.did,
      aud: signerC.did,
      res: ['foo/bar', 'foo/baz'],
    })
    const delegateToD = await createCapability(signerC, {
      sub: signerA.did,
      aud: signerD.did,
      res: ['foo/baz'],
    })
    const token = await createSignedToken(signerD, {
      sub: signerA.did,
      cmd: 'foo/baz',
      cap: [stringifyToken(delegateToD), stringifyToken(delegateToC), stringifyToken(delegateToB)],
    })
    await expect(checkCapability('foo/baz', token.payload)).resolves.not.toThrow()
  })
})
