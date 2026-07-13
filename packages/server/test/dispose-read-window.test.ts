import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ProtocolDefinition,
  ServerTransportOf,
} from '@enkaku/protocol'
import { DirectTransports, type TransportEvents } from '@enkaku/transport'
import { createUnsignedToken, randomIdentity } from '@kokuin/token'
import { defer } from '@sozai/async'
import { EventEmitter } from '@sozai/event'
import { describe, expect, test, vi } from 'vitest'

import type { AllowContext } from '../src/access-control.js'
import { type ProcedureHandlers, Server, serve } from '../src/index.js'

const protocol = {
  'test/slow': { type: 'request', result: { type: 'string' } },
  'test/second': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('messages arriving while dispose() is draining', () => {
  test('a message read mid-drain does not start a handler', async () => {
    // Handler 1 holds the drain open: dispose() aborts its controller, then
    // parks on `running` waiting for it. That await is the window in which
    // handleNext() is still free to read message 2 off a live transport.
    //
    // The handler must NOT resolve on abort -- if it did, the drain would finish
    // before message 2 could land and the window would never open.
    const slowGate = defer<void>()
    const secondHandler = vi.fn(() => 'should never run')

    const handlers = {
      'test/slow': () => slowGate.promise,
      'test/second': secondHandler,
    } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({ handlers, requireAuth: false, transport: transports.server })

    const r1Started = server.events.once('handlerStart', {
      filter: (data) => data.rid === 'r1',
    })
    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        rid: 'r1',
        prc: 'test/slow',
      }) as AnyClientMessageOf<Protocol>,
    )
    await r1Started

    // Begin disposal. The sweep aborts r1's controller, then awaits `running`.
    //
    // Driven off the `handlerAbort` event rather than a guessed delay: `Disposer`
    // (@sozai/async) sets `disposer.signal.aborted` synchronously the instant
    // `dispose()`/`abort()` is called, well before the async dispose body (which
    // emits `handlerAbort` once it reaches the abort-all loop) ever runs -- so by
    // the time this event fires, the window `handleNext`'s bail is supposed to
    // catch message 2 in is unconditionally already open. A bare `setTimeout`
    // guess for "is dispose() draining yet" could, on a slow box, resolve before
    // that window opens, or after the drain has already finished -- either way
    // message 2 would never actually land mid-drain and the test would pass
    // vacuously. Waiting on the real event this way cannot miss the window.
    const r1Aborted = server.events.once('handlerAbort', { filter: (data) => data.rid === 'r1' })
    const disposed = server.dispose()
    await r1Aborted

    // Message 2 lands *while dispose() is draining*. The transport is still
    // readable -- it is only disposed after `handling.done` resolves.
    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        rid: 'r2',
        prc: 'test/second',
      }) as AnyClientMessageOf<Protocol>,
    )
    // Give handleNext a chance to read (and, correctly, drop) message 2 before
    // the drain it is racing completes. This wait is ordinary async settling
    // time, not a guess about when the drain window opens -- that part is now
    // pinned by the event above.
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Let handler 1 finish so dispose() can complete.
    slowGate.resolve()
    await disposed

    // Give anything the disposer failed to wait for a chance to surface.
    await new Promise((resolve) => setTimeout(resolve, 50))

    // The defect: r2's handler runs on a controller registered after the
    // abort-all sweep, so nothing will ever abort it -- it runs to completion
    // after dispose() has already resolved.
    expect(secondHandler).not.toHaveBeenCalled()

    await transports.dispose()
  })

  test('a message read after a replay-cache failure does not start a handler', async () => {
    // THE DISCRIMINATING TEST. This is the only route on which the disposer is
    // disposed *while the read loop keeps running*: the auth-mode `process()` is
    // async and handleNext does NOT await it (it goes into `pending` via track()),
    // so when checkReplay throws and process() calls disposer.dispose(), handleNext
    // is still parked on transport.read().
    //
    // Crucially, the server's #abortController -- which arrives as the `signal`
    // param -- is NEVER aborted here. So a bail that checked `signal` instead of
    // `disposer.signal` sails straight past this and runs the handler. Every other
    // dispose route returns from handleNext immediately, killing the loop, and so
    // cannot tell the two checks apart.
    //
    // Verified on unfixed code: the handler runs.
    const signer = randomIdentity()
    const secondHandler = vi.fn(() => 'should never run')
    const handlers = {
      'test/slow': () => 'first',
      'test/second': secondHandler,
    } as unknown as ProcedureHandlers<Protocol>

    // Throws on the FIRST check only, succeeds afterwards. If it threw every time,
    // message 2 would bail at the replay gate regardless of the fix and the test
    // would be vacuous -- it would pass on unfixed code.
    let calls = 0
    const cache = {
      checkAndRecord: () => {
        calls += 1
        if (calls === 1) {
          throw new Error('replay cache exploded')
        }
        return true
      },
    }

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: signer,
      accessRules: { '*': { allow: true } },
      transport: transports.server,
      replay: { cache },
      limits: { cleanupTimeoutMs: 500 },
    })

    const m1 = await signer.signToken({
      typ: 'request',
      prc: 'test/slow',
      rid: 'r1',
      aud: signer.id,
    } as const)

    // Let the cache throw and take the dispose route -- driven off the
    // `transportError` event this catch block emits rather than a guessed
    // delay. `events.emit(...)` (@sozai/event) invokes its listeners
    // synchronously as part of building the settle list, before its own first
    // internal `await` -- so our listener (and thus this promise's
    // resolution) fires before `void disposer.dispose()`, the very next
    // statement in that catch block, has run. Since resuming from an `await`
    // always costs at least one microtask, by the time this `await` hands
    // control back to us, `disposer.dispose()` -- and with it,
    // `disposer.signal.aborted` -- is unconditionally already set. A bare
    // `setTimeout` guess here risks firing before that point on a loaded box,
    // which would make message 2 land too early and pass this test vacuously.
    const replayCacheFailed = server.events.once('transportError')
    await transports.client.write(m1 as unknown as AnyClientMessageOf<Protocol>)
    await replayCacheFailed
    expect(calls).toBe(1)

    const m2 = await signer.signToken({
      typ: 'request',
      prc: 'test/second',
      rid: 'r2',
      aud: signer.id,
    } as const)
    await transports.client.write(m2 as unknown as AnyClientMessageOf<Protocol>)
    // Give handleNext a chance to read (and, correctly, drop) message 2. This
    // wait is ordinary async settling time, not a guess about when the replay
    // failure occurs -- that part is now pinned by the event above.
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(secondHandler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('dispose() does not deadlock when the replay cache throws', async () => {
    // server.ts:689 does `await disposer.dispose()` from inside process(), which is
    // itself an entry in `pending` -- and the disposer's first act is to await every
    // entry in `pending`. process waits on dispose; dispose waits on process.
    //
    // The graceful path therefore never completes and Server.dispose() escapes only
    // via its cleanupTimeoutMs race, burning the whole timeout (30s by default).
    // Measured: unresolved after 3s on the default timeout; ~700ms with a 500ms one.
    //
    // cleanupTimeoutMs is set high here on purpose: it is the force path's budget, so
    // the fixed graceful path must resolve *well inside* it. Under the deadlock this
    // test reds on the 2s race below -- a timeout attributable to the graceful path
    // never completing, not to a generically slow test.
    const signer = randomIdentity()
    const handlers = {
      'test/slow': () => 'first',
      'test/second': () => 'second',
    } as unknown as ProcedureHandlers<Protocol>

    const cache = {
      checkAndRecord: () => {
        throw new Error('replay cache exploded')
      },
    }

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: signer,
      accessRules: { '*': { allow: true } },
      transport: transports.server,
      replay: { cache },
      limits: { cleanupTimeoutMs: 30_000 },
    })

    const message = await signer.signToken({
      typ: 'request',
      prc: 'test/slow',
      rid: 'r1',
      aud: signer.id,
    } as const)
    await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)
    await new Promise((resolve) => setTimeout(resolve, 50))

    const outcome = await Promise.race([
      server.dispose().then(() => 'resolved'),
      new Promise((resolve) => setTimeout(() => resolve('deadlocked'), 2_000)),
    ])

    expect(outcome).toBe('resolved')

    await transports.dispose()
  }, 40_000)
})

