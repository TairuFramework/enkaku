import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken } from '@kokuin/token'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

// Regression guard for the "two independent rid generators for one event
// message" fix in server.ts: an event carries no rid of its own, so the
// server used to mint TWO of them independently -- `runtime.getRandomID()` to
// key the dispose drain barrier (`pending`), and a *separate*
// `Math.random().toString(36).slice(2)` inside `processHandler` to key the
// limiter bookkeeping (`controllers`/`running`). The limiter's rid is the one
// this test observes, via the `handlerStart`/`handlerEnd` events it carries.
describe('event rid generation', () => {
  test('the limiter bookkeeping rid for an event comes from the injected getRandomID, not Math.random()', async () => {
    const generatedIDs: Array<string> = []
    const getRandomID = vi.fn(() => {
      const id = `custom-id-${generatedIDs.length}`
      generatedIDs.push(id)
      return id
    })

    const handler = vi.fn()
    const handlers = { test: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      requireAuth: false,
      transport: transports.server,
      getRandomID,
    })

    const handlerStart = vi.fn()
    const handlerEnd = vi.fn()
    server.events.on('handlerStart', handlerStart)
    server.events.on('handlerEnd', handlerEnd)

    await transports.client.write(
      createUnsignedToken({
        typ: 'event',
        prc: 'test',
        data: {},
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(handler).toHaveBeenCalled()
    expect(handlerStart).toHaveBeenCalledTimes(1)
    const [startEvent] = handlerStart.mock.calls[0] as [{ rid: string }]

    // THE DISCRIMINATING ASSERTION: on unfixed code, `startEvent.rid` is a
    // `Math.random().toString(36).slice(2)` string that has nothing to do with
    // the injected `getRandomID` -- it would not appear in `generatedIDs`
    // (astronomically unlikely to collide with our deterministic
    // `custom-id-N` values). On fixed code, `processHandler` receives the
    // exact id `track()` was keyed with, which came from `runtime.getRandomID()`
    // -- i.e. from this mock -- so it must appear here.
    expect(generatedIDs).toContain(startEvent.rid)

    // Same rid should flow through to handlerEnd -- processHandler keys its
    // own start/end bookkeeping consistently.
    expect(handlerEnd).toHaveBeenCalledTimes(1)
    const [endEvent] = handlerEnd.mock.calls[0] as [{ rid: string }]
    expect(endEvent.rid).toBe(startEvent.rid)

    await server.dispose()
    await transports.dispose()
  })
})
