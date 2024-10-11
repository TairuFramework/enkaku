import { Client } from '@enkaku/client'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  EventActionDefinition,
  RequestActionDefinition,
} from '@enkaku/protocol'
import { type ActionHandlers, type EventHandler, type RequestHandler, serve } from '@enkaku/server'
import { createDirectTransports } from '@enkaku/transport'
import { jest } from '@jest/globals'

describe('client-server integration', () => {
  type Meta = { test: boolean }

  test('events', async () => {
    type Definitions = {
      'test/event': EventActionDefinition<{ hello: string }>
    }

    const testEventHandler = jest.fn() as jest.Mock<EventHandler<{ hello: string }, Meta>>
    const handlers = {
      'test/event': testEventHandler,
    } as ActionHandlers<Definitions, Meta>

    const transports = createDirectTransports<
      AnyServerMessageOf<Definitions>,
      AnyClientMessageOf<Definitions, Meta>
    >()

    const client = new Client({ meta: { test: true }, transport: transports.client })
    serve<Definitions, Meta>({ handlers, transport: transports.server })

    await client.sendEvent('test/event', { hello: 'world' })
    expect(testEventHandler).toHaveBeenCalledWith({
      data: { hello: 'world' },
      meta: { test: true },
    })

    await transports.dispose()
  })

  describe('requests', () => {
    test('handles request', async () => {
      type Definitions = {
        'test/request': RequestActionDefinition<undefined, string>
      }

      const testRequestHandler = jest.fn((ctx) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve('OK')
          }, 500)
          ctx.signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new Error('aborted'))
          })
        })
      }) as jest.Mock<RequestHandler<undefined, string, Meta>>
      const handlers = {
        'test/request': testRequestHandler,
      } as ActionHandlers<Definitions, Meta>

      const transports = createDirectTransports<
        AnyServerMessageOf<Definitions>,
        AnyClientMessageOf<Definitions, Meta>
      >()

      const client = new Client({ meta: { test: true }, transport: transports.client })
      serve<Definitions, Meta>({ handlers, transport: transports.server })

      const request = await client.request('test/request')
      await expect(request.result).resolves.toBe('OK')

      await transports.dispose()
    })
  })
})