describe('self-dispose routes leave the transport behind', () => {
  // `disposer.disposed` (server.ts) IS `handling.done` (Server.handle()), and
  // `handle()` splices the handling entry out of `#handling` as soon as `done`
  // resolves. On every route where `handleMessages` disposes *itself* --
  // replay-cache throw, transport read error, `next.done` -- that splice can
  // happen before `Server.dispose()` ever runs, so its
  // `handling.transport.dispose()` call and force-dispose path never get a
  // chance to run either. Nothing else closes the transport: a healthy
  // transport whose only fault was a broken replay cache (or a peer that hung
  // up) is abandoned open.
  test('a replay-cache failure disposes its own transport once server.dispose() resolves', async () => {
    const signer = randomIdentity()
    const handlers = {
      'test/slow': () => 'first',
      'test/second': () => 'second',
    } as unknown as ProcedureHandlers<Protocol>

    const cache = {
      checkAndRecord: () => {
        throw new Error('replay cache exploded')
      },
    }

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: signer,
      accessRules: { '*': { allow: true } },
      transport: transports.server,
      replay: { cache },
      limits: { cleanupTimeoutMs: 500 },
    })

    const message = await signer.signToken({
      typ: 'request',
      prc: 'test/slow',
      rid: 'r1',
      aud: signer.id,
    } as const)
    await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

    // Let the cache throw and take the (now non-deadlocking) self-dispose route.
    await new Promise((resolve) => setTimeout(resolve, 50))

    await server.dispose()

    // Race rather than bare-await `transports.server.disposed`: on unfixed code
    // that promise never settles, so a bare await would just time out the whole
    // test with no indication of what failed. Racing gives a concrete assertion
    // failure instead.
    const outcome = await Promise.race([
      transports.server.disposed.then(() => 'disposed'),
      new Promise((resolve) => setTimeout(() => resolve('not-disposed'), 300)),
    ])

    expect(outcome).toBe('disposed')

    await transports.dispose()
  })

  test('a peer hanging up (transport.read() returning done) disposes its own transport', async () => {
    // Disposing only the client side closes the client's writable half of the
    // connection, which surfaces as `done: true` on the *server's* next
    // `transport.read()` -- the same as a real peer disconnecting. This never
    // calls `server.dispose()` at all: it exercises handleMessages' own
    // self-dispose route (server.ts:735) in isolation.
    const handlers = {
      'test/slow': () => 'first',
      'test/second': () => 'second',
    } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({ handlers, requireAuth: false, transport: transports.server })

    // A message first, so the client's writer is actually established --
    // `Transport.dispose()` only closes the underlying writable if `_stream`
    // was already obtained by a prior read/write, otherwise there is nothing
    // for it to close and the server never sees `done`.
    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        rid: 'r1',
        prc: 'test/slow',
      }) as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    await transports.client.dispose()

    const outcome = await Promise.race([
      transports.server.disposed.then(() => 'disposed'),
      new Promise((resolve) => setTimeout(() => resolve('not-disposed'), 300)),
    ])

    expect(outcome).toBe('disposed')

    // `Server.handle()` splices its handling entry out on a `.then()` chained
    // onto `disposer.disposed` itself, one more microtask hop past the point
    // where `transports.server.disposed` above resolves -- give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(server.activeTransportsCount).toBe(0)

    await server.dispose()
  })

  test('a transport read error disposes its own transport', async () => {
    // Exercises the transport-read-error self-dispose route (server.ts:731) in
    // isolation, via a hand-rolled transport whose `read()` rejects on first
    // call -- mirroring transport-read-failure.test.ts, but asserting on
    // `dispose` having actually been called rather than just on `handle()`
    // settling.
    const failingTransport = {
      read: vi.fn(() => Promise.reject(new Error('read boom'))),
      write: vi.fn(() => Promise.resolve()),
      dispose: vi.fn(() => Promise.resolve()),
      events: new EventEmitter<TransportEvents>(),
    } as unknown as ServerTransportOf<Protocol>

    const server = new Server<Protocol>({
      handlers: {
        'test/slow': () => 'first',
        'test/second': () => 'second',
      } as unknown as ProcedureHandlers<Protocol>,
      protocol,
      requireAuth: false,
    })

    await server.handle(failingTransport)

    expect(failingTransport.dispose).toHaveBeenCalled()

    await server.dispose()
  })
})

