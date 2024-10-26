import { setTimeout } from 'node:timers/promises'
import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-client-transport'
import { ServerTransport } from '@enkaku/http-server-transport'
import { createUnsignedToken } from '@enkaku/jwt'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  EventDefinition,
  RequestDefinition,
} from '@enkaku/protocol'
import { type CommandHandlers, type EventHandler, type RequestHandler, serve } from '@enkaku/server'
import { serve as serveHTTP } from '@hono/node-server'
import { jest } from '@jest/globals'
import getPort from 'get-port'

describe('HTTP transports', () => {
  describe('events', () => {
    test('handles events', async () => {
      type Definitions = {
        'test/event': EventDefinition<{ hello: string }>
      }

      const handler = jest.fn() as jest.Mock<EventHandler<'test/event', { hello: string }>>
      const handlers = { 'test/event': handler } as CommandHandlers<Definitions>

      const port = await getPort()

      const serverTransport = new ServerTransport<Definitions>()
      serve<Definitions>({ handlers, transport: serverTransport })
      const httpServer = serveHTTP({ fetch: serverTransport.handleRequest, port })

      const clientTransport = new ClientTransport<Definitions>({ url: `http://localhost:${port}` })
      const client = new Client({ transport: clientTransport })

      await client.sendEvent('test/event', { hello: 'world' })
      await setTimeout(100)
      expect(handler).toHaveBeenCalledWith({
        data: { hello: 'world' },
        message: createUnsignedToken({ typ: 'event', cmd: 'test/event', data: { hello: 'world' } }),
      })

      await clientTransport.dispose()
      await serverTransport.dispose()
      httpServer.close()
    })
  })

  describe('requests', () => {
    test('handles requests', async () => {
      type Definitions = {
        'test/request': RequestDefinition<undefined, string>
      }

      const handler = jest.fn(() => 'OK') as jest.Mock<
        RequestHandler<'test/request', undefined, string>
      >
      const handlers = { 'test/request': handler } as CommandHandlers<Definitions>

      const port = await getPort()

      const serverTransport = new ServerTransport<Definitions>()
      serve<Definitions>({ handlers, transport: serverTransport })
      const httpServer = serveHTTP({ fetch: serverTransport.handleRequest, port })

      const clientTransport = new ClientTransport<Definitions>({ url: `http://localhost:${port}` })
      const client = new Client({ transport: clientTransport })

      const request = await client.request('test/request')
      await expect(request.result).resolves.toBe('OK')

      await clientTransport.dispose()
      await serverTransport.dispose()
      httpServer.close()
    })
  })
})
