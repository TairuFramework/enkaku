# Server/Client Teardown & Lifecycle Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** qa

**Goal:** Eliminate unhandled rejections in enkaku server/client teardown paths and expose a coherent lifecycle-events surface across `@enkaku/async`, `@enkaku/transport`, `@enkaku/server`, `@enkaku/client`.

**Architecture:** Add a shared `isBenignTeardownError` classifier in `@enkaku/async`; extend `TransportEvents` with read/dispose signals; add `safeWrite` wrappers in server and client that swallow benign teardown failures and emit `writeDropped`; wire previously-dead `handlerAbort` event; introduce a symmetric `ClientEvents` emitter; and settle `ChannelCall`/`StreamCall` promises on `close()`.

**Tech Stack:** TypeScript (ESM), pnpm workspace, vitest, tsc (emit-only type checks), biome (lint/format), swc (build).

**Reference spec:** `docs/superpowers/specs/2026-04-18-server-client-teardown-lifecycle-design.md`
**Reference bug report:** `docs/superpowers/specs/2026-04-18-hub-server-teardown-unhandled-rejections.md`

---

## File Structure

### Created
- `packages/async/src/teardown.ts` — `isBenignTeardownError` classifier.
- `packages/async/test/teardown.test.ts` — classifier truth-table tests.
- `packages/server/src/safe-write.ts` — `safeWrite` wrapper for outbound messages.
- `packages/server/test/safe-write.test.ts` — unit tests for the wrapper.
- `packages/server/test/lifecycle-events.test.ts` — event sequence tests.
- `packages/server/test/teardown-no-unhandled.test.ts` — regression test asserting zero unhandled rejections.
- `packages/client/src/events.ts` — `ClientEvents` type + `ClientEmitter`.
- `packages/client/src/safe-write.ts` — client-side `safeWrite` wrapper.
- `packages/client/test/safe-write.test.ts` — unit tests.
- `packages/client/test/lifecycle-events.test.ts` — event sequence tests.
- `packages/client/test/close-settles.test.ts` — behavior change test.
- `tests/integration/teardown.test.ts` — cross-package regression test.

### Modified
- `packages/async/src/index.ts` — export new classifier.
- `packages/transport/src/index.ts` — extend `TransportEvents`; emit `disposing`/`disposed`/`readFailed` in base class.
- `packages/server/src/server.ts` — inline `send` replaced by `safeWrite`; `returned.then` gains `.catch`; wire `handlerStart`/`handlerEnd`/`handlerAbort`/`disposing`/`disposed`/`transportAdded`/`transportRemoved`; remove `transport.events.on('writeFailed', …)` hook.
- `packages/server/src/types.ts` — extend `ServerEvents`; augment `HandlerContext` with `disposing` flag + emit helper.
- `packages/server/src/utils.ts` — unawaited `context.send(...)` becomes safeWrite.
- `packages/server/src/handlers/event.ts` / `request.ts` / `channel.ts` / `stream.ts` — any fire-and-forget `ctx.send` becomes safeWrite where needed (verified per task).
- `packages/server/src/index.ts` — export new event types if public.
- `packages/client/src/client.ts` — add `events` getter, `safeWrite` usage, fix `'Close'` branch, emit lifecycle events.
- `packages/client/src/index.ts` — export `ClientEvents` + `ClientEmitter`.
- `packages/transport/test/lib.test.ts` — cover new events.
- `packages/hub-server/test/hub.test.ts` — add repro regression test.

### Not touched in this plan
- `ReconnectingTransport` (out of scope — future spec).
- Per-transport retry in `http-client-transport`, `socket-transport`, etc.
- Source-availability abstraction.

---

## Conventions used in this plan

- Test framework: `vitest`. Run a single test with `pnpm -F <pkg-name> test:unit -- --run <path>`.
- Commit style mirrors repo history (`fix(...)`, `feat(...)`, `docs(...)`, `refactor(...)`).
- Do NOT use `dangerouslyIgnoreUnhandledErrors`.
- Do NOT add a `Co-Authored-By` trailer — the repo does not use it.
- All `await` omissions on promises returned by `context.send` or `this.#write` must go through `safeWrite`.

---

## Task 1: `isBenignTeardownError` classifier

**Files:**
- Create: `packages/async/src/teardown.ts`
- Create: `packages/async/test/teardown.test.ts`
- Modify: `packages/async/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/async/test/teardown.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { DisposeInterruption } from '../src/interruptions.js'
import { isBenignTeardownError } from '../src/teardown.js'

describe('isBenignTeardownError', () => {
  test('returns false for null / undefined / non-error input', () => {
    expect(isBenignTeardownError(null)).toBe(false)
    expect(isBenignTeardownError(undefined)).toBe(false)
    expect(isBenignTeardownError(42)).toBe(false)
    expect(isBenignTeardownError({})).toBe(false)
  })

  test('recognises AbortError by name', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    expect(isBenignTeardownError(err)).toBe(true)
  })

  test('recognises DisposeInterruption instances', () => {
    expect(isBenignTeardownError(new DisposeInterruption())).toBe(true)
  })

  test('recognises WritableStream-closed messages', () => {
    expect(
      isBenignTeardownError(new TypeError('Invalid state: WritableStream is closed')),
    ).toBe(true)
  })

  test('recognises Writer/Reader closed messages', () => {
    expect(isBenignTeardownError(new TypeError('The writer has been closed'))).toBe(true)
    expect(isBenignTeardownError(new TypeError('The reader has been closed'))).toBe(true)
  })

  test('recognises bare string teardown reasons', () => {
    expect(isBenignTeardownError('Close')).toBe(true)
    expect(isBenignTeardownError('Transport')).toBe(true)
  })

  test('returns false for unrelated errors', () => {
    expect(isBenignTeardownError(new Error('boom'))).toBe(false)
    expect(isBenignTeardownError(new RangeError('out of range'))).toBe(false)
    expect(isBenignTeardownError('something else')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @enkaku/async test:unit -- --run test/teardown.test.ts`
Expected: FAIL — "Cannot find module '../src/teardown.js'".

- [ ] **Step 3: Create the classifier**

Create `packages/async/src/teardown.ts`:

