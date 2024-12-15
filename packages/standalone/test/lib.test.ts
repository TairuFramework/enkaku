import type { ProtocolDefinition } from '@enkaku/protocol'
import type { ChannelHandler, EventHandler, RequestHandler, StreamHandler } from '@enkaku/server'
import { randomTokenSigner } from '@enkaku/token'
import { jest } from '@jest/globals'

import { standalone } from '../src'

describe('standalone', () => {
  describe('events', () => {
    test('handles events', async () => {
      const signer = randomTokenSigner()

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
      const client = standalone<Protocol>({ test: handler }, { signer })

      await client.sendEvent('test', { hello: 'world' })
      const message = await signer.createToken({
        aud: signer.id,
        typ: 'event',
        cmd: 'test',
        data: { hello: 'world' },
      })
      expect(handler).toHaveBeenCalledWith({ data: { hello: 'world' }, message })
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
      }) as jest.Mock<RequestHandler<Protocol, 'test'>>
      const client = await standalone<Protocol>({ test: handler })

      await expect(client.request('test').toValue()).resolves.toBe('OK')
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
      const client = standalone<Protocol>({ test: handler })

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
      const client = standalone<Protocol>({ test: handler })

      const channel = await client.createChannel('test', 5)
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
    })
  })
})