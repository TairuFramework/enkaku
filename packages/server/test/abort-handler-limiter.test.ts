import {
  type AnyClientMessageOf,
  type AnyServerMessageOf,
  ErrorCodes,
  type ProtocolDefinition,
} from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken } from '@kokuin/token'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  slow: { type: 'request', param: { type: 'string' }, result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

// Guards the correctness property behind `abortRunningHandler` in server.ts:
// aborting via `requestAborted` must release the handler-concurrency slot
// EXACTLY ONCE, via processHandler's completion handler -- never in
// `abortRunningHandler` itself. Under a single-slot setup
// (maxConcurrentHandlers: 1), `ResourceLimiter.releaseHandler` clamps at 0, so
// a single stray release is invisible once the aborted handler's own
// (legitimate) release also fires: both releases land on the same credit and
// the floor absorbs the extra decrement. To make an over-release observable
// we keep a SECOND handler ("keepAlive") concurrently running in a 2-slot
// pool: it never aborts and never releases its own slot until the test tears
// down. A stray release inside `abortRunningHandler` then steals keepAlive's
// still-held credit instead of harmlessly re-decrementing an already-zeroed
// one, which lets a third request illegitimately acquire a slot that should
// still be occupied.
describe('requestAborted releases the handler slot exactly once', () => {
  test('freed slot admits exactly one more handler, not two', async () => {
    const resolvers = new Map<string, () => void>()
    const started: Array<string> = []
    const handler = vi.fn((ctx) => {
      started.push(ctx.param as string)
      return new Promise<string>((resolve) => {
        resolvers.set(ctx.param as string, () => resolve('done'))
        ctx.signal.addEventListener('abort', () => resolve('aborted'))
      })
    })
    const handlers = { slow: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers,
      transport: transports.server,
      limits: { maxConcurrentHandlers: 2, maxControllers: 10 },
    })

    const limitErrors = vi.fn()
    server.events.on('handlerError', (event) => {
      if (event.category === 'limit') {
        limitErrors(event)
      }
    })

    // keepAlive ("K") occupies one of the two slots for the whole test: it is
    // never aborted and only resolves at teardown.
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'slow', rid: 'k', prm: 'K' }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(started).toEqual(['K'])

    // A occupies the second (and last) slot.
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'slow', rid: 'a', prm: 'A' }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(started).toEqual(['K', 'A'])

    // Abort A only via the transport's requestAborted event (not the client
    // 'abort' message path) -- this is the site under test. K keeps running.
    await transports.server.events.emit('requestAborted', {
      rid: 'a',
      reason: 'ClientDisconnected',
    })
    // Let A's handler promise settle and processHandler's completion handler
    // run, releasing A's slot exactly once.
    await new Promise((resolve) => setTimeout(resolve, 20))

    // B should be ACCEPTED: A's slot was freed. This catches UNDER-release
    // (a slot that never frees).
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'slow', rid: 'b', prm: 'B' }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(started).toEqual(['K', 'A', 'B'])

    // C must be REJECTED: K and B now legitimately occupy both slots. If
    // abortRunningHandler had double-released A's slot, the pool would be
    // inflated (or underflowed) and C would be wrongly accepted here.
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'slow', rid: 'c', prm: 'C' }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(started).toEqual(['K', 'A', 'B'])
    expect(limitErrors).toHaveBeenCalledTimes(1)
    const [limitEvent] = limitErrors.mock.calls[0] as [{ error: { code: string; message: string } }]
    expect(limitEvent.error.code).toBe(ErrorCodes.HANDLER_LIMIT)
    expect(limitEvent.error.message).toBe('Server handler limit reached')

    resolvers.get('K')?.()
    resolvers.get('B')?.()
    await server.dispose()
    await transports.dispose()
  })
})
