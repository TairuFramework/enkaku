import { setTimeout } from 'node:timers/promises'
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { ServerTransport } from '@enkaku/http-server-transport'
import { createUnsignedToken } from '@enkaku/jwt'
import type {
  AnyDefinitions,
  ChannelDefinition,
  EventDefinition,
  RequestDefinition,
  StreamDefinition,
} from '@enkaku/protocol'
import {
  type ChannelHandler,
  type CommandHandlers,
  type EventHandler,
  type RequestHandler,
  type StreamHandler,
  serve,
} from '@enkaku/server'
import { serve as serveHTTP } from '@hono/node-server'
import { jest } from '@jest/globals'
import getPort from 'get-port'

type TestContext<Definitions extends AnyDefinitions> = {
  client: Client<Definitions>
  dispose: () => Promise<void>
}

async function createContext<Definitions extends AnyDefinitions>(
  handlers: CommandHandlers<Definitions>,
): Promise<TestContext<Definitions>> {
  const port = await getPort()

  const serverTransport = new ServerTransport<Definitions>()
  serve<Definitions>({ handlers, transport: serverTransport })
  const httpServer = serveHTTP({ fetch: serverTransport.handleRequest, port })

  const clientTransport = new ClientTransport<Definitions>({ url: `http://localhost:${port}` })
  const client = new Client({ transport: clientTransport })

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
      type Definitions = {
        'test/event': EventDefinition<{ hello: string }>
      }
      const handler = jest.fn() as jest.Mock<EventHandler<'test/event', { hello: string }>>

      const { client, dispose } = await createContext<Definitions>({ 'test/event': handler })
      await client.sendEvent('test/event', { hello: 'world' })
      await setTimeout(100)
      expect(handler).toHaveBeenCalledWith({
        data: { hello: 'world' },
        message: createUnsignedToken({ typ: 'event', cmd: 'test/event', data: { hello: 'world' } }),
      })

      await dispose()
    })
  })

  describe('requests', () => {
    test('handles requests', async () => {
      type Definitions = {
        'test/request': RequestDefinition<undefined, string>
      }
      const handler = jest.fn(() => 'OK') as jest.Mock<
        RequestHandler<'test/request', undefined, string>
      >

      const { client, dispose } = await createContext<Definitions>({ 'test/request': handler })
      const request = await client.request('test/request')
      await expect(request.result).resolves.toBe('OK')

      await dispose()
    })
  })

  describe('streams', () => {
    test('handles streams', async () => {
      type Definitions = {
        'test/stream': StreamDefinition<number, number, string>
      }
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
      }) as jest.Mock<StreamHandler<'test/stream', number, number, string>>

      const { client, dispose } = await createContext<Definitions>({ 'test/stream': handler })

      const stream = await client.createStream('test/stream', 3)
      const received: Array<number> = []
      while (true) {
        const { done, value } = await stream.receive.read()
        if (done) {
          break
        }
        received.push(value)
      }

      expect(received).toEqual([3, 4, 5])
      await expect(stream.result).resolves.toBe('END')

      await dispose()
    })
  })

  describe('channels', () => {
    test('handles channels', async () => {
      type Definitions = {
        'test/channel': ChannelDefinition<number, number, number, string>
      }
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
      }) as jest.Mock<ChannelHandler<'test/channel', number, number, number, string>>

      const { client, dispose } = await createContext<Definitions>({ 'test/channel': handler })

      const channel = await client.createChannel('test/channel', 5)

      const send = [5, 3, 10, 20]
      async function sendNext() {
        const val = send.shift()
        if (val != null) {
          await channel.send(val)
        }
      }
      sendNext()

      const received: Array<number> = []
      while (true) {
        const { done, value } = await channel.receive.read()
        if (done) {
          break
        }
        received.push(value)
        sendNext()
      }

      expect(received).toEqual([10, 8, 15])
      await expect(channel.result).resolves.toBe('END')

      await dispose()
    })
  })
})
