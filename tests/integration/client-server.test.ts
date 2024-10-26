import { Client } from '@enkaku/client'
import { createUnsignedToken } from '@enkaku/jwt'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  EventDefinition,
  RequestDefinition,
} from '@enkaku/protocol'
import { type CommandHandlers, type EventHandler, type RequestHandler, serve } from '@enkaku/server'
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
      serve<Definitions>({ handlers, transport: transports.server })

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
          }, 500)
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
      serve<Definitions>({ handlers, transport: transports.server })

      const request = await client.request('test/request')
      await expect(request.result).resolves.toBe('OK')

      await transports.dispose()
    })
  })
})
