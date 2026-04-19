import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, type RequestHandler, serve } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

const protocol = {
  ping: {
    type: 'request',
    result: { type: 'object', properties: { ok: { type: 'boolean' } } },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Client lifecycle events', () => {
  test('emits requestStart and requestEnd ok', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      accessControl: false,
      handlers: {
        ping: (async () => ({ ok: true })) as RequestHandler<Protocol, 'ping'>,
      } as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
    })
    const client = new Client<Protocol>({ transport: transports.client })
    const start = vi.fn()
    const end = vi.fn()
    client.events.on('requestStart', start)
    client.events.on('requestEnd', end)

    const result = await client.request('ping')

    expect(result).toEqual({ ok: true })
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ procedure: 'ping', type: 'request' }),
    )
    expect(end).toHaveBeenCalledWith(expect.objectContaining({ procedure: 'ping', status: 'ok' }))

    await client.dispose()
    await server.dispose()
  })

  test('emits disposing and disposed around client.dispose()', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })
    const disposing = vi.fn()
    const disposed = vi.fn()
    client.events.on('disposing', disposing)
    client.events.on('disposed', disposed)

    await client.dispose('test-reason')

    expect(disposing).toHaveBeenCalledWith({ reason: 'test-reason' })
    expect(disposed).toHaveBeenCalledWith({ reason: 'test-reason' })
  })
})
