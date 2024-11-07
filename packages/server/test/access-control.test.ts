import { createCapability } from '@enkaku/capability'
import type { AnyClientPayloadOf, AnyDefinitions } from '@enkaku/protocol'
import { randomTokenSigner, stringifyToken } from '@enkaku/token'

import { checkClientToken } from '../src/access-control.js'

type Payload = AnyClientPayloadOf<AnyDefinitions>

describe('access control', () => {
  describe('using server signer', () => {
    test('server signer can access all commands', async () => {
      const signer = randomTokenSigner()
      const token = await signer.createToken({ cmd: 'kubun:test/test' } as Payload)
      const issuer = await signer.getIssuer()
      await expect(checkClientToken(issuer, { '*': false }, token)).resolves.toBeUndefined()
    })

    test('with delegation', async () => {
      const serverSigner = randomTokenSigner()
      const clientSigner = randomTokenSigner()
      const [serverID, clientID] = await Promise.all([
        serverSigner.getIssuer(),
        clientSigner.getIssuer(),
      ])
      const delegation = await createCapability(serverSigner, {
        aud: clientID,
        sub: serverID,
        act: 'kubun:graph/*',
        res: serverID,
      })
      const token = await clientSigner.createToken({
        cmd: 'kubun:graph/test',
        aud: serverID,
        sub: serverID,
        cap: stringifyToken(delegation),
      } as unknown as Payload)
      await expect(checkClientToken(serverID, { '*': false }, token)).resolves.toBeUndefined()
    })

    test('audience check', async () => {
      const signer = randomTokenSigner()
      const token = await signer.createToken({
        cmd: 'kubun:test/test',
        aud: 'did:test:123',
      } as unknown as Payload)
      const issuer = await signer.getIssuer()
      await expect(async () => {
        await checkClientToken(issuer, { '*': false }, token)
      }).rejects.toThrow('Invalid audience')
    })

    test('expiration check', async () => {
      const signer = randomTokenSigner()
      const token = await signer.createToken({
        cmd: 'kubun:test/test',
        exp: 1000,
      } as unknown as Payload)
      const issuer = await signer.getIssuer()
      await expect(async () => {
        await checkClientToken(issuer, { '*': false }, token)
      }).rejects.toThrow('Invalid token: expired')
    })
  })

  describe('public access', () => {
    test('can execute allowed commands', async () => {
      const serverSigner = randomTokenSigner()
      const clientSigner = randomTokenSigner()
      const serverID = await serverSigner.getIssuer()
      const token = await clientSigner.createToken({
        cmd: 'kubun:graph/test',
        aud: serverID,
      } as unknown as Payload)
      await expect(
        checkClientToken(serverID, { '*': false, 'kubun:graph/test': true }, token),
      ).resolves.toBeUndefined()
    })
  })

  describe('allow-list access', () => {
    test('can execute allowed commands', async () => {
      const serverSigner = randomTokenSigner()
      const clientSigner = randomTokenSigner()
      const [serverID, clientID] = await Promise.all([
        serverSigner.getIssuer(),
        clientSigner.getIssuer(),
      ])
      const token = await clientSigner.createToken({
        cmd: 'kubun:graph/test',
        aud: serverID,
      } as unknown as Payload)
      await expect(
        checkClientToken(serverID, { '*': false, 'kubun:graph/test': [clientID] }, token),
      ).resolves.toBeUndefined()
    })

    test('with delegation', async () => {
      const serverSigner = randomTokenSigner()
      const delegationSigner = randomTokenSigner()
      const clientSigner = randomTokenSigner()
      const [serverID, delegationID, clientID] = await Promise.all([
        serverSigner.getIssuer(),
        delegationSigner.getIssuer(),
        clientSigner.getIssuer(),
      ])
      // Delegation signer is subject, audience is client to grant access to and resource is server
      const delegation = await createCapability(delegationSigner, {
        aud: clientID,
        sub: delegationID,
        act: 'kubun:graph/*',
        res: serverID,
      })
      const token = await clientSigner.createToken({
        cmd: 'kubun:graph/test',
        aud: serverID,
        sub: delegationID,
        cap: stringifyToken(delegation),
      } as unknown as Payload)
      await expect(
        checkClientToken(serverID, { '*': false, 'kubun:graph/test': [delegationID] }, token),
      ).resolves.toBeUndefined()
    })
  })
})