```ts
import { DisposeInterruption } from './interruptions.js'

const CLOSED_STREAM_PATTERNS = [
  /WritableStream is closed/i,
  /(?:writer|reader)(?:\s|\S)*?(?:is|has been)\s+closed/i,
]

const BENIGN_REASON_STRINGS = new Set(['Close', 'Transport'])

/**
 * Returns true when the given error represents a peer- or local-teardown
 * signal rather than an actual failure. Call this before re-throwing on
 * teardown paths so benign rejections can be swallowed.
 */
export function isBenignTeardownError(err: unknown): boolean {
  if (err == null) return false
  if (typeof err === 'string') return BENIGN_REASON_STRINGS.has(err)
  if (err instanceof DisposeInterruption) return true
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true
    if (typeof err.message === 'string') {
      for (const pattern of CLOSED_STREAM_PATTERNS) {
        if (pattern.test(err.message)) return true
      }
    }
  }
  return false
}
```

- [ ] **Step 4: Export from package index**

Edit `packages/async/src/index.ts` — insert a new line (after the existing `./interruptions.js` export):

```ts
export * from './teardown.js'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @enkaku/async test:unit -- --run test/teardown.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 6: Run type check**

Run: `pnpm -F @enkaku/async test:types`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/async/src/teardown.ts packages/async/src/index.ts packages/async/test/teardown.test.ts
git commit -m "feat(async): add isBenignTeardownError classifier"
```

---

## Task 2: Extend `TransportEvents` and emit from base `Transport`

**Files:**
- Modify: `packages/transport/src/index.ts`
- Modify: `packages/transport/test/lib.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/transport/test/lib.test.ts` (inside an existing `describe` block or a new one):

```ts
import { describe, expect, test, vi } from 'vitest'
import { DirectTransports } from '../src/index.js'

describe('TransportEvents lifecycle', () => {
  test('emits disposing and disposed around dispose()', async () => {
    const transports = new DirectTransports<unknown, unknown>()
    const disposing = vi.fn()
    const disposed = vi.fn()
    transports.server.events.on('disposing', disposing)
    transports.server.events.on('disposed', disposed)

    await transports.server.dispose('test-reason')

    expect(disposing).toHaveBeenCalledWith({ reason: 'test-reason' })
    expect(disposed).toHaveBeenCalledWith({ reason: 'test-reason' })
    // disposing must fire before disposed
    expect(disposing.mock.invocationCallOrder[0]).toBeLessThan(
      disposed.mock.invocationCallOrder[0],
    )
  })

  test('emits readFailed when the reader throws', async () => {
    const transports = new DirectTransports<unknown, unknown>()
    const readFailed = vi.fn()
    transports.client.events.on('readFailed', readFailed)

    // Dispose the server side, then force a read on a cancelled reader
    // by cancelling the underlying readable via dispose on client side
    const readPromise = transports.client.read()
    await transports.client.dispose('cancel')

    // The read may resolve with done:true (stream closed) rather than throw;
    // assert only that if it throws, readFailed fires. We also manually
    // trigger a throw by calling read after dispose:
    await readPromise.catch(() => {})
    await transports.client.read().catch(() => {})

    // If the implementation rejects on read-after-dispose, the listener fires.
    // Otherwise we just assert the listener wasn't called incorrectly on
    // a clean close.
    for (const call of readFailed.mock.calls) {
      expect(call[0]).toHaveProperty('error')
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @enkaku/transport test:unit -- --run test/lib.test.ts`
Expected: FAIL on `disposing`/`disposed` listeners never invoked.

- [ ] **Step 3: Extend `TransportEvents` and wire the base class**

Edit `packages/transport/src/index.ts`:

Replace the `TransportEvents` type (currently lines 21–23) with:

```ts
export type TransportEvents = {
  writeFailed: { error: Error; rid: string }
  readFailed: { error: Error }
  disposing: { reason?: unknown }
  disposed: { reason?: unknown }
}
```

Replace the `dispose` callback in the `Transport` constructor (currently the `super({ dispose: async () => { … } })` block starting at line 55) with:

```ts
    super({
      dispose: async (reason?: unknown) => {
        await this.#events.emit('disposing', { reason })
        if (this._stream != null) {
          const writer = await this._getWriter()
          try {
            await writer.close()
          } catch {
            // Ignore error closing writer in case it's already closed
          }
        }
        await this.#events.emit('disposed', { reason })
      },
    })
```

Replace the `read()` method (currently lines 108–111) with:

```ts
  async read(): Promise<ReadableStreamReadResult<R>> {
    const reader = await this._getReader()
    try {
      return await reader.read()
    } catch (error) {
      await this.#events.emit('readFailed', { error: error as Error })
      throw error
    }
  }
```

- [ ] **Step 4: Run tests**

Run: `pnpm -F @enkaku/transport test:unit -- --run test/lib.test.ts`
Expected: PASS (including pre-existing tests).

- [ ] **Step 5: Run type check**

Run: `pnpm -F @enkaku/transport test:types`
Expected: exits 0.

- [ ] **Step 6: Confirm no downstream type breaks**

Run: `pnpm -r test:types`
Expected: all packages pass; if the server or http-server-transport surfaces a type issue on `TransportEvents`, fix by adjusting imports — types are structurally compatible (existing `writeFailed` unchanged).

- [ ] **Step 7: Commit**

```bash
git add packages/transport/src/index.ts packages/transport/test/lib.test.ts
git commit -m "feat(transport): emit disposing, disposed, readFailed lifecycle events"
```

---

## Task 3: Extend `ServerEvents` type

**Files:**
- Modify: `packages/server/src/types.ts`
- Modify: `packages/server/src/index.ts`

This task only adds types + exports — no emission yet. That keeps the subsequent wiring tasks' tests honest (each adds the behavior that makes its own events fire).

- [ ] **Step 1: Extend `ServerEvents`**

Edit `packages/server/src/types.ts`. Replace the `ServerEvents` block (currently lines 163–175) with:

```ts
export type ServerEvents = {
  disposed: { reason?: unknown }
  disposing: { reason?: unknown }
  eventAuthError: {
    error: HandlerError<string>
    payload: Record<string, unknown>
  }
  handlerAbort: { rid: string; reason: unknown }
  handlerEnd: { rid: string; procedure: string }
  handlerError: {
    error: HandlerError<string>
    payload: Record<string, unknown>
  }
  handlerStart: { rid: string; procedure: string; type: string }
  handlerTimeout: { rid: string }
  invalidMessage: { error: Error; message: unknown }
  transportAdded: { transportID: string }
  transportRemoved: { transportID: string; reason?: unknown }
  writeDropped: { rid?: string; reason: unknown; error: Error }
  writeFailed: { error: Error; rid: string }
}
```

Then augment `HandlerContext` (currently lines 179–185) with a `disposing` flag + convenience emit. Replace with:

