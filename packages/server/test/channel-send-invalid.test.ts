import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  chat: {
    type: 'channel',
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Invalid channel send', () => {
  test('replies EK08 and emits invalidMessage for a send with an invalid value', async () => {
    const handler = vi.fn(async (ctx: { readable: ReadableStream<string> }) => {
      // Keep the channel open so a controller exists for the send's rid.
      for await (const _value of ctx.readable) {
        // drain
      }
      return 'done'
    })
    const handlers = { chat: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers,
      protocol,
      transport: transports.server,
    })

    const invalidEvents: Array<unknown> = []
    server.events.on('invalidMessage', (event) => {
      invalidEvents.push(event)
    })

    // Open the channel so a controller is registered for rid 'c1'.
    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'chat',
        rid: 'c1',
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Send a value that violates the send schema (number, not string).
    await transports.client.write(
      createUnsignedToken({
        typ: 'send',
        prc: 'chat',
        rid: 'c1',
        val: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('c1')
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')
    expect(invalidEvents.length).toBe(1)

    await server.dispose()
    await transports.dispose()
  })
})
