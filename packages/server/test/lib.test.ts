import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  EventActionDefinition,
  RequestActionDefinition,
} from '@enkaku/protocol'
import { createDirectTransports } from '@enkaku/transport'
import { jest } from '@jest/globals'

import { type ActionHandlers, type EventHandler, type RequestHandler, serve } from '../src/index.js'

describe('serve()', () => {
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
          resolve('hello')
        }, 2000)
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

    const server = serve<Definitions, Meta>({ handlers, transport: transports.server })

    await transports.client.write({
      action: { type: 'event', name: 'test/event', data: { hello: 'world' } },
      meta: { test: true },
    })
    await transports.client.write({
      action: { type: 'request', name: 'test/request', id: '1', params: undefined },
      meta: { test: true },
    })
    await server.dispose()
    await transports.dispose()

    expect(testEventHandler).toHaveBeenCalledWith({
      data: { hello: 'world' },
      meta: { test: true },
    })
  })
})
