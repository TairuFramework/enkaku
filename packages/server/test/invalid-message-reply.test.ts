import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  echo: {
    type: 'request',
    param: { type: 'string' },
    result: { type: 'string' },
  },
  data: {
    type: 'stream',
    param: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
  chat: {
    type: 'channel',
    param: { type: 'string' },
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
  notify: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function setup() {
  const handler = vi.fn((ctx: { param: string }) => ctx.param)
  const handlers = {
    echo: handler,
    data: vi.fn(async () => 'done'),
    chat: vi.fn(async () => 'done'),
    notify: vi.fn(),
  } as unknown as ProcedureHandlers<Protocol>
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
  return { handler, server, transports }
}

describe('Schema-invalid message error replies', () => {
  test('replies with EK08 for invalid request carrying a rid', async () => {
    const { handler, server, transports } = setup()

    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        prc: 'echo',
        rid: 'r1',
        prm: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('r1')
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('replies with EK08 for invalid stream carrying a rid', async () => {
    const { server, transports } = setup()

    await transports.client.write(
      createUnsignedToken({
        typ: 'stream',
        prc: 'data',
        rid: 's1',
        prm: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('s1')
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')

    await server.dispose()
    await transports.dispose()
  })

  test('replies with EK08 for invalid channel carrying a rid', async () => {
    const { server, transports } = setup()

    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'chat',
        rid: 'c1',
        prm: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('c1')
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')

    await server.dispose()
    await transports.dispose()
  })

  test('still emits invalidMessage and sends no reply for invalid event (no reply channel)', async () => {
    const { server, transports } = setup()

    const invalidEvents: Array<unknown> = []
    server.events.on('invalidMessage', (event) => {
      invalidEvents.push(event)
    })

    await transports.client.write(
      createUnsignedToken({
        typ: 'event',
        prc: 'notify',
        dat: 'not-an-object',
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'echo', rid: 'r2', prm: 'hello' }),
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('result')
    expect(response.value?.payload.rid).toBe('r2')
    expect(invalidEvents.length).toBe(1)

    await server.dispose()
    await transports.dispose()
  })

  test('invalidMessage event is still emitted alongside the EK08 reply', async () => {
    const { server, transports } = setup()

    const invalidEvents: Array<unknown> = []
    server.events.on('invalidMessage', (event) => {
      invalidEvents.push(event)
    })

    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        prc: 'echo',
        rid: 'r3',
        prm: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')
    expect(invalidEvents.length).toBe(1)

    await server.dispose()
    await transports.dispose()
  })
})
