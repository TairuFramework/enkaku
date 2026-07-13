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

import { type ProcedureHandlers, Server, serve } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Race `promise` against a deadline, CLEARING the loser's timer -- otherwise these
 * very tests leak the armed timers that the timer-leak tests below count.
 */
async function settlesWithin<T>(promise: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * A transport whose `read()` never settles (so the read loop parks and the entry
 * stays in the server's handling list) and whose `dispose()` behaviour is chosen
 * per test. `dispose` is memoised the way a real `Disposer` is: a second call
 * hands back the very same promise, so a `dispose()` that never settles never
 * settles for ANY caller -- which is precisely what makes an unbounded `await` on
 * it in the shutdown backstop hang forever.
 */
function hostileTransport(settle: 'never' | 'immediate'): {
  transport: ServerTransportOf<Protocol>
  disposeCalls: () => number
} {
  let calls = 0
  let shared: Promise<void> | undefined
  const transport = {
    read: () => new Promise(() => {}),
    write: () => Promise.resolve(),
    dispose: () => {
      calls += 1
      shared ??= settle === 'never' ? new Promise<void>(() => {}) : Promise.resolve()
      return shared
    },
    events: new EventEmitter<TransportEvents>(),
  } as unknown as ServerTransportOf<Protocol>
  return { transport, disposeCalls: () => calls }
}

function countTimers(): number {
  return process.getActiveResourcesInfo().filter((resource) => resource === 'Timeout').length
}

/**
 * The test runner itself holds one short-lived timer for the first ~100ms of a
 * worker's life; wait it out so the baseline below is a genuine zero and the
 * assertions are absolute rather than relative to runner noise.
 */
async function quiesce(): Promise<void> {
  await sleep(150)
}

describe('a transport whose dispose() never settles cannot hang the server', () => {
  // CRITICAL. `handleMessages`' own disposer bounds its `transport.dispose()` by
  // `cleanupTimeoutMs`, which is what keeps `Server.handle()` from hanging. But
  // that inner bound is armed only AFTER the pending/running drains, i.e. strictly
  // later than the outer `cleanupTimeoutMs` bound `Server.dispose()` arms at t=0 --
  // and the two are EQUAL. So the outer one always fires first, `gracefulDone` is
  // false, the handling entry has NOT yet been spliced out, and the force path runs
  // with the entry still present. If that force path does a bare
  // `await handling.transport.dispose()`, it re-awaits the same never-settling
  // deferred and `Server.dispose()` hangs FOREVER -- the bound added to protect
  // `handle()` having created an unbounded wait in `dispose()`.
  test('handle() AND dispose() both settle against a never-settling transport.dispose()', async () => {
    const { transport, disposeCalls } = hostileTransport('never')

    const server = new Server<Protocol>({
      handlers: { test: vi.fn() } as unknown as ProcedureHandlers<Protocol>,
      protocol,
      requireAuth: false,
      limits: { cleanupTimeoutMs: 100 },
    })

    const handling = server.handle(transport)
    let handleSettled = false
    void handling.then(() => {
      handleSettled = true
    })
    expect(server.activeTransportsCount).toBe(1)

    const disposeOutcome = await settlesWithin(
      server.dispose().then(() => 'disposed' as const),
      2000,
      'still-hanging' as const,
    )
    // Pre-fix this is 'still-hanging': the force path's bare
    // `await handling.transport.dispose()` never returns.
    expect(disposeOutcome).toBe('disposed')

    // And `handle()` itself settled too, on the inner bound.
    await settlesWithin(handling, 500, undefined)
    expect(handleSettled).toBe(true)

    expect(disposeCalls()).toBeGreaterThan(0)
  })

  // CRITICAL. The force path is the backstop the whole shutdown premise rests on,
  // so it must dispose EVERY transport still in the handling list -- it cannot let
  // one hostile transport starve the ones after it. A serial
  // `for (...) await handling.transport.dispose()` does exactly that: it parks on
  // the first never-settling dispose and the second transport is never closed.
  test('force disposal reaches every handled transport, even behind a hostile one', async () => {
    const hostile = hostileTransport('never')
    const healthy = hostileTransport('immediate')

    const server = new Server<Protocol>({
      handlers: { test: vi.fn() } as unknown as ProcedureHandlers<Protocol>,
      protocol,
      requireAuth: false,
      limits: { cleanupTimeoutMs: 100 },
    })

    // Order matters: the hostile transport is FIRST, so a serial backstop never
    // reaches the healthy one behind it.
    server.handle(hostile.transport)
    server.handle(healthy.transport)
    expect(server.activeTransportsCount).toBe(2)

    const disposeOutcome = await settlesWithin(
      server.dispose().then(() => 'disposed' as const),
      2000,
      'still-hanging' as const,
    )
    expect(disposeOutcome).toBe('disposed')

    // Pre-fix: 0. The serial force loop is still parked on the hostile transport.
    expect(healthy.disposeCalls()).toBeGreaterThan(0)
    expect(hostile.disposeCalls()).toBeGreaterThan(0)
  })
})

describe('no cleanup timer outlives the disposal that armed it', () => {
  // CRITICAL. `Promise.race` does not cancel the loser. `handleMessages`' disposer
  // races `transport.dispose()` against a `cleanupTimeoutMs` timer, and
  // `transport.dispose()` wins that race on every NORMAL disconnect -- so without a
  // `clearTimeout`, every client hang-up leaves one live 30s timer behind while
  // `activeTransportsCount` already reports the server fully clean.
  test('a client hang-up leaves no armed timer behind', async () => {
    const CLIENTS = 5
    const server = new Server<Protocol>({
      handlers: { test: vi.fn() } as unknown as ProcedureHandlers<Protocol>,
      protocol,
      requireAuth: false,
      // Long on purpose: a leaked timer must still be armed when we count.
      limits: { cleanupTimeoutMs: 30_000 },
    })

    await quiesce()
    const baseline = countTimers()
    expect(baseline).toBe(0)

    const all: Array<DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>> =
      []
    for (let i = 0; i < CLIENTS; i++) {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      all.push(transports)
      server.handle(transports.server)
      await transports.client.write(
        createUnsignedToken({
          typ: 'event',
          prc: 'test',
          data: {},
        }) as AnyClientMessageOf<Protocol>,
      )
    }
    expect(server.activeTransportsCount).toBe(CLIENTS)

    // Every client hangs up cleanly: the `next.done` route in `handleNext`.
    for (const transports of all) {
      await transports.client.dispose()
    }
    await sleep(100)

    // Teardown reports fully clean...
    expect(server.activeTransportsCount).toBe(0)
    // ...so nothing may still be holding the event loop. Pre-fix: 5 -- one live
    // 30s timer per disconnect, orphaned by the uncancelled `Promise.race` loser.
    expect(countTimers()).toBe(baseline)

    await server.dispose()
    for (const transports of all) {
      await transports.dispose()
    }
  })

  // CRITICAL. Same bug, other site: `Server.dispose()` arms its own
  // `cleanupTimeoutMs` timer for the graceful race. The graceful path wins in the
  // normal case, so that timer is left armed and holds the process open for
  // `cleanupTimeoutMs` AFTER `dispose()` has already resolved. Bisected as an
  // INDEPENDENT hold from the one above -- both must be cleared.
  test('Server.dispose() leaves no armed timer behind', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers: { test: vi.fn() } as unknown as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
      limits: { cleanupTimeoutMs: 30_000 },
    })

    await quiesce()
    // Includes exactly one timer belonging to this server: the handled
    // transport's controller-cleanup interval, which its disposer clears.
    const baseline = countTimers()

    await server.dispose()
    await sleep(50)

    // So disposal must NET OUT one timer, having armed nothing that outlives it.
    // Pre-fix it nets out zero: the interval goes, but the graceful race leaves
    // its 30s timer armed in the interval's place.
    expect(countTimers()).toBe(baseline - 1)

    await transports.dispose()
  })
})

