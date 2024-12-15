import { setTimeout } from 'node:timers/promises'
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { ServerTransport } from '@enkaku/http-server-transport'
import type { ProtocolDefinition } from '@enkaku/protocol'
import {
  type ChannelHandler,
  type CommandHandlers,
  type EventHandler,
  type RequestHandler,
  type StreamHandler,
  serve,
} from '@enkaku/server'
import { createUnsignedToken } from '@enkaku/token'
import { serve as serveHTTP } from '@hono/node-server'
import { jest } from '@jest/globals'
import getPort from 'get-port'

type TestContext<Protocol extends ProtocolDefinition> = {
  client: Client<Protocol>
  dispose: () => Promise<void>
}

async function createContext<Protocol extends ProtocolDefinition>(
  handlers: CommandHandlers<Protocol>,
): Promise<TestContext<Protocol>> {
  const port = await getPort()

  const serverTransport = new ServerTransport<Protocol>()
  serve<Protocol>({ handlers, public: true, transport: serverTransport })
  const httpServer = serveHTTP({ fetch: serverTransport.fetch, port })

  const clientTransport = new ClientTransport<Protocol>({ url: `http://localhost:${port}` })
  const client = new Client<Protocol>({ transport: clientTransport })

  return {
    client,
    dispose: async () => {
      httpServer.close()
      await Promise.all([clientTransport.dispose(), serverTransport.dispose()])
    },
  }
}

describe('HTTP transports', () => {
  describe('events', () => {
    test('handles events', async () => {
      const protocol = {
        test: {
          type: 'event',
          data: {
            type: 'object',
            properties: { hello: { type: 'string' } },
            required: ['hello'],
            additionalProperties: false,
          },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handler = jest.fn() as jest.Mock<EventHandler<Protocol, 'test'>>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      await client.sendEvent('test', { hello: 'world' })
      await setTimeout(100)
      expect(handler).toHaveBeenCalledWith({
        data: { hello: 'world' },
        message: createUnsignedToken({ typ: 'event', cmd: 'test', data: { hello: 'world' } }),
      })

      await dispose()
    })
  })

  describe('requests', () => {
    test('handles requests', async () => {
      const protocol = {
        test: {
          type: 'request',
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handler = jest.fn(() => 'OK') as jest.Mock<RequestHandler<Protocol, 'test'>>
      const { client, dispose } = await createContext<Protocol>({ test: handler })
      await expect(client.request('test').toValue()).resolves.toBe('OK')

      await dispose()
    })
  })

  describe('streams', () => {
    test('handles streams', async () => {
      const protocol = {
        test: {
          type: 'stream',
          params: { type: 'number' },
          receive: { type: 'number' },
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handler = jest.fn((ctx) => {
        return new Promise((resolve, reject) => {
          const writer = ctx.writable.getWriter()
          let count = 0
          const timer = setInterval(() => {
            if (count === 3) {
              clearInterval(timer)
              resolve('END')
            } else {
              writer.write(ctx.params + count++)
            }
          }, 50)
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new Error('aborted'))
          })
        })
      }) as jest.Mock<StreamHandler<Protocol, 'test'>>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      const stream = await client.createStream('test', 3)
      const reader = stream.receive.getReader()
      const received: Array<number> = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        received.push(value)
      }

      expect(received).toEqual([3, 4, 5])
      const result = await stream.result
      expect(result.value).toBe('END')

      await dispose()
    })
  })

  describe('channels', () => {
    test('handles channels', async () => {
      const protocol = {
        test: {
          type: 'channel',
          params: { type: 'number' },
          send: { type: 'number' },
          receive: { type: 'number' },
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handler = jest.fn(async (ctx) => {
        const reader = ctx.readable.getReader()
        const writer = ctx.writable.getWriter()
        let count = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done || count++ === 3) {
            break
          }
          writer.write(ctx.params + value)
        }
        return 'END'
      }) as jest.Mock<ChannelHandler<Protocol, 'test'>>
      const { client, dispose } = await createContext<Protocol>({ test: handler })
      const channel = await client.createChannel('test', 5)

      const send = [5, 3, 10, 20]
      async function sendNext() {
        const val = send.shift()
        if (val != null) {
          await channel.send(val)
        }
      }
      sendNext()

      const received: Array<number> = []
      const reader = channel.receive.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        received.push(value)
        sendNext()
      }

      expect(received).toEqual([10, 8, 15])
      const result = await channel.result
      expect(result.value).toBe('END')

      await dispose()
    })
  })
})