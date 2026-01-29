import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

describe('Per-message size limits', () => {
  test('rejects oversized request with EK06 error', async () => {
    const protocol = {
      echo: {
        type: 'request',
        param: { type: 'string' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = vi.fn((ctx) => ctx.param)
    const handlers = { echo: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
      limits: { maxMessageSize: 50 },
    })

    // Send a request with a large param that exceeds the limit
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'echo', rid: 'r1', prm: 'x'.repeat(200) }),
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('r1')
    expect(response.value?.payload.code).toBe('EK06')
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('rejects oversized stream message with EK06 error', async () => {
    const protocol = {
      data: {
        type: 'stream',
        param: { type: 'string' },
        receive: { type: 'string' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = vi.fn(async () => {
      return 'done'
    })
    const handlers = { data: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
      limits: { maxMessageSize: 50 },
    })

    await transports.client.write(
      createUnsignedToken({ typ: 'stream', prc: 'data', rid: 's1', prm: 'x'.repeat(200) }),
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('s1')
    expect(response.value?.payload.code).toBe('EK06')
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('rejects oversized channel message with EK06 error', async () => {
    const protocol = {
      chat: {
        type: 'channel',
        param: { type: 'string' },
        send: { type: 'string' },
        receive: { type: 'string' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = vi.fn(async () => {
      return 'done'
    })
    const handlers = { chat: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
      limits: { maxMessageSize: 50 },
    })

    await transports.client.write(
      createUnsignedToken({ typ: 'channel', prc: 'chat', rid: 'c1', prm: 'x'.repeat(200) }),
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('c1')
    expect(response.value?.payload.code).toBe('EK06')
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('rejects oversized event message silently (no rid)', async () => {
    const protocol = {
      notify: {
        type: 'event',
        data: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = vi.fn()
    const handlers = { notify: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
      limits: { maxMessageSize: 50 },
    })

    const errorEvents: Array<unknown> = []
    server.events.on('handlerError', (event) => {
      errorEvents.push(event)
    })

    await transports.client.write(
      createUnsignedToken({ typ: 'event', prc: 'notify', dat: 'x'.repeat(200) }),
    )

    // Wait for the message to be processed
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(handler).not.toHaveBeenCalled()
    expect(errorEvents.length).toBe(1)
    expect((errorEvents[0] as { error: { code: string } }).error.code).toBe('EK06')

    await server.dispose()
    await transports.dispose()
  })

  test('allows messages within size limit', async () => {
    const protocol = {
      echo: {
        type: 'request',
        param: { type: 'string' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = vi.fn((ctx) => ctx.param)
    const handlers = { echo: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
      limits: { maxMessageSize: 10000 },
    })

    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'echo', rid: 'r1', prm: 'hello' }),
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('result')
    expect(response.value?.payload.val).toBe('hello')

    await server.dispose()
    await transports.dispose()
  })
})
