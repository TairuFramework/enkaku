import { createCapability } from '@enkaku/capability'
import type { AnyClientPayloadOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity, stringifyToken } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import { checkClientToken, type ProcedureAccessConfig } from '../src/access-control.js'

type Payload = AnyClientPayloadOf<ProtocolDefinition>

describe('access control', () => {
  describe('using server signer', () => {
    test('server signer can access all procedures', async () => {
      const signer = randomIdentity()
      const token = await signer.signToken({ prc: 'enkaku:test/test' } as Payload)
      await expect(checkClientToken(signer.id, { '*': false }, token)).resolves.toBeUndefined()
    })

    test('with delegation', async () => {
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
      await expect(
        checkClientToken(serverSigner.id, { '*': false }, token),
      ).resolves.toBeUndefined()
    })

    test('audience check', async () => {
      const signer = randomIdentity()
      const token = await signer.signToken({
        prc: 'enkaku:test/test',
        aud: 'did:test:123',
      } as unknown as Payload)
      await expect(async () => {
        await checkClientToken(signer.id, { '*': false }, token)
      }).rejects.toThrow('Invalid audience')
    })

    test('expiration check', async () => {
      const signer = randomIdentity()
      const token = await signer.signToken({
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
      const serverSigner = randomIdentity()
      const clientSigner = randomIdentity()
      const token = await clientSigner.signToken({
        prc: 'enkaku:graph/test',
        aud: serverSigner.id,
      } as unknown as Payload)
      await expect(
        checkClientToken(serverSigner.id, { '*': false, 'enkaku:graph/test': true }, token),
      ).resolves.toBeUndefined()
    })
  })

  describe('ProcedureAccessConfig with encryption', () => {
    test('config with allow: true acts as public access', async () => {
      const serverSigner = randomIdentity()
      const clientSigner = randomIdentity()
      const token = await clientSigner.signToken({
        prc: 'enkaku:graph/test',
        aud: serverSigner.id,
      } as unknown as Payload)
      const config: ProcedureAccessConfig = { allow: true, encryption: 'required' }
      await expect(
        checkClientToken(serverSigner.id, { '*': false, 'enkaku:graph/test': config }, token),
      ).resolves.toBeUndefined()
    })

    test('config with allow: false denies access', async () => {
      const serverSigner = randomIdentity()
      const clientSigner = randomIdentity()
      const token = await clientSigner.signToken({
        prc: 'enkaku:graph/test',
        aud: serverSigner.id,
      } as unknown as Payload)
      const config: ProcedureAccessConfig = { allow: false, encryption: 'optional' }
      await expect(
        checkClientToken(serverSigner.id, { '*': false, 'enkaku:graph/test': config }, token),
      ).rejects.toThrow('Access denied')
    })

    test('config with allow-list works like array access', async () => {
      const serverSigner = randomIdentity()
      const clientSigner = randomIdentity()
      const token = await clientSigner.signToken({
        prc: 'enkaku:graph/test',
        aud: serverSigner.id,
      } as unknown as Payload)
      const config: ProcedureAccessConfig = {
        allow: [clientSigner.id],
        encryption: 'required',
      }
      await expect(
        checkClientToken(serverSigner.id, { '*': false, 'enkaku:graph/test': config }, token),
      ).resolves.toBeUndefined()
    })

    test('config without allow defaults to deny', async () => {
      const serverSigner = randomIdentity()
      const clientSigner = randomIdentity()
      const token = await clientSigner.signToken({
        prc: 'enkaku:graph/test',
        aud: serverSigner.id,
      } as unknown as Payload)
      const config: ProcedureAccessConfig = { encryption: 'required' }
      await expect(
        checkClientToken(serverSigner.id, { '*': false, 'enkaku:graph/test': config }, token),
      ).rejects.toThrow('Access denied')
    })
  })

  describe('allow-list access', () => {
    test('can execute allowed procedures', async () => {
      const serverSigner = randomIdentity()
      const clientSigner = randomIdentity()
      const token = await clientSigner.signToken({
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
      const serverSigner = randomIdentity()
      const delegationSigner = randomIdentity()
      const clientSigner = randomIdentity()
      // Delegation signer is subject, audience is client to grant access to and resource is server
      const delegation = await createCapability(delegationSigner, {
        aud: clientSigner.id,
        sub: delegationSigner.id,
        act: 'enkaku:graph/*',
        res: serverSigner.id,
      })
      const token = await clientSigner.signToken({
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
