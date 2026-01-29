import { randomTokenSigner, stringifyToken } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import {
  assertNonExpired,
  assertValidDelegation,
  type CapabilityPayload,
  checkCapability,
  checkDelegationChain,
  createCapability,
  hasPermission,
  isCapabilityToken,
  now,
} from '../src/index.js'

describe('hasPermission()', () => {
  test('with single action and resource', () => {
    // Same action, different resources
    expect(
      hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: 'test/read', res: 'foo/bar' }),
    ).toBe(true)
    expect(
      hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: 'test/read', res: 'foo/baz' }),
    ).toBe(false)
    expect(
      hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: 'test/read', res: 'foo/*' }),
    ).toBe(true)
    expect(
      hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: 'test/read', res: '*' }),
    ).toBe(true)
    expect(hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: 'test/read', res: '' })).toBe(
      false,
    )
    // Same resource, different actions
    expect(
      hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: 'test/read', res: 'foo/bar' }),
    ).toBe(true)

    expect(
      hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: 'test/write', res: 'foo/bar' }),
    ).toBe(false)
    expect(
      hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: 'test/*', res: 'foo/bar' }),
    ).toBe(true)
    expect(hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: '*', res: 'foo/bar' })).toBe(
      true,
    )
    expect(hasPermission({ act: 'test/read', res: 'foo/bar' }, { act: '', res: 'foo/bar' })).toBe(
      false,
    )
  })

  test('with multiple actions or resources granted, check for any match', () => {
    // Same action, different resources
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: 'test/read', res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: 'test/read', res: ['foo/foo', 'foo/baz'] },
      ),
    ).toBe(false)
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: 'test/read', res: ['foo/foo', 'foo/*'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: 'test/read', res: ['foo/foo', '*'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: 'test/read', res: ['foo/foo', ''] },
      ),
    ).toBe(false)
    // Same resource, different actions
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: ['test/other', 'test/read'], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: ['test/other', 'test/write'], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(false)
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: ['test/other', 'test/*'], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: ['test/other', '*'], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: 'foo/bar' },
        { act: ['test/other', ''], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(false)
  })

  test('with multiple actions or resources expected, check for every match', () => {
    // Same action, different resources
    expect(
      hasPermission(
        { act: 'test/read', res: ['foo/foo', 'foo/bar'] },
        { act: 'test/read', res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: ['foo/foo', 'foo/bar'] },
        { act: 'test/read', res: ['foo/foo', 'foo/baz'] },
      ),
    ).toBe(false)
    expect(
      hasPermission(
        { act: 'test/read', res: ['foo/foo', 'foo/bar'] },
        { act: 'test/read', res: ['foo/foo', 'foo/*'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: ['foo/foo', 'foo/bar'] },
        { act: 'test/read', res: ['foo/foo', ''] },
      ),
    ).toBe(false)
    expect(
      hasPermission(
        { act: 'test/read', res: ['foo/foo', 'foo/bar'] },
        { act: 'test/read', res: 'foo/*' },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: ['foo/foo', 'foo/bar'] },
        { act: 'test/read', res: '*' },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: 'test/read', res: ['foo/foo', 'foo/bar'] },
        { act: 'test/read', res: '' },
      ),
    ).toBe(false)
    // Same resource, different actions
    expect(
      hasPermission(
        { act: ['test/read', 'test/write'], res: ['foo/foo', 'foo/bar'] },
        { act: ['test/read', 'test/write'], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: ['test/read', 'test/delete'], res: ['foo/foo', 'foo/bar'] },
        { act: ['test/read', 'test/write'], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(false)
    expect(
      hasPermission(
        { act: ['test/read', 'test/write'], res: ['foo/foo', 'foo/bar'] },
        { act: ['test/read'], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(false)
    expect(
      hasPermission(
        { act: ['test/read', 'test/write'], res: ['foo/foo', 'foo/bar'] },
        { act: ['test/read', 'test/*'], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: ['test/read', 'test/write'], res: ['foo/foo', 'foo/bar'] },
        { act: ['test/read', '*'], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(true)
    expect(
      hasPermission(
        { act: ['test/read', 'test/write'], res: ['foo/foo', 'foo/bar'] },
        { act: ['test/read', ''], res: ['foo/foo', 'foo/bar'] },
      ),
    ).toBe(false)
  })
})

describe('assertNonExpired()', () => {
  test('with no expiration', () => {
    expect(() => assertNonExpired({})).not.toThrow()
    expect(() => assertNonExpired({ exp: undefined })).not.toThrow()
  })

  test('with valid expiration', () => {
    const exp = now() + 1000
    expect(() => assertNonExpired({ exp })).not.toThrow()
    expect(() => assertNonExpired({ exp }, exp - 100)).not.toThrow()
  })

  test('with invalid expiration', () => {
    const exp = now() - 1000
    expect(() => assertNonExpired({ exp })).toThrow('Invalid token: expired')
    expect(() => assertNonExpired({ exp: exp - 1000 }, exp)).toThrow('Invalid token: expired')
  })
})

describe('assertValidDelegation()', () => {
  test('checks matching issuer and audience', () => {
    expect(() => {
      assertValidDelegation(
        { aud: 'did:test:123' } as CapabilityPayload,
        { iss: 'did:test:123' } as CapabilityPayload,
      )
    }).not.toThrow()
    expect(() => {
      assertValidDelegation(
        { aud: 'did:test:456' } as CapabilityPayload,
        { iss: 'did:test:123' } as CapabilityPayload,
      )
    }).toThrow('Invalid capability: audience mismatch')
  })

  test('checks matching subject', () => {
    expect(() => {
      assertValidDelegation(
        { aud: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
        { iss: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
      )
    }).not.toThrow()
    expect(() => {
      assertValidDelegation(
        { aud: 'did:test:123', sub: 'did:test:789' } as CapabilityPayload,
        { iss: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
      )
    }).toThrow('Invalid capability: subject mismatch')
  })

  test('checks expired parent', () => {
    expect(() => {
      assertValidDelegation(
        { aud: 'did:test:123', sub: 'did:test:456', exp: now() + 1000 } as CapabilityPayload,
        { iss: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
      )
    }).not.toThrow()
    expect(() => {
      assertValidDelegation(
        { aud: 'did:test:123', sub: 'did:test:456', exp: now() - 1000 } as CapabilityPayload,
        { iss: 'did:test:123', sub: 'did:test:456' } as CapabilityPayload,
      )
    }).toThrow('Invalid token: expired')
  })

  test('checks matching actions and resources', () => {
    expect(() => {
      assertValidDelegation(
        {
          aud: 'did:test:123',
          sub: 'did:test:456',
          act: 'test',
          res: 'foo/*',
        } as CapabilityPayload,
        {
          iss: 'did:test:123',
          sub: 'did:test:456',
          act: 'test',
          res: ['foo/bar', 'foo/baz'],
        } as CapabilityPayload,
      )
    }).not.toThrow()
    expect(() => {
      assertValidDelegation(
        {
          aud: 'did:test:123',
          sub: 'did:test:456',
          act: 'test',
          res: ['foo/bar', 'foo/foo'],
        } as CapabilityPayload,
        {
          iss: 'did:test:123',
          sub: 'did:test:456',
          act: 'test',
          res: ['foo/bar', 'foo/baz'],
        } as CapabilityPayload,
      )
    }).toThrow('Invalid capability: permission mismatch')
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
    const signerA = randomTokenSigner()
    const signerB = randomTokenSigner()
    const signerC = randomTokenSigner()
    const signerD = randomTokenSigner()
    const delegateToB = await createCapability(signerA, {
      sub: signerA.id,
      aud: signerB.id,
      act: '*',
      res: 'foo/*',
    })
    const delegateToC = await createCapability(signerB, {
      sub: signerA.id,
      aud: signerC.id,
      act: 'test/*',
      res: ['foo/bar', 'foo/baz'],
    })
    const delegateToD = await createCapability(signerC, {
      sub: signerA.id,
      aud: signerD.id,
      act: ['test/read', 'test/write'],
      res: 'foo/baz',
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
    const signerA = randomTokenSigner()
    const signerB = randomTokenSigner()
    const signerC = randomTokenSigner()
    const signerD = randomTokenSigner()
    const delegateToB = await createCapability(signerA, {
      sub: signerA.id,
      aud: signerB.id,
      act: '*',
      res: ['foo/*'],
    })
    const delegateToC = await createCapability(signerB, {
      sub: signerA.id,
      aud: signerC.id,
      act: 'test/*',
      res: ['foo/bar', 'foo/baz'],
    })
    const delegateToD = await createCapability(signerC, {
      sub: signerA.id,
      aud: signerD.id,
      act: 'test/*',
      res: ['foo/baz'],
    })
    const token = await signerD.createToken({
      sub: signerA.id,
      prc: 'test/call',
      cap: [stringifyToken(delegateToD), stringifyToken(delegateToC), stringifyToken(delegateToB)],
    })
    await expect(
      checkCapability({ act: 'test/call', res: 'foo/baz' }, token.payload),
    ).resolves.not.toThrow()
  })
})

describe('checkCapability() - self-issued tokens (C-02)', () => {
  test('validates permissions even for self-issued tokens', async () => {
    const alice = randomTokenSigner()

    // Alice creates a self-issued token claiming only 'read' permission
    const token = await alice.createToken({
      sub: alice.id,
      act: 'test/read',
      res: 'foo/bar',
    })

    // Should succeed: requesting exactly what was granted
    await expect(
      checkCapability({ act: 'test/read', res: 'foo/bar' }, token.payload),
    ).resolves.not.toThrow()

    // Should FAIL: requesting 'write' when only 'read' was granted
    // BUG: Currently passes because iss === sub bypasses permission check
    await expect(
      checkCapability({ act: 'test/write', res: 'foo/bar' }, token.payload),
    ).rejects.toThrow()
  })

  test('validates resource even for self-issued tokens', async () => {
    const alice = randomTokenSigner()

    const token = await alice.createToken({
      sub: alice.id,
      act: 'test/read',
      res: 'foo/bar',
    })

    // Should FAIL: requesting different resource
    await expect(
      checkCapability({ act: 'test/read', res: 'foo/baz' }, token.payload),
    ).rejects.toThrow()
  })

  test('respects wildcard permissions for self-issued tokens', async () => {
    const alice = randomTokenSigner()

    const token = await alice.createToken({
      sub: alice.id,
      act: '*',
      res: 'foo/*',
    })

    // Should succeed: wildcard covers this
    await expect(
      checkCapability({ act: 'test/read', res: 'foo/bar' }, token.payload),
    ).resolves.not.toThrow()

    // Should fail: resource doesn't match wildcard
    await expect(
      checkCapability({ act: 'test/read', res: 'bar/baz' }, token.payload),
    ).rejects.toThrow()
  })

  test('requires act and res claims for self-issued tokens', async () => {
    const alice = randomTokenSigner()

    // Token without act/res claims
    const token = await alice.createToken({
      sub: alice.id,
    })

    await expect(
      checkCapability({ act: 'test/read', res: 'foo/bar' }, token.payload),
    ).rejects.toThrow()
  })
})

describe('checkDelegationChain() - depth limits (H-04)', () => {
  test('rejects delegation chains exceeding max depth', async () => {
    const signers = Array.from({ length: 25 }, () => randomTokenSigner())

    // Build a chain of 24 delegations (exceeds default limit of 20)
    const capabilities: Array<string> = []
    for (let i = 0; i < signers.length - 1; i++) {
      const cap = await createCapability(signers[i], {
        sub: signers[0].id,
        aud: signers[i + 1].id,
        act: '*',
        res: '*',
      })
      capabilities.push(stringifyToken(cap))
    }

    const finalPayload = {
      iss: signers[signers.length - 1].id,
      sub: signers[0].id,
      act: 'test',
      res: 'foo',
    } as CapabilityPayload

    // Should reject: chain depth exceeds limit
    await expect(
      checkDelegationChain(finalPayload, capabilities.reverse()),
    ).rejects.toThrow('delegation chain exceeds maximum depth')
  })

  test('accepts delegation chains within max depth', async () => {
    const signers = Array.from({ length: 5 }, () => randomTokenSigner())

    const capabilities: Array<string> = []
    for (let i = 0; i < signers.length - 1; i++) {
      const cap = await createCapability(signers[i], {
        sub: signers[0].id,
        aud: signers[i + 1].id,
        act: '*',
        res: '*',
      })
      capabilities.push(stringifyToken(cap))
    }

    const finalPayload = {
      iss: signers[signers.length - 1].id,
      sub: signers[0].id,
      act: 'test',
      res: 'foo',
    } as CapabilityPayload

    // Should succeed: chain depth within limit
    await expect(
      checkDelegationChain(finalPayload, capabilities.reverse()),
    ).resolves.not.toThrow()
  })

  test('respects custom maxDepth option', async () => {
    const signers = Array.from({ length: 5 }, () => randomTokenSigner())

    const capabilities: Array<string> = []
    for (let i = 0; i < signers.length - 1; i++) {
      const cap = await createCapability(signers[i], {
        sub: signers[0].id,
        aud: signers[i + 1].id,
        act: '*',
        res: '*',
      })
      capabilities.push(stringifyToken(cap))
    }

    const finalPayload = {
      iss: signers[signers.length - 1].id,
      sub: signers[0].id,
      act: 'test',
      res: 'foo',
    } as CapabilityPayload

    const reversed = [...capabilities].reverse()

    // Should reject: custom limit of 2
    await expect(
      checkDelegationChain(finalPayload, reversed, undefined, { maxDepth: 2 }),
    ).rejects.toThrow('delegation chain exceeds maximum depth')

    // Should succeed: custom limit of 10
    await expect(
      checkDelegationChain(finalPayload, reversed, undefined, { maxDepth: 10 }),
    ).resolves.not.toThrow()
  })
})