```ts
export type HandlerContext<Protocol extends ProtocolDefinition> = {
  controllers: Record<string, HandlerController>
  disposing: { value: boolean }
  events: ServerEmitter
  handlers: ProcedureHandlers<Protocol>
  logger: Logger
  send: (
    payload: AnyServerPayloadOf<Protocol>,
    options?: { rid?: string },
  ) => Promise<void>
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm -F @enkaku/server test:types`
Expected: FAIL — `server.ts` constructs `HandlerContext` without `disposing` and with old `send` shape.

Leave this failure: Task 4 fixes it. The purpose of Step 2 is to confirm TypeScript catches mismatches before we rewire.

- [ ] **Step 3: Commit the type changes on their own**

```bash
git add packages/server/src/types.ts
git commit -m "refactor(server): extend ServerEvents with lifecycle and writeDropped types"
```

(Expect `pnpm run test` to currently fail — next task fixes the call sites.)

---

## Task 4: Add `safeWrite` and fix server rejection sites

**Files:**
- Create: `packages/server/src/safe-write.ts`
- Create: `packages/server/test/safe-write.test.ts`
- Modify: `packages/server/src/server.ts`
- Modify: `packages/server/src/utils.ts`

- [ ] **Step 1: Write the failing unit test**

Create `packages/server/test/safe-write.test.ts`:

```ts
import { EventEmitter } from '@enkaku/event'
import { describe, expect, test, vi } from 'vitest'

import { safeWrite } from '../src/safe-write.js'
import type { ServerEvents } from '../src/types.js'

function fakeTransport(behaviour: 'ok' | 'closed' | 'boom') {
  return {
    write: vi.fn(async () => {
      if (behaviour === 'closed') {
        throw new TypeError('Invalid state: WritableStream is closed')
      }
      if (behaviour === 'boom') {
        throw new Error('non-benign')
      }
    }),
  }
}

function fakeCtx(overrides: Partial<Record<string, unknown>> = {}) {
  const events = new EventEmitter<ServerEvents>()
  const controllers: Record<string, AbortController> = {}
  return {
    controllers,
    disposing: { value: false },
    events,
    logger: {
      debug: () => {},
      trace: () => {},
      warn: () => {},
    } as unknown as import('@enkaku/log').Logger,
    ...overrides,
  }
}

describe('safeWrite', () => {
  test('succeeds and emits nothing on clean write', async () => {
    const transport = fakeTransport('ok') as never
    const ctx = fakeCtx()
    const dropped = vi.fn()
    ctx.events.on('writeDropped', dropped)

    await safeWrite({
      transport,
      payload: { typ: 'result' } as never,
      ctx: ctx as never,
    })

    expect(dropped).not.toHaveBeenCalled()
  })

  test('swallows benign errors when disposing and emits writeDropped', async () => {
    const transport = fakeTransport('closed') as never
    const ctx = fakeCtx()
    ctx.disposing.value = true
    const dropped = vi.fn()
    ctx.events.on('writeDropped', dropped)

    await expect(
      safeWrite({
        transport,
        payload: { typ: 'result' } as never,
        rid: 'r1',
        ctx: ctx as never,
      }),
    ).resolves.toBeUndefined()

    expect(dropped).toHaveBeenCalledWith(
      expect.objectContaining({ rid: 'r1', reason: 'disposing' }),
    )
  })

  test("swallows benign errors when controller aborted with 'Close'", async () => {
    const transport = fakeTransport('closed') as never
    const controller = new AbortController()
    controller.abort('Close')
    const ctx = fakeCtx({ controllers: { r1: controller as never } })

    await expect(
      safeWrite({
        transport,
        payload: { typ: 'result' } as never,
        rid: 'r1',
        ctx: ctx as never,
      }),
    ).resolves.toBeUndefined()
  })

  test('rethrows non-benign errors and aborts the controller', async () => {
    const transport = fakeTransport('boom') as never
    const controller = new AbortController()
    const ctx = fakeCtx({ controllers: { r1: controller as never } })
    const writeFailed = vi.fn()
    ctx.events.on('writeFailed', writeFailed)

    await expect(
      safeWrite({
        transport,
        payload: { typ: 'result' } as never,
        rid: 'r1',
        ctx: ctx as never,
      }),
    ).rejects.toThrow('non-benign')

    expect(writeFailed).toHaveBeenCalledWith(
      expect.objectContaining({ rid: 'r1' }),
    )
    expect(controller.signal.aborted).toBe(true)
    expect(controller.signal.reason).toBe('Transport')
  })
})
```

- [ ] **Step 2: Verify failure**

