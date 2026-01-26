import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import {
  type ChannelHandler,
  type EventHandler,
  type ProcedureHandlers,
  type RequestHandler,
  type StreamHandler,
  serve,
} from '@enkaku/server'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

describe('client-server integration', () => {
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
      const handlers = { test: handler } as ProcedureHandlers<Protocol>

      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()

      const client = new Client<Protocol>({ transport: transports.client })
      serve<Protocol>({ handlers, public: true, transport: transports.server })

      await client.sendEvent('test', { data: { hello: 'world' } })
      expect(handler).toHaveBeenCalledWith({
        data: { hello: 'world' },
        message: createUnsignedToken({ typ: 'event', prc: 'test', data: { hello: 'world' } }),
      })

      await transports.dispose()
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

      const handler = vi.fn((ctx) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve('OK')
          }, 100)
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new Error('aborted'))
          })
        })
      }) as RequestHandler<Protocol, 'test'>
      const handlers = { test: handler } as ProcedureHandlers<Protocol>

      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()

      const client = new Client<Protocol>({ transport: transports.client })
      serve<Protocol>({ handlers, public: true, transport: transports.server })

      await expect(client.request('test')).resolves.toBe('OK')

      await transports.dispose()
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
      const handlers = { test: handler } as ProcedureHandlers<Protocol>

      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()

      const client = new Client<Protocol>({ transport: transports.client })
      serve<Protocol>({ handlers, public: true, transport: transports.server })

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

      await transports.dispose()
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
      const handlers = { test: handler } as ProcedureHandlers<Protocol>

      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()

      const client = new Client<Protocol>({ transport: transports.client })
      serve<Protocol>({ handlers, public: true, transport: transports.server })
      const channel = client.createChannel('test', { param: 5 })

      const send = [5, 3, 10, 20]
      async function sendNext() {
        const val = send.shift()
        if (val != null) {
          await channel.send(val)
        }
      }
      sendNext()

      const reader = channel.readable.getReader()
      const received: Array<number> = []
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

      await transports.dispose()
    })
  })
})
