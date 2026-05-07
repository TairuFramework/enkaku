import { createCapability } from '@enkaku/capability'
import type { AnyClientPayloadOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity, stringifyToken } from '@enkaku/token'
import { describe, expect, test, vi } from 'vitest'

import { type AllowContext, checkClientToken } from '../src/access-control.js'

type Payload = AnyClientPayloadOf<ProtocolDefinition>

describe('access control: predicate variant', () => {
  test('predicate accepts on iss', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    const predicate = vi.fn(({ payload }: AllowContext) => payload.iss === clientSigner.id)

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/test': { allow: predicate },
        },
        token,
      ),
    ).resolves.toBeUndefined()

    expect(predicate).toHaveBeenCalledTimes(1)
  })

  test('predicate rejects → Access denied', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/test': { allow: () => false },
        },
        token,
      ),
    ).rejects.toThrow('Access denied')
  })

  test('predicate that throws propagates the error', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/test': {
            allow: () => {
              throw new Error('predicate boom')
            },
          },
        },
        token,
      ),
    ).rejects.toThrow('predicate boom')
  })

  test('predicate that rejects propagates the rejection', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/test': {
            allow: async () => {
              throw new Error('predicate async boom')
            },
          },
        },
        token,
      ),
    ).rejects.toThrow('predicate async boom')
  })

  test('predicate receives full AllowContext', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    const predicate = vi.fn<(ctx: AllowContext) => boolean>(() => true)

    await checkClientToken(
      serverSigner.id,
      {
        'enkaku:graph/*': { allow: predicate },
      },
      token,
    )

    expect(predicate).toHaveBeenCalledTimes(1)
    const ctx = predicate.mock.calls[0]?.[0]
    expect(ctx).toBeDefined()
    if (ctx == null) return
    expect(ctx.pattern).toBe('enkaku:graph/*')
    expect(ctx.procedure).toBe('enkaku:graph/test')
    expect(ctx.serverID).toBe(serverSigner.id)
    expect(ctx.payload.iss).toBe(clientSigner.id)
    expect(typeof ctx.verifyDelegation).toBe('function')
  })

  test('predicate sync return is awaited correctly', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/test': { allow: () => true },
        },
        token,
      ),
    ).resolves.toBeUndefined()
  })

  test('predicate async return is awaited correctly', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/test': { allow: async () => true },
        },
        token,
      ),
    ).resolves.toBeUndefined()
  })

  test('verifyDelegation returns true on a valid chain', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const delegation = await createCapability(serverSigner, {
      aud: clientSigner.id,
      sub: serverSigner.id,
      act: 'enkaku:graph/*',
      res: serverSigner.id,
    })
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
      sub: serverSigner.id,
      cap: stringifyToken(delegation),
    } as unknown as Payload)

    const predicate = vi.fn(async ({ payload, verifyDelegation }: AllowContext) => {
      if (payload.sub === serverSigner.id) return await verifyDelegation()
      return false
    })

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/*': { allow: predicate },
        },
        token,
      ),
    ).resolves.toBeUndefined()
  })

  test('verifyDelegation returns false when sub is missing', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    const predicate = vi.fn(async ({ verifyDelegation }: AllowContext) => {
      return await verifyDelegation()
    })

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/test': { allow: predicate },
        },
        token,
      ),
    ).rejects.toThrow('Access denied')
  })

  test('predicate replicating array form admits same iss', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    const allowList = [clientSigner.id]

    const predicate = async ({ payload, verifyDelegation }: AllowContext) => {
      if (allowList.includes(payload.iss)) return true
      if (payload.sub != null && allowList.includes(payload.sub)) {
        return await verifyDelegation()
      }
      return false
    }

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/test': { allow: predicate },
        },
        token,
      ),
    ).resolves.toBeUndefined()

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/test': { allow: allowList },
        },
        token,
      ),
    ).resolves.toBeUndefined()
  })

  test('first matching predicate that returns true wins', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    const first = vi.fn(() => false)
    const second = vi.fn(() => true)
    const third = vi.fn(() => true)

    await expect(
      checkClientToken(
        serverSigner.id,
        {
          'enkaku:graph/*': { allow: first },
          'enkaku:graph/test': { allow: second },
          '*': { allow: third },
        },
        token,
      ),
    ).resolves.toBeUndefined()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(third).not.toHaveBeenCalled()
  })
})