describe('the disposal drain covers an event whose access check is still in flight', () => {
  // The `handleMessages` disposer drains the `pending` barrier first, and says it
  // does so because "a message whose access check is still in flight has not
  // registered its controller yet". That was false for events: `case 'event'`
  // called `process()` WITHOUT `track()`, so in auth mode an event's in-flight
  // access check was never in `pending` and the drain sailed straight past it --
  // the handler then fired after `dispose()` had already resolved.
  //
  // Events register no controller and stay deliberately fire-and-forget and
  // un-abortable; tracking them only makes the drain wait for their auth check,
  // which is exactly what the disposer already claimed to do.
  test('dispose() does not resolve before an event access check completes', async () => {
    const eventProtocol = {
      'test/event': { type: 'event', data: { type: 'object' } },
    } as const satisfies ProtocolDefinition
    type EventProtocol = typeof eventProtocol

    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    let handlerStarted = false
    const handler = vi.fn(() => {
      handlerStarted = true
    })

    // Blocks the event's access check, so `process()` is still in flight when
    // dispose() runs.
    const gate = defer<void>()
    const transports = new DirectTransports<
      AnyServerMessageOf<EventProtocol>,
      AnyClientMessageOf<EventProtocol>
    >()
    const server = serve<EventProtocol>({
      handlers: { 'test/event': handler } as unknown as ProcedureHandlers<EventProtocol>,
      identity: serverSigner,
      accessRules: {
        '*': {
          allow: async () => {
            await gate.promise
            return true
          },
        },
      },
      transport: transports.server,
    })

    const eventMsg = await clientSigner.signToken({
      typ: 'event',
      prc: 'test/event',
      data: {},
      aud: serverSigner.id,
    } as const)
    await transports.client.write(eventMsg as unknown as AnyClientMessageOf<EventProtocol>)

    // The access check is blocked at the gate.
    await sleep(20)
    expect(handlerStarted).toBe(false)

    const disposed = server.dispose()
    // Let the disposer reach its awaits, then let the access check through.
    await sleep(10)
    gate.resolve()
    await disposed

    // Pre-fix: false. The event was never tracked, so the `pending` drain did not
    // wait for it and `dispose()` resolved with its access check still in flight.
    expect(handlerStarted).toBe(true)

    await transports.dispose()
  })
})
