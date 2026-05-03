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

describe('createHubTunnelTransport channel semantics', () => {
  test('echo/stream handles 100 inbound + 100 outbound msgs and closes cleanly', async () => {
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
      const total = 100
      const sent: Array<string> = []
      for (let i = 0; i < total; i++) {
        sent.push(`msg-${i}`)
      }

      const channel = client.createChannel('echo/stream', {
        param: { expected: total },
      })

      const reader = channel.readable.getReader()
      const received: Array<string> = []

      for (const msg of sent) {
        await channel.send({ msg })
      }

      while (received.length < total) {
        const { done, value } = await reader.read()
        if (done) break
        received.push(value.msg)
      }
      reader.releaseLock()

      const result = await channel
      expect(received).toEqual(sent)
      expect(result).toEqual({ count: total })
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
