import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import { randomIdentity } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import { createHubTunnelTransport } from '../src/transport.js'

import {
  type EchoClientMessage,
  type EchoProtocol,
  type EchoServerMessage,
  echoHandlers,
} from './fixtures/echo-protocol.js'
import { FakeHub } from './fixtures/fake-hub.js'

describe('createHubTunnelTransport', () => {
  test('echo/ping round-trips end-to-end via tunnel + FakeHub', async () => {
    const hub = new FakeHub()
    const sessionID = 's1'
    const serverDID = 'did:peer:server'
    const clientDID = 'did:peer:client'

    const serverTransport = createHubTunnelTransport<EchoClientMessage, EchoServerMessage>({
      hub,
      sessionID,
      localDID: serverDID,
      peerDID: clientDID,
    })
    const clientTransport = createHubTunnelTransport<EchoServerMessage, EchoClientMessage>({
      hub,
      sessionID,
      localDID: clientDID,
      peerDID: serverDID,
    })

    const server = serve<EchoProtocol>({
      accessControl: false,
      handlers: echoHandlers,
      transport: serverTransport,
    })
    const client = new Client<EchoProtocol>({
      transport: clientTransport,
      identity: randomIdentity(),
    })

    try {
      const result = await client.request('echo/ping', { param: { msg: 'hi' } })
      expect(result).toEqual({ msg: 'hi' })
    } finally {
      try {
        await client.dispose()
      } catch {
        // ignore
      }
      try {
        await server.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(serverDID)
      hub.disconnect(clientDID)
    }
  })
})