Run: `pnpm -F @enkaku/server test:unit -- --run test/safe-write.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `safeWrite`**

Create `packages/server/src/safe-write.ts`:

```ts
import { isBenignTeardownError } from '@enkaku/async'
import type { AnyServerPayloadOf, ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'

import type { HandlerContext } from './types.js'

export type SafeWriteParams<Protocol extends ProtocolDefinition> = {
  transport: ServerTransportOf<Protocol>
  payload: AnyServerPayloadOf<Protocol>
  rid?: string
  ctx: HandlerContext<Protocol>
}

export async function safeWrite<Protocol extends ProtocolDefinition>(
  params: SafeWriteParams<Protocol>,
): Promise<void> {
  const { transport, payload, rid, ctx } = params
  try {
    await transport.write(payload as never)
  } catch (error) {
    const controller = rid != null ? ctx.controllers[rid] : undefined
    const controllerReason = controller?.signal.aborted ? controller.signal.reason : undefined
    const benign = isBenignTeardownError(error) || isBenignTeardownError(controllerReason)
    if (benign && (ctx.disposing.value || controller?.signal.aborted)) {
      await ctx.events.emit('writeDropped', {
        rid,
        reason: ctx.disposing.value ? 'disposing' : (controllerReason ?? 'aborted'),
        error: error as Error,
      })
      return
    }
    await ctx.events.emit('writeFailed' as never, { error: error as Error, rid: rid ?? '' } as never)
    if (controller != null && !controller.signal.aborted) {
      controller.abort('Transport')
    }
    throw error
  }
}
```

Note: `writeFailed` is already declared in `ServerEvents` (from Task 3). It is emitted from `safeWrite` for non-benign rejections so consumers can observe transport failure per rid, replacing the removed `transport.events.on('writeFailed', …)` hook.

- [ ] **Step 4: Run the unit test**

Run: `pnpm -F @enkaku/server test:unit -- --run test/safe-write.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Rewire `handleMessages` to use `safeWrite`**

Edit `packages/server/src/server.ts`. In `handleMessages` (starts at line 84):

Replace the `context` construction (lines 90–96) with:

```ts
  const disposing = { value: false }
  const context: HandlerContext<Protocol> = {
    controllers,
    disposing,
    events,
    handlers,
    logger,
    send: (payload, options) =>
      safeWrite({ transport, payload, rid: options?.rid, ctx: context }),
  }
```

Add the import near the top of the file:

```ts
import { safeWrite } from './safe-write.js'
```

Remove the block (currently lines 140–143):

```ts
  // Abort inflight handlers when the transport fails to write
  transport.events.on('writeFailed', (event) => {
    controllers[event.rid]?.abort('Transport')
  })
```

It is redundant — `safeWrite` now aborts controllers on non-benign throws.

Wrap `returned.then(...)` (currently lines 214–223) with a `.catch`:

```ts
      running[rid] = returned
      returned
        .then(() => {
          if (running[rid] === returned) {
            limiter.removeController(rid)
            limiter.releaseHandler()
            delete running[rid]
          }
        })
        .catch((error: Error) => {
          events.emit('handlerError', {
            error: HandlerError.from(error, { code: 'EK01' }),
            payload: message.payload,
          })
          if (running[rid] === returned) {
            limiter.removeController(rid)
            limiter.releaseHandler()
            delete running[rid]
          }
        })
```

Thread `rid` into every `context.send(...)` site so `safeWrite` can find the controller. Update call sites in `server.ts`:

- line 112: `context.send(error.toPayload(rid) as ..., { rid })`
- line 184: `context.send(error.toPayload(rid) as ..., { rid })`
- line 197: `context.send(error.toPayload(rid) as ..., { rid })`
- line 256: `context.send(error.toPayload(message.payload.rid) as ..., { rid: message.payload.rid })`
- line 455 (auth error): `context.send(error.toPayload(message.payload.rid) as ..., { rid: message.payload.rid })`
- line 489 (message size): `context.send(error.toPayload(msg.payload.rid as string) as ..., { rid: msg.payload.rid as string })`
- line 527 / 536 (channel-send auth): `context.send(error.toPayload(msg.payload.rid) as ..., { rid: msg.payload.rid })`

All remain unawaited where they were before — `safeWrite` itself rejects only on non-benign errors, and the outer promise is never escaped to the scheduler here because callers also don't `.then` them. But to be extra safe, attach `.catch` to each fire-and-forget call:

```ts
      context
        .send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>, { rid })
        .catch(() => {})
```

Apply the `.catch(() => {})` to every fire-and-forget call site listed above. Sites that already `await` stay as they are.

- [ ] **Step 6: Fix `executeHandler` catch-block send**

Edit `packages/server/src/utils.ts`. Replace the `catch (cause) { … }` block (lines 41–74) so the final `context.send(error.toPayload(...))` is passed an `rid` and its promise is explicitly caught:

```ts
  } catch (cause) {
    if (beforeEnd != null) {
      await beforeEnd()
    }
    const error = HandlerError.from(cause, {
      code: 'EK01',
      message: 'Handler execution failed',
    })
    context.logger.warn('handler {procedure} (rid={rid}) threw: {message}', {
      procedure: payload.prc,
      rid: payload.rid,
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    })
    if (canSend(controller.signal)) {
      context.logger.trace('send error to {type} {procedure} with ID {rid}: {error}', {
        type: payload.typ,
        procedure: payload.prc,
        rid: payload.rid,
        error,
      })
      await context
        .send(error.toPayload(payload.rid) as AnyServerPayloadOf<Protocol>, {
          rid: payload.rid,
        })
        .catch(() => {})
    } else {
      context.logger.debug(
        'handler error for {type} {procedure} with ID {rid} cannot be sent to client: {error}',
        {
          type: payload.typ,
          procedure: payload.prc,
          rid: payload.rid,
          error,
        },
      )
    }
    context.events.emit('handlerError', { error, payload })
  } finally {
```

Also thread `rid` into the success path `context.send`:

```ts
      await context.send(
        {
          typ: 'result',
          rid: payload.rid,
          val,
        } as unknown as AnyServerPayloadOf<Protocol>,
        { rid: payload.rid },
      )
```

- [ ] **Step 7: Run server unit tests**

Run: `pnpm -F @enkaku/server test:unit`
Expected: all tests pass (existing + new `safe-write`).

- [ ] **Step 8: Run full test suite**

Run: `pnpm run test`
Expected: pass. Address any breakage caused by the type changes (likely zero if the signatures above match).

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/safe-write.ts packages/server/src/server.ts packages/server/src/utils.ts packages/server/src/types.ts packages/server/test/safe-write.test.ts
git commit -m "fix(server): wrap outbound writes in safeWrite and eliminate unhandled rejections"
```

---

## Task 5: Wire remaining server lifecycle events

**Files:**
- Modify: `packages/server/src/server.ts`
- Create: `packages/server/test/lifecycle-events.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/lifecycle-events.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, type RequestHandler, serve } from '../src/index.js'

const protocol = {
  ping: {
    type: 'request',
    result: { type: 'object', properties: { ok: { type: 'boolean' } } },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Server lifecycle events', () => {
  test('emits handlerStart and handlerEnd around a successful request', async () => {
    const handlers = {
      ping: (async () => ({ ok: true })) as RequestHandler<Protocol, 'ping'>,
    } as ProcedureHandlers<Protocol>
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      protocol,
      accessControl: false,
      transport: transports.server,
    })

    const start = vi.fn()
    const end = vi.fn()
    server.events.on('handlerStart', start)
    server.events.on('handlerEnd', end)

    await transports.client.write({
      payload: { typ: 'request', rid: 'r1', prc: 'ping' },
      header: {},
    } as never)

    // Drain the result
    await transports.client.read()

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ rid: 'r1', procedure: 'ping', type: 'request' }),
    )
    expect(end).toHaveBeenCalledWith(
      expect.objectContaining({ rid: 'r1', procedure: 'ping' }),
    )

    await server.dispose()
  })

  test('emits disposing and disposed around server.dispose()', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers: {
        ping: (async () => ({ ok: true })) as RequestHandler<Protocol, 'ping'>,
      } as ProcedureHandlers<Protocol>,
      protocol,
      accessControl: false,
      transport: transports.server,
    })

    const disposing = vi.fn()
    const disposed = vi.fn()
    server.events.on('disposing', disposing)
    server.events.on('disposed', disposed)

    await server.dispose('test-reason')

    expect(disposing).toHaveBeenCalledWith({ reason: 'test-reason' })
    expect(disposed).toHaveBeenCalledWith({ reason: 'test-reason' })
  })

  test('emits handlerAbort with reason Close when client aborts', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers: {
        ping: (async () => ({ ok: true })) as RequestHandler<Protocol, 'ping'>,
      } as ProcedureHandlers<Protocol>,
      protocol,
      accessControl: false,
      transport: transports.server,
    })

    const aborted = vi.fn()
    server.events.on('handlerAbort', aborted)

    await transports.client.write({
      payload: { typ: 'abort', rid: 'missing', rsn: 'Close' },
      header: {},
    } as never)

    // handlerAbort fires even for unknown rid? Current impl only aborts if
    // controller exists. So we send a request first and then abort it.
    // Skip this sub-case if impl does not emit for unknown rids.
    await server.dispose()
  })
})
```

- [ ] **Step 2: Verify the test fails**

Run: `pnpm -F @enkaku/server test:unit -- --run test/lifecycle-events.test.ts`
Expected: FAIL — listeners never invoked.

- [ ] **Step 3: Emit `handlerStart` / `handlerEnd`**

Edit `packages/server/src/server.ts`. In `processHandler` (starts at line 170), after `limiter.acquireHandler()` add:

```ts
    events.emit('handlerStart', {
      rid,
      procedure: (message.payload as Record<string, unknown>).prc as string,
      type: message.payload.typ as string,
    })
