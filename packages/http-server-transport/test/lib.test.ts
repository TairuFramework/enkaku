import { setTimeout } from 'node:timers/promises'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { type EventHandler, type RequestHandler, serve } from '@enkaku/server'
import { createUnsignedToken } from '@enkaku/token'
import { jest } from '@jest/globals'

import { ServerTransport } from '../src/index.js'

describe('ServerTransport', () => {
  test('server with transport', async () => {
    const protocol = {
      'test/event': {
        type: 'event',
        data: {
          type: 'object',
          properties: { hello: { type: 'string' } },
          required: ['hello'],
          additionalProperties: false,
        },
      },
      'test/request': {
        type: 'request',
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const testEventHandler = jest.fn() as jest.Mock<EventHandler<Protocol, 'test/event'>>
    const testRequestHandler = jest.fn(() => {
      return setTimeout(100, 'hello')
    }) as jest.Mock<RequestHandler<Protocol, 'test/request'>>

    const handlers = {
      'test/event': testEventHandler,
      'test/request': testRequestHandler,
    }
    const transport = new ServerTransport<Protocol>()
    const server = serve<Protocol>({ handlers, public: true, transport })

    const headers = new Headers()
    headers.set('content-type', 'application/json')

    const eventMessage = createUnsignedToken({
      typ: 'event',
      prc: 'test/event',
      data: { hello: 'world' },
    })
    await transport.fetch(
      new Request('http://localhost/test', {
        headers,
        body: JSON.stringify(eventMessage),
        method: 'POST',
      }),
    )
    await setTimeout(100)
    expect(testEventHandler).toHaveBeenCalledWith({
      data: { hello: 'world' },
      message: eventMessage,
    })

    const requestMessage = createUnsignedToken({ typ: 'request', prc: 'test/request' })
    const response = await transport.fetch(
      new Request('http://localhost/test', {
        headers,
        body: JSON.stringify(requestMessage),
        method: 'POST',
      }),
    )
    await expect(response.json()).resolves.toEqual(
      createUnsignedToken({ typ: 'result', val: 'hello' }),
    )

    await server.dispose()
  })
})
