import { setTimeout } from 'node:timers/promises'
import { createUnsignedToken } from '@enkaku/jwt'
import type { EventDefinition, RequestDefinition } from '@enkaku/protocol'
import { type CommandHandlers, type EventHandler, type RequestHandler, serve } from '@enkaku/server'
import { jest } from '@jest/globals'

import { ServerTransport } from '../src/index.js'

describe('ServerTransport', () => {
  test('server with transport', async () => {
    type Definitions = {
      'test/event': EventDefinition<{ hello: string }>
      'test/request': RequestDefinition<undefined, string>
    }

    const testEventHandler = jest.fn() as jest.Mock<EventHandler<'test/event', { hello: string }>>
    const testRequestHandler = jest.fn((ctx) => {
      return setTimeout(100, 'hello')
    }) as jest.Mock<RequestHandler<'test/request', undefined, string>>

    const handlers = {
      'test/event': testEventHandler,
      'test/request': testRequestHandler,
    } as CommandHandlers<Definitions>
    const transport = new ServerTransport<Definitions>()
    const server = serve<Definitions>({ handlers, insecure: true, transport })

    const headers = new Headers()
    headers.set('content-type', 'application/json')

    const eventMessage = createUnsignedToken({
      typ: 'event',
      cmd: 'test/event',
      data: { hello: 'world' },
    })
    await transport.handleRequest(
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

    const requestMessage = createUnsignedToken({ typ: 'request', cmd: 'test/request' })
    const response = await transport.handleRequest(
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
