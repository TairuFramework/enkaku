import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, serve } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

const protocol = {
  request: { type: 'request', param: { type: 'null' }, result: { type: 'string' } },
  stream: {
    type: 'stream',
    param: { type: 'null' },
    receive: { type: 'null' },
    result: { type: 'string' },
  },
  channel: {
    type: 'channel',
    param: { type: 'null' },
    send: { type: 'null' },
    receive: { type: 'null' },
    result: { type: 'string' },
  },
  event: {
    type: 'event',
    data: {
      type: 'object',
      properties: { value: { type: 'null' } },
      required: ['value'],
      additionalProperties: false,
    },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('null values with protocol validation', () => {
  test.each(['request', 'stream', 'channel'] as const)(
    '%s passes null to the handler',
    async (type) => {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const handlers: ProcedureHandlers<Protocol> = {
        request: ({ param }) => {
          expect(param).toBeNull()
          return 'OK'
        },
        stream: async ({ param, writable }) => {
          expect(param).toBeNull()
          await writable.getWriter().write(param)
          return 'OK'
        },
        channel: async ({ param, readable, writable }) => {
          expect(param).toBeNull()
          const { value } = await readable.getReader().read()
          expect(value).toBeNull()
          await writable.getWriter().write(param)
          return 'OK'
        },
        event: () => {},
      }
      const server = serve<Protocol>({
        protocol,
        handlers,
        requireAuth: false,
        transport: transports.server,
      })
      const client = new Client<Protocol>({ transport: transports.client })

      try {
        if (type === 'request') {
          await expect(client.request('request', { param: null })).resolves.toBe('OK')
        } else {
          const channel =
            type === 'channel' ? client.createChannel('channel', { param: null }) : undefined
          const call = channel ?? client.createStream('stream', { param: null })
          const reader = call.readable.getReader()
          const [result, received] = await Promise.all([
            call,
            (async () => {
              return [await reader.read(), await reader.read()]
            })(),
            channel?.send(null),
          ])
          expect(result).toBe('OK')
          expect(received).toEqual([
            { done: false, value: null },
            { done: true, value: undefined },
          ])
        }
      } finally {
        await client.dispose()
        await server.dispose()
        await transports.dispose()
      }
    },
  )

  test('event data preserves null fields', async () => {
    const eventProtocol = { event: protocol.event } as const satisfies ProtocolDefinition
    type EventProtocol = typeof eventProtocol
    const transports = new DirectTransports<
      AnyServerMessageOf<EventProtocol>,
      AnyClientMessageOf<EventProtocol>
    >()
    const handled = Promise.withResolvers<unknown>()
    const server = serve<EventProtocol>({
      protocol: eventProtocol,
      handlers: {
        event: ({ data }) => {
          handled.resolve(data)
        },
      },
      requireAuth: false,
      transport: transports.server,
    })
    const client = new Client<EventProtocol>({ transport: transports.client })
    try {
      await client.sendEvent('event', { data: { value: null } })
      await expect(handled.promise).resolves.toEqual({ value: null })
    } finally {
      await client.dispose()
      await server.dispose()
      await transports.dispose()
    }
  })
})
