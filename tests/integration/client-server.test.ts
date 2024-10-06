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
  test('handles events and requests', async () => {
    type Definitions = {
      'test/event': EventActionDefinition<{ hello: string }>
      'test/request': RequestActionDefinition<undefined, string>
    }
    type Meta = { test: boolean }

    const testEventHandler = jest.fn() as jest.Mock<EventHandler<{ hello: string }, Meta>>
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
      'test/event': testEventHandler,
      'test/request': testRequestHandler,
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

    await expect(client.request('test/request')).resolves.toBe('OK')

    await transports.dispose()
  })
})
