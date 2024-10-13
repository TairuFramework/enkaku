import { unsignedToken } from '@enkaku/jwt'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  EventDefinition,
  RequestDefinition,
} from '@enkaku/protocol'
import { createDirectTransports } from '@enkaku/transport'
import { jest } from '@jest/globals'

import {
  type CommandHandlers,
  type EventHandler,
  type RequestHandler,
  serve,
} from '../src/index.js'

describe('serve()', () => {
  test('handles events and requests', async () => {
    type Definitions = {
      'test/event': EventDefinition<{ hello: string }>
      'test/request': RequestDefinition<undefined, string>
    }

    const testEventHandler = jest.fn() as jest.Mock<EventHandler<{ hello: string }>>
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
    }) as jest.Mock<RequestHandler<undefined, string>>

    const handlers = {
      'test/event': testEventHandler,
      'test/request': testRequestHandler,
    } as CommandHandlers<Definitions>

    const transports = createDirectTransports<
      AnyServerMessageOf<Definitions>,
      AnyClientMessageOf<Definitions>
    >()

    const server = serve<Definitions>({ handlers, transport: transports.server })

    await transports.client.write(
      unsignedToken({ typ: 'event', cmd: 'test/event', data: { hello: 'world' } }),
    )
    await transports.client.write(
      unsignedToken({ typ: 'request', cmd: 'test/request', rid: '1', prm: undefined }),
    )
    await server.dispose()
    await transports.dispose()

    expect(testEventHandler).toHaveBeenCalledWith({
      data: { hello: 'world' },
    })
  })
})