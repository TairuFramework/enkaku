import { randomTokenSigner, stringifyToken } from '@enkaku/token'

import {
  type CapabilityPayload,
  assertNonExpired,
  assertValidDelegation,
  checkCapability,
  checkDelegationChain,
  createCapability,
  hasPermission,
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
    const [didA, didB, didC, didD] = await Promise.all([
      signerA.getIssuer(),
      signerB.getIssuer(),
      signerC.getIssuer(),
      signerD.getIssuer(),
    ])
    const delegateToB = await createCapability(signerA, {
      sub: didA,
      aud: didB,
      act: '*',
      res: 'foo/*',
    })
    const delegateToC = await createCapability(signerB, {
      sub: didA,
      aud: didC,
      act: 'test/*',
      res: ['foo/bar', 'foo/baz'],
    })
    const delegateToD = await createCapability(signerC, {
      sub: didA,
      aud: didD,
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
    const [didA, didB, didC, didD] = await Promise.all([
      signerA.getIssuer(),
      signerB.getIssuer(),
      signerC.getIssuer(),
      signerD.getIssuer(),
    ])
    const delegateToB = await createCapability(signerA, {
      sub: didA,
      aud: didB,
      act: '*',
      res: ['foo/*'],
    })
    const delegateToC = await createCapability(signerB, {
      sub: didA,
      aud: didC,
      act: 'test/*',
      res: ['foo/bar', 'foo/baz'],
    })
    const delegateToD = await createCapability(signerC, {
      sub: didA,
      aud: didD,
      act: 'test/*',
      res: ['foo/baz'],
    })
    const token = await signerD.createToken({
      sub: didA,
      cmd: 'test/call',
      cap: [stringifyToken(delegateToD), stringifyToken(delegateToC), stringifyToken(delegateToB)],
    })
    await expect(
      checkCapability({ act: 'test/call', res: 'foo/baz' }, token.payload),
    ).resolves.not.toThrow()
  })
})