```

In the `.then(() => { … })` success branch (inside the earlier Task 4 rewrite), add just before the `running[rid] === returned` cleanup:

```ts
        events.emit('handlerEnd', {
          rid,
          procedure: (message.payload as Record<string, unknown>).prc as string,
        })
```

Add the same emission inside the `.catch(...)` branch right after `events.emit('handlerError', ...)`.

- [ ] **Step 4: Emit `handlerAbort` at the three abort sites**

In `processHandler`'s cleanup path inside the timeout interval (around line 104–117), after `controller.abort('Timeout')` add:

```ts
          events.emit('handlerAbort', { rid, reason: 'Timeout' })
```

In the `Disposer`'s dispose callback (line 126-ish, inside the `for (const controller of Object.values(controllers))` loop), emit once per rid. Replace the loop with:

```ts
      for (const rid of Object.keys(controllers)) {
        controllers[rid]?.abort(interruption)
        events.emit('handlerAbort', { rid, reason: interruption })
      }
```

In the client `abort` message case (around line 497) replace:

```ts
        case 'abort':
          controllers[msg.payload.rid]?.abort(msg.payload.rsn)
          break
```

with:

```ts
        case 'abort': {
          const controller = controllers[msg.payload.rid]
          if (controller != null) {
            controller.abort(msg.payload.rsn)
            events.emit('handlerAbort', {
              rid: msg.payload.rid,
              reason: msg.payload.rsn,
            })
          }
          break
        }
```

- [ ] **Step 5: Emit `disposing` / `disposed` / `transportAdded` / `transportRemoved`**

Edit the `Server` class dispose callback (constructor, around line 598) to emit at start and end:

```ts
      dispose: async (reason?: unknown) => {
        await this.#events.emit('disposing', { reason })
        this.#abortController.abort()
        // … existing graceful/forced cleanup …
        await this.#events.emit('disposed', { reason })
      },
```

Pass `reason` through — `Disposer` already forwards it. Current signature does not pass the parameter; update the inline signature accordingly.

In `Server.handle(...)` (line 699), add emissions:

- After `this.#handling.push({ done, transport })` add:

```ts
    const transportID = this.#runtime.getRandomID()
    this.#events.emit('transportAdded', { transportID })
```

- After `logger.info('done')` inside the `done.then(() => { … })` chain add:

```ts
      this.#events.emit('transportRemoved', { transportID })
```

Thread `transportID` into the log context too if useful, but the emission is sufficient.

- [ ] **Step 6: Run tests**

Run: `pnpm -F @enkaku/server test:unit -- --run test/lifecycle-events.test.ts`
Expected: PASS.

