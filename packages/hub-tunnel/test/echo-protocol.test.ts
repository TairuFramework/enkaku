import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import {
  type EchoClientMessage,
  type EchoProtocol,
  type EchoServerMessage,
  echoHandlers,
} from './fixtures/echo-protocol.js'

type EchoTransports = DirectTransports<EchoServerMessage, EchoClientMessage>

async function withEcho(fn: (client: Client<EchoProtocol>) => Promise<void>): Promise<void> {
  const transports: EchoTransports = new DirectTransports()
  const server = serve<EchoProtocol>({
    accessControl: false,
    handlers: echoHandlers,
    transport: transports.server,
  })
  const client = new Client<EchoProtocol>({
    transport: transports.client,
    identity: randomIdentity(),
  })
  try {
    await fn(client)
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
    await transports.dispose()
  }
}

describe('EchoProtocol over DirectTransports', () => {
  test('echo/ping returns the request msg unchanged', async () => {
    await withEcho(async (client) => {
      const result = await client.request('echo/ping', { param: { msg: 'hello' } })
      expect(result).toEqual({ msg: 'hello' })
    })
  })

  test('echo/stream echoes 5 messages in order', async () => {
    await withEcho(async (client) => {
      const sent = ['one', 'two', 'three', 'four', 'five']
      const channel = client.createChannel('echo/stream', {
        param: { expected: sent.length },
      })

      const reader = channel.readable.getReader()
      const received: Array<string> = []

      for (const msg of sent) {
        await channel.send({ msg })
      }

      while (received.length < sent.length) {
        const { done, value } = await reader.read()
        if (done) break
        received.push(value.msg)
      }
      reader.releaseLock()

      const result = await channel
      expect(received).toEqual(sent)
      expect(result).toEqual({ count: sent.length })
    })
  })
})
