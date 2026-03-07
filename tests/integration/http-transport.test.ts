import { setTimeout } from 'node:timers/promises'
import { Client, RequestError } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { ServerTransport, type ServerTransportOptions } from '@enkaku/http-server-transport'
import type { ProtocolDefinition } from '@enkaku/protocol'
import {
  type ChannelHandler,
  type EventHandler,
  type ProcedureHandlers,
  type RequestHandler,
  type ServerEmitter,
  type StreamHandler,
  serve,
} from '@enkaku/server'
import { createUnsignedToken } from '@enkaku/token'
import { serve as serveHTTP } from '@hono/node-server'
import getPort from 'get-port'
import { describe, expect, test, vi } from 'vitest'

type TestContext<Protocol extends ProtocolDefinition> = {
  client: Client<Protocol>
  dispose: () => Promise<void>
  events: ServerEmitter
}

async function createContext<Protocol extends ProtocolDefinition>(
  handlers: ProcedureHandlers<Protocol>,
  serverOptions?: ServerTransportOptions,
): Promise<TestContext<Protocol>> {
  const port = await getPort()

  const serverTransport = new ServerTransport<Protocol>(serverOptions)
  const server = serve<Protocol>({ handlers, accessControl: false, transport: serverTransport })
  const httpServer = serveHTTP({ fetch: serverTransport.fetch, port })

  const clientTransport = new ClientTransport<Protocol>({ url: `http://localhost:${port}` })
  const client = new Client<Protocol>({ transport: clientTransport })

  return {
    client,
    dispose: async () => {
      httpServer.close()
      await Promise.all([clientTransport.dispose(), serverTransport.dispose()])
    },
    events: server.events,
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

      const handler = vi.fn() as EventHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      await client.sendEvent('test', { data: { hello: 'world' } })
      await setTimeout(100)
      expect(handler).toHaveBeenCalledWith({
        data: { hello: 'world' },
        message: createUnsignedToken({ typ: 'event', prc: 'test', data: { hello: 'world' } }),
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

      const handler = vi.fn(() => 'OK') as RequestHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })
      await expect(client.request('test')).resolves.toBe('OK')

      await dispose()
    })
  })

  describe('streams', () => {
    test('handles streams', async () => {
      const protocol = {
        test: {
          type: 'stream',
          param: { type: 'number' },
          receive: { type: 'number' },
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handler = vi.fn((ctx) => {
        return new Promise((resolve, reject) => {
          const writer = ctx.writable.getWriter()
          let count = 0
          const timer = setInterval(() => {
            if (count === 3) {
              clearInterval(timer)
              resolve('END')
            } else {
              writer.write(ctx.param + count++)
            }
          }, 50)
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new Error('aborted'))
          })
        })
      }) as StreamHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      const stream = client.createStream('test', { param: 3 })
      const reader = stream.readable.getReader()
      const received: Array<number> = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        received.push(value)
      }

      expect(received).toEqual([3, 4, 5])
      await expect(stream).resolves.toBe('END')

      await dispose()
    })
  })

  describe('channels', () => {
    test('handles channels', async () => {
      const protocol = {
        test: {
          type: 'channel',
          param: { type: 'number' },
          send: { type: 'number' },
          receive: { type: 'number' },
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handler = vi.fn(async (ctx) => {
        const reader = ctx.readable.getReader()
        const writer = ctx.writable.getWriter()
        let count = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done || count++ === 3) {
            break
          }
          writer.write(ctx.param + value)
        }
        return 'END'
      }) as ChannelHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })
      const channel = client.createChannel('test', { param: 5 })

      const send = [5, 3, 10, 20]
      async function sendNext() {
        const val = send.shift()
        if (val != null) {
          await channel.send(val)
        }
      }
      sendNext()

      const received: Array<number> = []
      const reader = channel.readable.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        received.push(value)
        sendNext()
      }

      expect(received).toEqual([10, 8, 15])
      await expect(channel).resolves.toBe('END')

      await dispose()
    })
  })

  describe('SSE-specific flows', () => {
    test('handles request handler errors', async () => {
      const protocol = {
        test: {
          type: 'request',
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handler = vi.fn(() => {
        throw new Error('handler failure')
      }) as RequestHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      await expect(client.request('test')).rejects.toThrow(RequestError)

      await dispose()
    })

    test('handles stream handler errors', async () => {
      const protocol = {
        test: {
          type: 'stream',
          receive: { type: 'number' },
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handler = vi.fn(() => {
        throw new Error('stream handler failure')
      }) as StreamHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      const stream = client.createStream('test')
      await expect(stream).rejects.toThrow(RequestError)

      await dispose()
    })

    test('handles multiple concurrent requests', async () => {
      const protocol = {
        test: {
          type: 'request',
          param: { type: 'number' },
          result: { type: 'number' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handler = vi.fn(async (ctx) => {
        await setTimeout(10)
        return ctx.param * 2
      }) as RequestHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      const results = await Promise.all([
        client.request('test', { param: 1 }),
        client.request('test', { param: 2 }),
        client.request('test', { param: 3 }),
      ])
      expect(results).toEqual([2, 4, 6])

      await dispose()
    })

    test('handles stream with many SSE events', async () => {
      const protocol = {
        test: {
          type: 'stream',
          receive: { type: 'number' },
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const eventCount = 50
      const handler = vi.fn(async (ctx) => {
        const writer = ctx.writable.getWriter()
        for (let i = 0; i < eventCount; i++) {
          await writer.write(i)
        }
        return 'DONE'
      }) as StreamHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      const stream = client.createStream('test')
      const reader = stream.readable.getReader()
      const received: Array<number> = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        received.push(value)
      }

      expect(received).toEqual(Array.from({ length: eventCount }, (_, i) => i))
      await expect(stream).resolves.toBe('DONE')

      await dispose()
    })

    test('handles client abort during active stream', async () => {
      const protocol = {
        test: {
          type: 'stream',
          receive: { type: 'number' },
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const handlerAborted = vi.fn()
      const abortedPromise = new Promise<void>((resolve) => {
        handlerAborted.mockImplementation(() => resolve())
      })

      const handler = vi.fn((ctx) => {
        return new Promise<string>((handlerResolve) => {
          const writer = ctx.writable.getWriter()
          let count = 0
          const timer = setInterval(() => {
            writer.write(count++).catch(() => {})
          }, 20)
          ctx.signal.addEventListener('abort', () => {
            clearInterval(timer)
            handlerAborted()
            handlerResolve('ABORTED')
          })
        })
      }) as StreamHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      const stream = client.createStream('test')
      // Catch the expected rejection when we abort
      stream.then(
        () => {},
        () => {},
      )
      const reader = stream.readable.getReader()
      // Read a couple of events then abort
      await reader.read()
      await reader.read()
      stream.abort('test abort')

      await abortedPromise
      expect(handlerAborted).toHaveBeenCalled()

      await dispose()
    })

    test('handles mixed procedure types on same transport', async () => {
      const protocol = {
        greet: {
          type: 'event',
          data: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
            additionalProperties: false,
          },
        },
        add: {
          type: 'request',
          param: { type: 'number' },
          result: { type: 'number' },
        },
        count: {
          type: 'stream',
          param: { type: 'number' },
          receive: { type: 'number' },
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const greetHandler = vi.fn() as EventHandler<Protocol, 'greet'>
      const addHandler = vi.fn((ctx) => ctx.param + 10) as RequestHandler<Protocol, 'add'>
      const countHandler = vi.fn(async (ctx) => {
        const writer = ctx.writable.getWriter()
        for (let i = 0; i < ctx.param; i++) {
          await writer.write(i)
        }
        return 'DONE'
      }) as StreamHandler<Protocol, 'count'>

      const { client, dispose } = await createContext<Protocol>({
        greet: greetHandler,
        add: addHandler,
        count: countHandler,
      })

      // Send event
      await client.sendEvent('greet', { data: { name: 'world' } })
      await setTimeout(50)
      expect(greetHandler).toHaveBeenCalled()

      // Make request
      await expect(client.request('add', { param: 5 })).resolves.toBe(15)

      // Create stream (triggers SSE session)
      const stream = client.createStream('count', { param: 3 })
      const reader = stream.readable.getReader()
      const received: Array<number> = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        received.push(value)
      }
      expect(received).toEqual([0, 1, 2])
      await expect(stream).resolves.toBe('DONE')

      // Request still works after stream completes
      await expect(client.request('add', { param: 20 })).resolves.toBe(30)

      await dispose()
    })

    test('handles channel abort from client', async () => {
      const protocol = {
        test: {
          type: 'channel',
          send: { type: 'number' },
          receive: { type: 'number' },
          result: { type: 'string' },
        },
      } as const satisfies ProtocolDefinition
      type Protocol = typeof protocol

      const serverAborted = vi.fn()
      const abortedPromise = new Promise<void>((resolve) => {
        serverAborted.mockImplementation(() => resolve())
      })

      const handler = vi.fn(async (ctx) => {
        const reader = ctx.readable.getReader()
        const writer = ctx.writable.getWriter()
        ctx.signal.addEventListener('abort', () => {
          serverAborted()
        })
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            await writer.write(value * 2)
          }
        } catch {}
        return 'END'
      }) as ChannelHandler<Protocol, 'test'>
      const { client, dispose } = await createContext<Protocol>({ test: handler })

      const channel = client.createChannel('test')
      // Catch the expected rejection when we abort
      channel.then(
        () => {},
        () => {},
      )
      await channel.send(5)
      const reader = channel.readable.getReader()
      const { value } = await reader.read()
      expect(value).toBe(10)

      channel.abort('client abort')
      await abortedPromise
      expect(serverAborted).toHaveBeenCalled()

      await dispose()
    })
  })
})
