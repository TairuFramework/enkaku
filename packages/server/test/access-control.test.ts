import { createCapability } from '@enkaku/capability'
import type { AnyClientPayloadOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomTokenSigner, stringifyToken } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import { checkClientToken } from '../src/access-control.js'

type Payload = AnyClientPayloadOf<ProtocolDefinition>

describe('access control', () => {
  describe('using server signer', () => {
    test('server signer can access all procedures', async () => {
      const signer = randomTokenSigner()
      const token = await signer.createToken({ prc: 'enkaku:test/test' } as Payload)
      await expect(checkClientToken(signer.id, { '*': false }, token)).resolves.toBeUndefined()
    })

    test('with delegation', async () => {
      const serverSigner = randomTokenSigner()
      const clientSigner = randomTokenSigner()
      const delegation = await createCapability(serverSigner, {
        aud: clientSigner.id,
        sub: serverSigner.id,
        act: 'enkaku:graph/*',
        res: serverSigner.id,
      })
      const token = await clientSigner.createToken({
        prc: 'enkaku:graph/test',
        aud: serverSigner.id,
        sub: serverSigner.id,
        cap: stringifyToken(delegation),
      } as unknown as Payload)
      await expect(
        checkClientToken(serverSigner.id, { '*': false }, token),
      ).resolves.toBeUndefined()
    })

    test('audience check', async () => {
      const signer = randomTokenSigner()
      const token = await signer.createToken({
        prc: 'enkaku:test/test',
        aud: 'did:test:123',
      } as unknown as Payload)
      await expect(async () => {
        await checkClientToken(signer.id, { '*': false }, token)
      }).rejects.toThrow('Invalid audience')
    })

    test('expiration check', async () => {
      const signer = randomTokenSigner()
      const token = await signer.createToken({
        prc: 'enkaku:test/test',
        exp: 1000,
      } as unknown as Payload)
      await expect(async () => {
        await checkClientToken(signer.id, { '*': false }, token)
      }).rejects.toThrow('Invalid token: expired')
    })
  })

  describe('public access', () => {
    test('can execute allowed procedures', async () => {
      const serverSigner = randomTokenSigner()
      const clientSigner = randomTokenSigner()
      const token = await clientSigner.createToken({
        prc: 'enkaku:graph/test',
        aud: serverSigner.id,
      } as unknown as Payload)
      await expect(
        checkClientToken(serverSigner.id, { '*': false, 'enkaku:graph/test': true }, token),
      ).resolves.toBeUndefined()
    })
  })

  describe('allow-list access', () => {
    test('can execute allowed procedures', async () => {
      const serverSigner = randomTokenSigner()
      const clientSigner = randomTokenSigner()
      const token = await clientSigner.createToken({
        prc: 'enkaku:graph/test',
        aud: serverSigner.id,
      } as unknown as Payload)
      await expect(
        checkClientToken(
          serverSigner.id,
          { '*': false, 'enkaku:graph/test': [clientSigner.id] },
          token,
        ),
      ).resolves.toBeUndefined()
    })

    test('with delegation', async () => {
      const serverSigner = randomTokenSigner()
      const delegationSigner = randomTokenSigner()
      const clientSigner = randomTokenSigner()
      // Delegation signer is subject, audience is client to grant access to and resource is server
      const delegation = await createCapability(delegationSigner, {
        aud: clientSigner.id,
        sub: delegationSigner.id,
        act: 'enkaku:graph/*',
        res: serverSigner.id,
      })
      const token = await clientSigner.createToken({
        prc: 'enkaku:graph/test',
        aud: serverSigner.id,
        sub: delegationSigner.id,
        cap: stringifyToken(delegation),
      } as unknown as Payload)
      await expect(
        checkClientToken(
          serverSigner.id,
          { '*': false, 'enkaku:graph/test': [delegationSigner.id] },
          token,
        ),
      ).resolves.toBeUndefined()
    })
  })
})