describe('ordering: transport disposal must wait for the running-handler drain', () => {
  // Pins `await transport.dispose()` (server.ts, end of handleMessages' own
  // disposer) to running AFTER the `pending`/`running` drains. Moving that line
  // to the TOP of the disposer callback -- closing the transport before any
  // still-finishing handler gets a chance to flush its reply -- does NOT fail
  // the rest of the server suite: every other test's in-flight handler either
  // never sends (its controller was aborted with a non-'Close' reason, so
  // `safeWrite`'s `canSend` guard drops the send before it ever reaches the
  // transport) or finishes before dispose() is ever called. This test is the
  // only one that exercises a handler which is still legitimately running --
  // never aborted -- at the moment the transport would be (mis)closed.
  test('a handler still running when dispose() is called still delivers its reply', async () => {
    const protocol = {
      'gate/hold': { type: 'request', result: { type: 'string' } },
      'gate/reply': { type: 'request', result: { type: 'string' } },
    } as const satisfies ProtocolDefinition
    type GateProtocol = typeof protocol

    // Distinct from the server's identity: a self-signed token short-circuits
    // checkClientToken on `iss === serverID` before checkProcedureAccess ever
    // runs, which would make the predicate below never fire and this test
    // vacuous.
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    // r1 ('gate/hold') parks its OWN access check on `authGate`, which keeps
    // r1's entry in `pending` and therefore holds open the disposer's
    // `await Promise.all(Object.values(pending))` -- the abort-all sweep cannot
    // run until that resolves.
    const authGate = defer<void>()
    // r2 ('gate/reply') parks its HANDLER (not its access check) on
    // `replyGate`. Its access check resolves immediately, so by the time
    // dispose() is called r2 is already out of `pending` and into `running`,
    // untouched by the abort sweep for as long as r1 keeps `pending` open.
    const replyGate = defer<void>()

    const handlers = {
      'gate/hold': () => 'unused',
      'gate/reply': () => replyGate.promise.then(() => 'reply-value'),
    } as unknown as ProcedureHandlers<GateProtocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<GateProtocol>,
      AnyClientMessageOf<GateProtocol>
    >()
    const server = serve<GateProtocol>({
      handlers,
      identity: serverSigner,
      accessRules: {
        '*': {
          allow: async (ctx: AllowContext) => {
            if (ctx.procedure === 'gate/hold') {
              await authGate.promise
            }
            return true
          },
        },
      },
      transport: transports.server,
    })

    const holdMessage = await clientSigner.signToken({
      typ: 'request',
      prc: 'gate/hold',
      rid: 'r1',
      aud: serverSigner.id,
    } as const)
    await transports.client.write(holdMessage as unknown as AnyClientMessageOf<GateProtocol>)
    // Let r1's access check reach and park on authGate.
    await new Promise((resolve) => setTimeout(resolve, 20))

    const replyMessage = await clientSigner.signToken({
      typ: 'request',
      prc: 'gate/reply',
      rid: 'r2',
      aud: serverSigner.id,
    } as const)
    await transports.client.write(replyMessage as unknown as AnyClientMessageOf<GateProtocol>)
    // Let r2's access check resolve and its handler start (and park on
    // replyGate) -- so r2 is out of `pending` and into `running` before
    // dispose() is called.
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Begin disposal. Fixed code blocks here on `await Promise.all(pending)`
    // (r1 is still parked on authGate) before it ever reaches
    // `transport.dispose()`. Mutated code (transport.dispose() moved to the
    // top) closes the transport right now, before either drain runs.
    const disposed = server.dispose()
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Let r2's handler finish and send its reply *while dispose() is still
    // draining `pending`* -- r2's controller was never aborted (the abort
    // sweep can't run until r1 clears `pending`), so this is a legitimate send
    // racing only the transport's own disposal, not the abort path.
    replyGate.resolve()

    // Race rather than a bare await: under the mutated code the transport is
    // already closed, so the client's read never resolves with a value at all
    // (DirectTransports surfaces the peer's dispose as `done: true` on some
    // schedule, if at all) -- a bare await would just hang the test.
    const response = await Promise.race([
      transports.client.read(),
      new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), 300),
      ),
    ])

    expect(response.value?.payload.typ).toBe('result')
    expect(response.value?.payload.rid).toBe('r2')
    expect((response.value?.payload as Record<string, unknown> | undefined)?.val).toBe(
      'reply-value',
    )

    // Let dispose() finish.
    authGate.resolve()
    await disposed

    await transports.dispose()
  })
})
