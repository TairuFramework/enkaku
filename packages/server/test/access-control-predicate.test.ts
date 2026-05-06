import type { AnyClientPayloadOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
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
})