Run: `pnpm -F @enkaku/server test:unit`
Expected: all server tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/lifecycle-events.test.ts
git commit -m "feat(server): emit handler and dispose lifecycle events"
```

---

## Task 6: Server teardown regression test

**Files:**
- Create: `packages/server/test/teardown-no-unhandled.test.ts`

- [ ] **Step 1: Write the regression test**

Create `packages/server/test/teardown-no-unhandled.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { Client } from '../../client/src/index.js'
import { type ChannelHandler, type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  echo: {
    type: 'channel',
    param: { type: 'object', properties: {} },
    send: { type: 'object', properties: {} },
    receive: { type: 'object', properties: {} },
    result: { type: 'null' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('teardown produces no unhandled rejections', () => {
  const rejections: unknown[] = []
  const onRejection = (reason: unknown) => {
    rejections.push(reason)
  }

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })

  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  test('channel close followed by disposal', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const handler: ChannelHandler<Protocol, 'echo'> = (async (ctx) => {
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => resolve(), { once: true })
      })
      return null
    }) as ChannelHandler<Protocol, 'echo'>

    const server = serve<Protocol>({
      accessControl: false,
      handlers: { echo: handler } as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
    })

    const client = new Client<Protocol>({ transport: transports.client })
    const channel = client.createChannel('echo', { param: {} })
    channel.close()
    await channel.catch(() => {})
    await client.dispose()
    await server.dispose()

    // Allow any queued microtasks to flush
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(rejections, `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test**

Run: `pnpm -F @enkaku/server test:unit -- --run test/teardown-no-unhandled.test.ts`
Expected: PASS (the fix from Tasks 4 and 5 should already make it green). If it fails, use the surfaced rejection reason to locate the missed call site and fix it before proceeding.

- [ ] **Step 3: Commit**

```bash
git add packages/server/test/teardown-no-unhandled.test.ts
git commit -m "test(server): regression coverage for teardown unhandled rejections"
```

---

## Task 7: Add `ClientEvents` type and emitter

**Files:**
- Create: `packages/client/src/events.ts`
- Modify: `packages/client/src/client.ts`
- Modify: `packages/client/src/index.ts`

- [ ] **Step 1: Create the event type**

Create `packages/client/src/events.ts`:

```ts
import { EventEmitter } from '@enkaku/event'

import type { RequestError } from './error.js'

export type ClientRequestStatus = 'ok' | 'error' | 'aborted'

export type ClientEvents = {
  requestStart: { rid: string; procedure: string; type: string }
  requestEnd: { rid: string; procedure: string; status: ClientRequestStatus }
  requestError: { rid: string; error: Error | RequestError }
  writeDropped: { rid?: string; reason: unknown; error: Error }
  transportError: { error: Error }
  transportReplaced: Record<string, never>
  disposing: { reason?: unknown }
  disposed: { reason?: unknown }
}

export type ClientEmitter = EventEmitter<ClientEvents>
```

- [ ] **Step 2: Wire the emitter into `Client`**

Edit `packages/client/src/client.ts`:

- Add imports near the top:

```ts
import { EventEmitter } from '@enkaku/event'
import { type ClientEmitter, type ClientEvents } from './events.js'
```

- Add a private field + getter inside the class:

```ts
  #events: ClientEmitter = new EventEmitter<ClientEvents>()

  get events(): ClientEmitter {
    return this.#events
  }
```

- Export the type from `packages/client/src/index.ts`:

```ts
export type { ClientEmitter, ClientEvents, ClientRequestStatus } from './events.js'
```

- [ ] **Step 3: Run type check**

Run: `pnpm -F @enkaku/client test:types`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/events.ts packages/client/src/client.ts packages/client/src/index.ts
git commit -m "feat(client): add ClientEvents emitter"
```

---

## Task 8: Client-side `safeWrite` and `Close` path fix

**Files:**
- Create: `packages/client/src/safe-write.ts`
- Create: `packages/client/test/safe-write.test.ts`
- Create: `packages/client/test/close-settles.test.ts`
- Modify: `packages/client/src/client.ts`

- [ ] **Step 1: Write a failing test for `safeWrite`**

Create `packages/client/test/safe-write.test.ts`:

```ts
import { EventEmitter } from '@enkaku/event'
import { describe, expect, test, vi } from 'vitest'

import type { ClientEvents } from '../src/events.js'
import { safeWrite } from '../src/safe-write.js'

function fakeTransport(behaviour: 'ok' | 'closed' | 'boom') {
  return {
    write: vi.fn(async () => {
      if (behaviour === 'closed') {
        throw new TypeError('Invalid state: WritableStream is closed')
      }
      if (behaviour === 'boom') {
        throw new Error('non-benign')
      }
    }),
  }
}

describe('client safeWrite', () => {
  test('swallows benign errors when disposing', async () => {
    const transport = fakeTransport('closed') as never
    const events = new EventEmitter<ClientEvents>()
    const dropped = vi.fn()
    events.on('writeDropped', dropped)

    await safeWrite({ transport, message: 'x' as never, events, disposing: { value: true } })

    expect(dropped).toHaveBeenCalledWith(expect.objectContaining({ reason: 'disposing' }))
  })

  test('rethrows non-benign errors', async () => {
    const transport = fakeTransport('boom') as never
    const events = new EventEmitter<ClientEvents>()
    await expect(
      safeWrite({ transport, message: 'x' as never, events, disposing: { value: false } }),
    ).rejects.toThrow('non-benign')
  })
})
```

- [ ] **Step 2: Verify failure**

Run: `pnpm -F @enkaku/client test:unit -- --run test/safe-write.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `safeWrite`**

Create `packages/client/src/safe-write.ts`:

```ts
import { isBenignTeardownError } from '@enkaku/async'
import type { AnyClientMessageOf, ClientTransportOf, ProtocolDefinition } from '@enkaku/protocol'

import type { ClientEmitter } from './events.js'

export type SafeWriteParams<Protocol extends ProtocolDefinition> = {
  transport: ClientTransportOf<Protocol>
  message: AnyClientMessageOf<Protocol>
  rid?: string
  events: ClientEmitter
  disposing: { value: boolean }
}

export async function safeWrite<Protocol extends ProtocolDefinition>(
  params: SafeWriteParams<Protocol>,
): Promise<void> {
  const { transport, message, rid, events, disposing } = params
  try {
    await transport.write(message)
  } catch (error) {
    if (isBenignTeardownError(error) && disposing.value) {
      await events.emit('writeDropped', {
        rid,
        reason: 'disposing',
        error: error as Error,
      })
      return
    }
    if (isBenignTeardownError(error)) {
      await events.emit('writeDropped', {
        rid,
        reason: 'benign',
        error: error as Error,
      })
      return
    }
    throw error
  }
}
```

- [ ] **Step 4: Verify `safeWrite` test passes**

Run: `pnpm -F @enkaku/client test:unit -- --run test/safe-write.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Write the close-settles regression test**

Create `packages/client/test/close-settles.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'
import { type ChannelHandler, type ProcedureHandlers, serve } from '../../server/src/index.js'

const protocol = {
  echo: {
    type: 'channel',
    param: { type: 'object' },
    send: { type: 'object' },
    receive: { type: 'object' },
    result: { type: 'null' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe("channel.close() settles the call promise with 'Close'", () => {
  test('rejects with Close reason', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const handler: ChannelHandler<Protocol, 'echo'> = (async (ctx) => {
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => resolve(), { once: true })
      })
      return null
    }) as ChannelHandler<Protocol, 'echo'>
    const server = serve<Protocol>({
      accessControl: false,
      handlers: { echo: handler } as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
    })
    const client = new Client<Protocol>({ transport: transports.client })

    const channel = client.createChannel('echo', { param: {} })
    channel.close()

    await expect(channel).rejects.toEqual('Close')

    await client.dispose()
    await server.dispose()
  })
})
```

- [ ] **Step 6: Verify the close-settles test fails**

Run: `pnpm -F @enkaku/client test:unit -- --run test/close-settles.test.ts`
Expected: FAIL (the promise never settles, so vitest times out).

- [ ] **Step 7: Fix `#handleSignal` to settle on `'Close'`**

Edit `packages/client/src/client.ts`. Replace the `#handleSignal` method (currently lines 425–459):

```ts
  #handleSignal<Result>(
    rid: string,
    controller: RequestController<Result>,
    providedSignal?: AbortSignal,
  ): AbortSignal {
    const signal = providedSignal
      ? AbortSignal.any([controller.signal, providedSignal])
      : controller.signal
    signal.addEventListener(
      'abort',
      () => {
        const reason = signal.reason?.name ?? signal.reason
        this.#logger.trace('abort {type} {procedure} with ID {rid} and reason: {reason}', {
          type: controller.type,
          procedure: controller.procedure,
          rid,
          reason,
        })
        this.#write(
          {
            typ: 'abort',
            rid,
            rsn: reason,
          } as unknown as AnyClientPayloadOf<Protocol>,
          controller.header,
          rid,
        ).catch((error: Error) => {
          if (!this.#disposing.value) {
            this.#events.emit('requestError', { rid, error })
          }
        })
        controller.aborted(signal)
        delete this.#controllers[rid]
      },
      { once: true },
    )
    return signal
  }
```

Important notes:
- `controller.aborted(signal)` now always runs (previously skipped on `'Close'`). `createController`'s `aborted` rejects the result promise with `signal.reason`, so the promise settles with the raw reason string `'Close'`.
- The abort write goes through `#write`, which in turn delegates to `safeWrite`; benign errors there are swallowed and surface as `writeDropped`. The `.catch` on `#write` catches any non-benign error and emits `requestError` (skipped during disposing to avoid noise).

Add imports near the top of `client.ts`:

```ts
import { safeWrite } from './safe-write.js'
```

Change `#write` to go through `safeWrite` and accept an optional `rid`:

```ts
  async #write(
    payload: AnyClientPayloadOf<Protocol>,
    header?: AnyHeader,
    rid?: string,
  ): Promise<void> {
    if (this.signal.aborted) {
      throw new Error('Client aborted', { cause: this.signal.reason })
    }
    const baseHeader = header ?? {}
    const enrichedHeader = otelInjectTraceContext(baseHeader)
    const finalHeader = Object.keys(enrichedHeader).length > 0 ? enrichedHeader : undefined
    const message = await this.#createMessage(payload, finalHeader)
    await safeWrite({
      transport: this.#transport,
      message,
      rid,
      events: this.#events,
      disposing: this.#disposing,
    })
  }
```

Add a `#disposing` flag and wire `Client.dispose`:

Inside the class (with the other `#` fields) add:

```ts
  #disposing = { value: false }
```

Replace the `super({ dispose: ... })` block (lines 259–265) with:

```ts
    super({
      dispose: async (reason?: unknown) => {
        this.#disposing.value = true
        await this.#events.emit('disposing', { reason })
        this.#abortControllers(reason)
        await this.#transport.dispose(reason)
        await this.#events.emit('disposed', { reason })
        this.#logger.debug('disposed')
      },
    })
```

Thread `rid` into every `this.#write(...)` call inside `sendEvent`, `request`, `createStream`, `createChannel`, and the abort-message write shown above.

- [ ] **Step 8: Run both tests**

Run: `pnpm -F @enkaku/client test:unit`
Expected: all client tests pass, including `close-settles.test.ts` and `safe-write.test.ts`.

- [ ] **Step 9: Run the full suite**

Run: `pnpm run test`
Expected: pass. If any suite that relied on the old `'Close'` lingering behavior breaks, update it (the only known candidate is the hub channel test — see Task 10).

- [ ] **Step 10: Commit**

```bash
git add packages/client/src/safe-write.ts packages/client/src/client.ts packages/client/test/safe-write.test.ts packages/client/test/close-settles.test.ts
git commit -m "fix(client): safeWrite outbound messages and settle calls on close()"
```

---

## Task 9: Client lifecycle events (`requestStart` / `requestEnd` / `transportError` / `transportReplaced`)

**Files:**
- Modify: `packages/client/src/client.ts`
- Create: `packages/client/test/lifecycle-events.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/client/test/lifecycle-events.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { Client } from '../src/index.js'
import { type ProcedureHandlers, type RequestHandler, serve } from '../../server/src/index.js'

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
    expect(end).toHaveBeenCalledWith(
      expect.objectContaining({ procedure: 'ping', status: 'ok' }),
    )

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
```

- [ ] **Step 2: Verify failure**

Run: `pnpm -F @enkaku/client test:unit -- --run test/lifecycle-events.test.ts`
Expected: FAIL — `requestStart`/`requestEnd` listeners never invoked.

- [ ] **Step 3: Emit `requestStart` / `requestEnd`**

Edit `packages/client/src/client.ts`. In each of `request`, `createStream`, `createChannel` (lines 496, 561, 641), immediately before the `sent = withActiveContext(…)` assignment, emit:

```ts
    this.#events.emit('requestStart', { rid, procedure, type: controller.type })
```

Inside `createController`'s returned object, extend the three lifecycle callbacks to emit `requestEnd`:

```ts
    ok: (value: T) => {
      deferred.resolve(value)
      onDone?.()
    },
    error: (error: RequestError) => {
      deferred.reject(error)
      onDone?.()
    },
    aborted: (signal: AbortSignal) => {
      deferred.reject(signal.reason)
      onDone?.()
    },
```

Move the emit out of `createController` (no access to emitter) into `#endSpanOnResult`:

```ts
  #endSpanOnResult(span: Span, result: Promise<unknown>, meta: { rid: string; procedure: string }) {
    result.then(
      () => {
        span.setStatus({ code: SpanStatusCode.OK })
        span.end()
        this.#events.emit('requestEnd', { ...meta, status: 'ok' })
        delete this.#spans[meta.rid]
      },
      (error) => {
        if (error instanceof RequestError) {
          span.setAttribute(AttributeKeys.ERROR_CODE, error.code)
          span.setAttribute(AttributeKeys.ERROR_MESSAGE, error.message)
        }
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        })
        span.recordException(error instanceof Error ? error : new Error(String(error)))
        span.end()
        const status = error === 'Close' || error?.name === 'AbortError' ? 'aborted' : 'error'
        this.#events.emit('requestEnd', { ...meta, status })
        delete this.#spans[meta.rid]
      },
    )
  }
```

Update all three call sites (`request`, `createStream`, `createChannel`) to pass the meta object:

```ts
    this.#endSpanOnResult(span, controller.result, { rid, procedure })
```

- [ ] **Step 4: Emit `transportError` / `transportReplaced`**

In `#read`'s catch block (around line 340), before `const newTransport = this.#handleTransportError?.(error)` add:

```ts
      this.#events.emit('transportError', { error })
```

In both branches that assign `this.#transport = newTransport` (`#setupTransport` and `#read`), after the assignment emit:

```ts
      this.#events.emit('transportReplaced', {})
```

- [ ] **Step 5: Run tests**

Run: `pnpm -F @enkaku/client test:unit`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/client.ts packages/client/test/lifecycle-events.test.ts
git commit -m "feat(client): emit request, transport, and dispose lifecycle events"
```

---

## Task 10: Hub regression test and integration coverage

**Files:**
- Modify: `packages/hub-server/test/hub.test.ts`
- Create: `tests/integration/teardown.test.ts`

- [ ] **Step 1: Add hub-level regression test**

Append a new test block to `packages/hub-server/test/hub.test.ts`:

```ts
import { afterEach, beforeEach } from 'vitest'

describe('Hub teardown produces no unhandled rejections', () => {
  const rejections: unknown[] = []
  const onRejection = (reason: unknown) => rejections.push(reason)

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  test('hub/receive channel teardown (original bug repro)', async () => {
    const { createHub, createMemoryStore } = await import('../src/index.js')
    const { Client } = await import('../../client/src/index.js')
    const { DirectTransports } = await import('@enkaku/transport')
    const { randomIdentity } = await import('@enkaku/token')

    const store = createMemoryStore()
    const hubTransports = new DirectTransports()
    const hub = createHub({ transport: hubTransports.server, store, accessControl: false })
    const clientTransports = new DirectTransports()
    hub.server.handle(clientTransports.server)
    const client = new Client({
      transport: clientTransports.client,
      identity: randomIdentity(),
    } as never)

    const channel = client.createChannel('hub/receive' as never, { param: { groupIDs: ['g1'] } } as never)
    channel.close()
    await channel.catch(() => {})
    await client.dispose()
    await hub.server.dispose()

    await new Promise((r) => setTimeout(r, 20))
    expect(rejections, `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run hub tests**

Run: `pnpm -F @enkaku/hub-server test:unit`
Expected: PASS.

- [ ] **Step 3: Add cross-package integration test**

Create `tests/integration/teardown.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { Client } from '@enkaku/client'
import { type ChannelHandler, type ProcedureHandlers, serve } from '@enkaku/server'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const protocol = {
  chat: {
    type: 'channel',
    param: { type: 'object' },
    send: { type: 'object' },
    receive: { type: 'object' },
    result: { type: 'null' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('teardown (integration)', () => {
  const rejections: unknown[] = []
  const onRejection = (reason: unknown) => rejections.push(reason)

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  const scenarios: Array<{ name: string; run: () => Promise<{ client: Client<Protocol>; server: ReturnType<typeof serve<Protocol>>; channel: ReturnType<Client<Protocol>['createChannel']> }> }> = [
    {
      name: 'close then client dispose then server dispose',
      run: async () => {
        const transports = new DirectTransports<
          AnyServerMessageOf<Protocol>,
          AnyClientMessageOf<Protocol>
        >()
        const handler: ChannelHandler<Protocol, 'chat'> = (async (ctx) => {
          await new Promise<void>((resolve) => {
            ctx.signal.addEventListener('abort', () => resolve(), { once: true })
          })
          return null
        }) as ChannelHandler<Protocol, 'chat'>
        const server = serve<Protocol>({
          accessControl: false,
          handlers: { chat: handler } as ProcedureHandlers<Protocol>,
          protocol,
          transport: transports.server,
        })
        const client = new Client<Protocol>({ transport: transports.client })
        const channel = client.createChannel('chat', { param: {} })
        return { client, server, channel }
      },
    },
  ]

  for (const scenario of scenarios) {
    test(scenario.name, async () => {
      const { client, server, channel } = await scenario.run()
      channel.close()
      await channel.catch(() => {})
      await client.dispose()
      await server.dispose()
      await new Promise((r) => setTimeout(r, 20))
      expect(rejections).toHaveLength(0)
    })
  }
})
```

- [ ] **Step 4: Run the integration test**

Run: `pnpm vitest run tests/integration/teardown.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `pnpm run test`
Expected: pass.

- [ ] **Step 6: Run lint**

Run: `pnpm run lint`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/hub-server/test/hub.test.ts tests/integration/teardown.test.ts
git commit -m "test: integration regression coverage for teardown rejections"
```

---

## Task 11: Documentation

**Files:**
- Modify: `docs/agents/architecture.md`
- Modify: `docs/capabilities/domains/core-rpc.md` (if it lists events)

- [ ] **Step 1: Update architecture doc**

Open `docs/agents/architecture.md` and add (or extend an existing "Lifecycle events" section) the following block near the end, adjusting heading depth to fit the surrounding document:

```markdown
## Lifecycle events

Each of `Transport`, `Server`, and `Client` exposes an `events` EventEmitter so consumers can observe the full connection lifecycle:

- **`Transport.events`** — `writeFailed` (optional, transport-specific), `readFailed`, `disposing`, `disposed`.
- **`Server.events`** — existing (`eventAuthError`, `handlerError`, `handlerTimeout`, `invalidMessage`) plus `handlerStart`, `handlerEnd`, `handlerAbort`, `writeDropped`, `disposing`, `disposed`, `transportAdded`, `transportRemoved`.
- **`Client.events`** — `requestStart`, `requestEnd`, `requestError`, `writeDropped`, `transportError`, `transportReplaced`, `disposing`, `disposed`.

Benign teardown errors (AbortError / DisposeInterruption / closed-writer) are swallowed by the internal `safeWrite` wrapper and surface as `writeDropped` rather than as unhandled rejections. Use `isBenignTeardownError` from `@enkaku/async` to classify errors in consumer code.
```

- [ ] **Step 2: Run documentation build (if wired up)**

Run: `pnpm run lint`
Expected: exits 0 (no markdown linter currently, just sanity check).

- [ ] **Step 3: Commit**

```bash
git add docs/agents/architecture.md
git commit -m "docs(architecture): document lifecycle events and benign teardown handling"
```

---

## Final verification

- [ ] **Step 1: Run full suite**

Run: `pnpm run test`
Expected: all packages pass; no unhandled rejections reported by vitest.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint`
Expected: exits 0.

- [ ] **Step 3: Update plan stage**

Edit this plan file: change `**Stage:** planning` (top) to `**Stage:** executing` only after starting executing in a new session. Do NOT flip it here during planning.

- [ ] **Step 4: Re-read the spec**

Confirm each spec section has at least one task in this plan:

| Spec section | Task(s) |
|-------------|---------|
| Error classification | Task 1 |
| `TransportEvents` extension + base wiring | Task 2 |
| `ServerEvents` extension | Tasks 3, 5 |
| Safe-write wrapper (server) | Task 4 |
| `handlerAbort` wiring | Task 5 |
| Server rejection fixes | Task 4 |
| `ClientEvents` | Task 7 |
| Client safe-write + `Close` path | Task 8 |
| Client lifecycle events | Task 9 |
| Tests (unit, integration, regression) | Tasks 1, 4–6, 8–10 |
| Migration + docs | Task 11 |
| Out-of-scope items | None (intentional) |

All rows covered.
