import { createCapability } from '@enkaku/capability'
import { createSignedToken, randomSigner, stringifyToken } from '@enkaku/jwt'
import type { AnyClientPayloadOf, AnyDefinitions } from '@enkaku/protocol'

import { checkClientToken, checkCommandAccess } from '../src/access-control.js'

type Payload = AnyClientPayloadOf<AnyDefinitions>

describe('access control', () => {
  describe('using server signer', () => {
    test('server signer can access all commands', async () => {
      const signer = await randomSigner()
      const token = await createSignedToken(signer, { cmd: 'kubun:test/test' } as Payload)
      await expect(checkClientToken(signer.did, { '*': false }, token)).resolves.toBeUndefined()
    })

    test('with delegation', async () => {
      const [serverSigner, clientSigner] = await Promise.all([randomSigner(), randomSigner()])
      const delegation = await createCapability(serverSigner, {
        aud: clientSigner.did,
        sub: serverSigner.did,
        act: 'kubun:graph/*',
        res: serverSigner.did,
      })
      const token = await createSignedToken(clientSigner, {
        cmd: 'kubun:graph/test',
        aud: serverSigner.did,
        sub: serverSigner.did,
        cap: stringifyToken(delegation),
      } as Payload)
      await expect(
        checkClientToken(serverSigner.did, { '*': false }, token),
      ).resolves.toBeUndefined()
    })

    test('audience check', async () => {
      const signer = await randomSigner()
      const token = await createSignedToken(signer, {
        cmd: 'kubun:test/test',
        aud: 'did:test:123',
      } as Payload)
      await expect(async () => {
        await checkClientToken(signer.did, { '*': false }, token)
      }).rejects.toThrow('Invalid audience')
    })

    test('expiration check', async () => {
      const signer = await randomSigner()
      const token = await createSignedToken(signer, {
        cmd: 'kubun:test/test',
        exp: 1000,
      } as Payload)
      await expect(async () => {
        await checkClientToken(signer.did, { '*': false }, token)
      }).rejects.toThrow('Invalid token: expired')
    })
  })

  describe('public access', () => {
    test('can execute allowed commands', async () => {
      const [serverSigner, clientSigner] = await Promise.all([randomSigner(), randomSigner()])
      const token = await createSignedToken(clientSigner, {
        cmd: 'kubun:graph/test',
        aud: serverSigner.did,
      } as Payload)
      await expect(
        checkClientToken(serverSigner.did, { '*': false, 'kubun:graph/test': true }, token),
      ).resolves.toBeUndefined()
    })
  })

  describe('allow-list access', () => {
    test('can execute allowed commands', async () => {
      const [serverSigner, clientSigner] = await Promise.all([randomSigner(), randomSigner()])
      const token = await createSignedToken(clientSigner, {
        cmd: 'kubun:graph/test',
        aud: serverSigner.did,
      } as Payload)
      await expect(
        checkClientToken(
          serverSigner.did,
          { '*': false, 'kubun:graph/test': [clientSigner.did] },
          token,
        ),
      ).resolves.toBeUndefined()
    })

    test('with delegation', async () => {
      const [serverSigner, delegationSigner, clientSigner] = await Promise.all([
        randomSigner(),
        randomSigner(),
        randomSigner(),
      ])
      // Delegation signer is subject, audience is client to grant access to and resource is server
      const delegation = await createCapability(delegationSigner, {
        aud: clientSigner.did,
        sub: delegationSigner.did,
        act: 'kubun:graph/*',
        res: serverSigner.did,
      })
      const token = await createSignedToken(clientSigner, {
        cmd: 'kubun:graph/test',
        aud: serverSigner.did,
        sub: delegationSigner.did,
        cap: stringifyToken(delegation),
      } as Payload)
      await expect(
        checkClientToken(
          serverSigner.did,
          { '*': false, 'kubun:graph/test': [delegationSigner.did] },
          token,
        ),
      ).resolves.toBeUndefined()
    })
  })
})
