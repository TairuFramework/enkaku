import { Client } from '@enkaku/client'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
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
import { createUnsignedToken } from '@enkaku/token'
import { createDirectTransports } from '@enkaku/transport'
import { jest } from '@jest/globals'

describe('client-server integration', () => {
  describe('events', () => {
    test('handles events', async () => {
      type Definitions = {
        'test/event': EventDefinition<{ hello: string }>
      }

      const handler = jest.fn() as jest.Mock<EventHandler<'test/event', { hello: string }>>
      const handlers = { 'test/event': handler } as CommandHandlers<Definitions>

      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()

      const client = new Client({ transport: transports.client })
      serve<Definitions>({ handlers, insecure: true, transport: transports.server })

      await client.sendEvent('test/event', { hello: 'world' })
      expect(handler).toHaveBeenCalledWith({
        data: { hello: 'world' },
        message: createUnsignedToken({ typ: 'event', cmd: 'test/event', data: { hello: 'world' } }),
      })

      await transports.dispose()
    })
  })

  describe('requests', () => {
    test('handles requests', async () => {
      type Definitions = {
        'test/request': RequestDefinition<undefined, string>
      }

      const handler = jest.fn((ctx) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve('OK')
          }, 100)
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new Error('aborted'))
          })
        })
      }) as jest.Mock<RequestHandler<'test/request', undefined, string>>
      const handlers = { 'test/request': handler } as CommandHandlers<Definitions>

      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()

      const client = new Client({ transport: transports.client })
      serve<Definitions>({ handlers, insecure: true, transport: transports.server })

      await expect(client.request('test/request').toValue()).resolves.toBe('OK')

      await transports.dispose()
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
      const handlers = { 'test/stream': handler } as CommandHandlers<Definitions>

      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()

      const client = new Client({ transport: transports.client })
      serve<Definitions>({ handlers, insecure: true, transport: transports.server })

      const stream = await client.createStream('test/stream', 3)
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

      await transports.dispose()
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
      const handlers = { 'test/channel': handler } as CommandHandlers<Definitions>

      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions>
      >()

      const client = new Client({ transport: transports.client })
      serve<Definitions>({ handlers, insecure: true, transport: transports.server })
      const channel = await client.createChannel('test/channel', 5)

      const send = [5, 3, 10, 20]
      async function sendNext() {
        const val = send.shift()
        if (val != null) {
          await channel.send(val)
        }
      }
      sendNext()

      const reader = channel.receive.getReader()
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
      const result = await channel.result
      await expect(result.value).toBe('END')

      await transports.dispose()
    })
  })
})
