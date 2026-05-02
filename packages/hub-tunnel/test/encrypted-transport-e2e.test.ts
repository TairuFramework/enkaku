import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import { randomIdentity } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import { createEncryptedHubTunnelTransport } from '../src/encrypted-transport.js'

import {
  type EchoClientMessage,
  type EchoProtocol,
  type EchoServerMessage,
  echoHandlers,
} from './fixtures/echo-protocol.js'
import { FakeEncryptor } from './fixtures/fake-encryptor.js'
import { FakeHub } from './fixtures/fake-hub.js'

const SHARED_KEY = new Uint8Array([0xab, 0xcd, 0xef, 0x01, 0x23, 0x45])

type E2ESetup = {
  hub: FakeHub
  serverDID: string
  clientDID: string
  serverTransport: ReturnType<
    typeof createEncryptedHubTunnelTransport<EchoClientMessage, EchoServerMessage>
  >
  clientTransport: ReturnType<
    typeof createEncryptedHubTunnelTransport<EchoServerMessage, EchoClientMessage>
  >
}

function createE2ESetup(): E2ESetup {
  const hub = new FakeHub()
  const sessionID = 's1'
  const groupID = 'g1'
  const serverDID = 'did:peer:server'
  const clientDID = 'did:peer:client'

  const serverEncryptor = new FakeEncryptor({ key: SHARED_KEY })
  const clientEncryptor = new FakeEncryptor({ key: SHARED_KEY })

  const serverTransport = createEncryptedHubTunnelTransport<EchoClientMessage, EchoServerMessage>({
    hub,
    sessionID,
    localDID: serverDID,
    peerDID: clientDID,
    encryptor: serverEncryptor,
    groupID,
  })
  const clientTransport = createEncryptedHubTunnelTransport<EchoServerMessage, EchoClientMessage>({
    hub,
    sessionID,
    localDID: clientDID,
    peerDID: serverDID,
    encryptor: clientEncryptor,
    groupID,
  })

  return { hub, serverDID, clientDID, serverTransport, clientTransport }
}

describe('createEncryptedHubTunnelTransport e2e', () => {
  test('echo/ping round-trips end-to-end via encrypted tunnel + FakeHub', async () => {
    const { hub, serverDID, clientDID, serverTransport, clientTransport } = createE2ESetup()

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

  test('echo/stream round-trips 50 frames end-to-end via encrypted tunnel + FakeHub', async () => {
    const { hub, serverDID, clientDID, serverTransport, clientTransport } = createE2ESetup()

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
      const total = 50
      const sent: Array<string> = []
      for (let i = 0; i < total; i++) {
        sent.push(`${i}`)
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
