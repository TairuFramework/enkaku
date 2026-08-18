import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken } from '@kokuin/token'
import { describe, expect, test } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

// Regression: a request for a procedure with no registered handler must reply
// with an error so the client rejects, rather than leaving it to hang until its
// own timeout. `handleRequest` returns a synchronous Error in that case (the
// handler never starts, so nothing is sent from `executeHandler`); before the
// fix, `processHandler`'s `returned instanceof Error` branch emitted a local
// event but never sent the error payload to the client.
describe('missing handler reply', () => {
  const protocol = {
    known: {
      type: 'request',
      param: { type: 'string' },
      result: { type: 'string' },
    },
  } as const satisfies ProtocolDefinition
  type Protocol = typeof protocol

  test('replies with an error for an unregistered request procedure', async () => {
    const handlers = {
      known: (ctx: { param: string }) => ctx.param,
    } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers,
      transport: transports.server,
    })

    await transports.client.write(
      // @ts-expect-error: `unknown` is not in the protocol/handlers — the server has no handler.
      createUnsignedToken({ typ: 'request', prc: 'unknown', rid: 'r1', prm: 'hi' }),
    )

    const response = await transports.client.read()
    const payload = response.value?.payload as Record<string, unknown> | undefined
    expect(payload?.typ).toBe('error')
    expect(payload?.rid).toBe('r1')
    expect(payload?.msg).toBe('No handler for procedure: unknown')

    await server.dispose()
    await transports.dispose()
  })
})
