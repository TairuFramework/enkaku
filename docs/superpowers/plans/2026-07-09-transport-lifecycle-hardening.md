# Client / Transport Lifecycle Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** executing
**Mode:** tasks

**Goal:** Fix nine verified defects in the Enkaku client and transport lifecycle — four that crash or hang the process, five that degrade correctness or resource safety under load.

**Architecture:** Three dependency-ordered phases on branch `transport-lifecycle-hardening`. Phase 1 adds the shared `TransportEvents.requestAborted` primitive and fixes the client read loop. Phase 2 fixes the three transports (`socket`, `http-serve`, `http-fetch`), consuming that primitive. Phase 3 fixes the server: it subscribes to `requestAborted` and closes the auth-mode message-ordering race with a per-rid pending map.

**Tech Stack:** TypeScript (ESM, `NodeNext`), vitest, biome, pnpm workspaces, changesets. Web Streams (`ReadableStream`/`WritableStream`), `node:net`. Sibling packages `@sozai/stream`, `@sozai/async`, `@sozai/event`, `@kokuin/token`.

**Spec:** `docs/superpowers/specs/2026-07-09-transport-lifecycle-hardening-design.md`

## Global Constraints

- Use `type`, never `interface`.
- Use `Array<T>`, never `T[]`.
- Never use `any`. Use `unknown`, `Record<string, unknown>`, or a specific type.
- Uppercase abbreviations in names: `ID` not `Id`, `HTTP` not `Http`, `SSE` not `Sse`.
- `pnpm`/`pnpx` only. Never `npm`/`npx`.
- Never edit generated files (`lib/`, `.gen.ts`, `__generated__/`).
- Lint with `rtk proxy pnpm run lint`, never bare `pnpm run lint` (an `rtk` shim hijacks the latter).
- Run a single package's tests with `pnpm --filter @enkaku/<pkg> exec vitest run <path>`.
- Do not create new packages.
- Every task ends with a commit. Commit messages use Conventional Commits (`fix:`, `feat:`, `test:`, `refactor:`, `docs:`).

## Spec deviations recorded at plan time

### 1. http-fetch cannot surface a write failure through the sink

The spec's Phase 2 says the http-fetch writable sink should rethrow so `transport.write()` rejects. That works exactly once. `Transport.write` is `(await this._getWriter()).write(value)` (`packages/transport/src/index.ts:123-126`), and the Streams spec transitions a `WritableStream` to `errored` as soon as its `UnderlyingSink.write` rejects — every subsequent write then rejects with the same stored error. A single 500 on one fire-and-forget event would permanently disable the transport.

Task 11 therefore extracts the sink body into a `send(msg)` function, exposes it on `TransportStream`, and overrides `ClientTransport.write` to call it directly. The writable survives for `dispose()`'s `writer.close()`. This makes `@enkaku/http-fetch` a `minor` bump rather than the `patch` the spec assumed.

### 2. The abort bookkeeping has two call sites, not three

The spec's Phase 3 says the abort bookkeeping has three call sites and should be extracted into one `abortController(rid, reason)` helper. That is wrong, and Task 12 implements the corrected version.

The timeout sweep (`packages/server/src/server.ts:137-152`) calls `limiter.removeController(rid)`, `limiter.releaseHandler()`, `delete controllers[rid]`, `delete running[rid]`. The `abort`-message case (server.ts:703-707) deliberately does **none** of that — it only calls `controller.abort(reason)` and emits `handlerAbort`, leaving the bookkeeping to `processHandler`'s completion handler (server.ts:284-298), which is guarded by `running[rid] === returned`. Sharing one helper across both would release the limiter twice.

`requestAborted` must behave exactly like a client-sent `abort` message. So the extracted helper covers **two** sites (the `abort` case and the `requestAborted` subscription) and contains only `controller.abort(reason)` + `events.emit('handlerAbort', …)`. The timeout sweep is left alone.

---

# Phase 1 — client core

### Task 1: Add `requestAborted` to `TransportEvents`

**Files:**
- Modify: `packages/transport/src/index.ts:21-26`
- Test: `packages/transport/test/request-aborted.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `TransportEvents['requestAborted']` with type `{ rid: string; reason?: unknown }`. Task 10 emits it from http-serve; Task 12 subscribes to it in the server.

- [ ] **Step 1: Write the failing test**

Create `packages/transport/test/request-aborted.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'

import { Transport } from '../src/index.js'

describe('TransportEvents.requestAborted', () => {
  test('carries rid and reason to subscribers', async () => {
    const transport = new Transport<string, string>({
      stream: { readable: new ReadableStream<string>(), writable: new WritableStream<string>() },
    })
    const listener = vi.fn()
    transport.events.on('requestAborted', listener)

    await transport.events.emit('requestAborted', { rid: 'r1', reason: 'ClientDisconnected' })

    expect(listener).toHaveBeenCalledWith({ rid: 'r1', reason: 'ClientDisconnected' })
  })

  test('reason is optional', async () => {
    const transport = new Transport<string, string>({
      stream: { readable: new ReadableStream<string>(), writable: new WritableStream<string>() },
    })
    const listener = vi.fn()
    transport.events.on('requestAborted', listener)

    await transport.events.emit('requestAborted', { rid: 'r2' })

    expect(listener).toHaveBeenCalledWith({ rid: 'r2' })
  })
})
```

- [ ] **Step 2: Run the type check to verify it fails**

`vitest` strips types rather than checking them, so `vitest run` would *pass* this test even without the fix — `EventEmitter` happily emits an unknown key at runtime. The failing check for this task is the type check:

Run: `pnpm --filter @enkaku/transport exec tsc --noEmit -p tsconfig.test.json`
Expected: FAIL — `'requestAborted'` is not assignable to the event-name parameter, because it is not a key of `TransportEvents`.

- [ ] **Step 3: Add the event type**

In `packages/transport/src/index.ts`, replace the `TransportEvents` type (lines 21-26):

```ts
export type TransportEvents = {
  writeFailed: { error: Error; rid?: string }
  readFailed: { error: Error }
  disposing: { reason?: unknown }
  disposed: { reason?: unknown }
  /**
   * Emitted by a transport implementation when the peer for a specific
   * request goes away — an HTTP client disconnecting, an SSE session being
   * dropped. Trusted by the server because it originates in-process and
   * cannot arrive over the wire.
   */
  requestAborted: { rid: string; reason?: unknown }
}
```

- [ ] **Step 4: Run both checks to verify they pass**

Run: `pnpm --filter @enkaku/transport exec tsc --noEmit -p tsconfig.test.json`
Expected: no errors.

Run: `pnpm --filter @enkaku/transport exec vitest run test/request-aborted.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/index.ts packages/transport/test/request-aborted.test.ts
git commit -m "feat(transport): add requestAborted event to TransportEvents"
```

---

### Task 2: Client read loop survives malformed server messages

**Files:**
- Modify: `packages/client/src/client.ts:275,278` (map initialisers), `packages/client/src/client.ts:414-463` (dispatch)
- Test: `packages/client/test/malformed-messages.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new. Behavior only: `Client`'s `#read()` loop no longer dies on a message whose `rid` collides with an `Object.prototype` key, nor on any throw during dispatch.

**Background:** `#controllers` is a plain `{}` (client.ts:275). A server message with `rid: "__proto__"` makes `this.#controllers["__proto__"]` return `Object.prototype`, which is not `null`, so it passes the guard on line 415. `Object.prototype.error` is `undefined`, so `controller.error(error)` throws a `TypeError` inside the floating `#read()` promise. The loop exits, every in-flight request hangs, and every future request hangs too. `#spans` (line 278) has the same shape and is read on line 442.

- [ ] **Step 1: Write the failing test**

Create `packages/client/test/malformed-messages.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

/** Rejects if the promise has not settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out — client read loop is dead')), ms),
    ),
  ])
}

describe('client read loop resilience', () => {
  test('survives a server message with a prototype-polluting rid', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    // Server sends a result for rid "__proto__". Object.prototype is truthy, so a
    // plain-object controller map hands it back and `controller.error` blows up.
    await transports.server.write({
      payload: { typ: 'result', rid: '__proto__', val: 'boom' },
    } as unknown as AnyServerMessageOf<Protocol>)

    // Drive a real request through the same read loop. It must still complete.
    const call = client.request('test/request', { id: 'r1' })
    const received = await transports.server.read()
    expect(received.value?.payload.rid).toBe('r1')
    await transports.server.write({
      payload: { typ: 'result', rid: 'r1', val: 'ok' },
    } as unknown as AnyServerMessageOf<Protocol>)

    await expect(withTimeout(call, 1000)).resolves.toBe('ok')

    await client.dispose()
    await transports.dispose()
  })

  test('survives a throw while dispatching a server message', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    const call = client.request('test/request', { id: 'r1' })
    await transports.server.read()

    // `error` payloads run RequestError.fromPayload; a payload shaped to make it
    // throw must not take the read loop down with it.
    await transports.server.write({
      payload: { typ: 'error', rid: 'r1', get code(): string { throw new Error('nope') } },
    } as unknown as AnyServerMessageOf<Protocol>)

    // Loop is alive: a second request still round-trips.
    const call2 = client.request('test/request', { id: 'r2' })
    const received = await transports.server.read()
    expect(received.value?.payload.rid).toBe('r2')
    await transports.server.write({
      payload: { typ: 'result', rid: 'r2', val: 'ok' },
    } as unknown as AnyServerMessageOf<Protocol>)

    await expect(withTimeout(call2, 1000)).resolves.toBe('ok')

    call.abort('cleanup')
    await call.catch(() => {})
    await client.dispose()
    await transports.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/client exec vitest run test/malformed-messages.test.ts`
Expected: FAIL — both tests reject with `timed out — client read loop is dead`.

- [ ] **Step 3: Null-prototype maps and a dispatch guard**

In `packages/client/src/client.ts`, replace lines 275 and 278:

```ts
  #controllers: Record<string, AnyClientController> = Object.create(null)
```

```ts
  #spans: Record<string, Span> = Object.create(null)
```

Then, in `#abortControllers` (line 322), replace `this.#controllers = {}` with:

```ts
    this.#controllers = Object.create(null)
```

Finally, wrap the dispatch in `#read()`. Replace everything from `const controller = this.#controllers[msg.payload.rid]` (line 414) through the closing brace of the `switch` (line 463) with:

```ts
      try {
        const controller = this.#controllers[msg.payload.rid]
        if (controller == null) {
          this.#logger.warn('controller not found for request {rid}', {
            rid: msg.payload.rid,
          })
          continue
        }

        switch (msg.payload.typ) {
          case 'error': {
            const error = RequestError.fromPayload(msg.payload)
            this.#logger.debug('error reply for {type} {procedure} with ID {rid}: {error}', {
              type: controller.type,
              procedure: controller.procedure,
              rid: msg.payload.rid,
              error,
            })
            controller.error(error)
            delete this.#controllers[msg.payload.rid]
            break
          }
          case 'receive': {
            this.#logger.trace('receive reply for {type} {procedure} with ID {rid}: {receive}', {
              type: controller.type,
              procedure: controller.procedure,
              rid: msg.payload.rid,
              receive: msg.payload.val,
            })
            const receiveSpan = this.#spans[msg.payload.rid]
            if (receiveSpan != null) {
              receiveSpan.addEvent('stream.message.received', {
                [EnkakuAttributeKeys.MESSAGE_DIRECTION]: 'receive',
              })
            }
            void (controller as StreamController<unknown, unknown>).receive
              ?.write(msg.payload.val)
              .catch(() => {})
            break
          }
          case 'result':
            this.#logger.trace('result reply for {type} {procedure} with ID {rid}: {result}', {
              type: controller.type,
              procedure: controller.procedure,
              rid: msg.payload.rid,
              result: msg.payload.val,
            })
            controller.ok(msg.payload.val)
            delete this.#controllers[msg.payload.rid]
            break
        }
      } catch (cause) {
        // A malformed or hostile server message must never kill the read loop:
        // doing so hangs every in-flight and future request on this client.
        this.#logger.warn('failed to handle server message', { cause })
      }
```

Note the `continue` inside the `try` still continues the enclosing `while (true)` — that is intentional and unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/client exec vitest run test/malformed-messages.test.ts`
Expected: PASS, 2 tests.

Then run the whole client suite to catch regressions:

Run: `pnpm --filter @enkaku/client exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/client.ts packages/client/test/malformed-messages.test.ts
git commit -m "fix(client): survive malformed server messages in the read loop

Use null-prototype maps for #controllers and #spans so a message with
rid \"__proto__\" cannot resolve to Object.prototype, and guard message
dispatch with try/catch so no throw can kill the floating #read() loop."
```

---

### Task 3: Graceful remote close disposes the transport

**Files:**
- Modify: `packages/client/src/client.ts:386-390`
- Test: `packages/client/test/graceful-close.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new. Behavior only: when the transport's readable ends cleanly, the client disposes the transport, which resolves `transport.disposed` and drives the existing `#setupTransport` handler.

**Background:** `#read()` returns silently on `next.done` (client.ts:387-389). Nothing disposes the transport when its readable ends, so `transport.disposed` never resolves, the handler registered at client.ts:327 never fires, controllers are never aborted, and `handleTransportDisposed` never runs. A clean socket close leaves in-flight requests hanging forever and never triggers reconnect.

- [ ] **Step 1: Write the failing test**

Create `packages/client/test/graceful-close.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports, Transport } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

/** A transport whose readable closes cleanly on the next microtask. */
function createClosingTransport(): Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  const readable = new ReadableStream<AnyServerMessageOf<Protocol>>({
    start(controller) {
      controller.close()
    },
  })
  const writable = new WritableStream<AnyClientMessageOf<Protocol>>()
  return new Transport({ stream: { readable, writable } })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out — graceful close was not handled')), ms),
    ),
  ])
}

describe('graceful remote close', () => {
  test('calls handleTransportDisposed when the readable ends', async () => {
    const disposed = vi.fn(() => undefined)
    const client = new Client<Protocol>({
      transport: createClosingTransport(),
      handleTransportDisposed: disposed,
    })

    await withTimeout(
      new Promise<void>((resolve) => {
        client.events.on('disposed', () => resolve())
      }),
      1000,
    )

    expect(disposed).toHaveBeenCalled()
    expect(client.signal.aborted).toBe(true)
  })

  test('aborts in-flight requests instead of hanging them', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    const call = client.request('test/request', { id: 'r1' })
    await transports.server.read()

    // Server closes its writable — the client's readable ends cleanly.
    await transports.server.dispose()

    await expect(withTimeout(call, 1000)).rejects.toBeDefined()

    await client.dispose()
    await transports.dispose()
  })

  test('swaps in the replacement transport returned by the handler', async () => {
    const replacement = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({
      transport: createClosingTransport(),
      handleTransportDisposed: () => replacement.client,
    })

    await withTimeout(
      new Promise<void>((resolve) => {
        client.events.on('transportReplaced', () => resolve())
      }),
      1000,
    )

    expect(client.signal.aborted).toBe(false)

    await client.dispose()
    await replacement.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/client exec vitest run test/graceful-close.test.ts`
Expected: FAIL — all three tests reject with `timed out — graceful close was not handled` (or, for the second, the timeout message from `withTimeout`).

- [ ] **Step 3: Dispose the transport on `done`**

In `packages/client/src/client.ts`, replace lines 386-390 inside `#read()`:

```ts
        const next = await this.#transport.read()
        if (next.done) {
          if (!this.signal.aborted) {
            // The readable ended without anything disposing the transport, so
            // `transport.disposed` would never resolve and the handler wired up
            // in #setupTransport would never run. Dispose it here and let that
            // handler abort controllers / swap in a replacement as usual.
            void this.#transport.dispose()
          }
          return
        }
        msg = next.value
```

The `!this.signal.aborted` guard keeps a client-initiated dispose from re-entering: `Client`'s own `dispose` already calls `this.#transport.dispose(reason)` (client.ts:293), and the resulting `done` must not call it a second time.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/client exec vitest run test/graceful-close.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter @enkaku/client exec vitest run`
Expected: PASS. If `test/dispose-aborts-controllers.test.ts` or `test/transport-replacement.test.ts` fail, the guard is wrong — re-read step 3.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/client.ts packages/client/test/graceful-close.test.ts
git commit -m "fix(client): treat a closed transport readable as transport disposal

A graceful remote close left transport.disposed unresolved, so controllers
were never aborted and handleTransportDisposed never ran — in-flight
requests hung forever and reconnect never fired."
```

---

### Task 4: `sendEvent` rejects when the write fails

**Files:**
- Modify: `packages/client/src/safe-write.ts:31-48`
- Modify: `packages/client/test/safe-write.test.ts:57-90` (two existing tests assert the old behavior)
- Test: `packages/client/test/send-event-failure.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `safeWrite` now rejects with the original error when `rid == null` and the failure is not a benign teardown. It still resolves for rid-bearing writes. Task 11 (http-fetch) relies on this to make `await client.sendEvent(...)` reject.

**Background:** `safeWrite` never rejects today, so `client.sendEvent()` resolves even when the transport write fails. Rid-bearing writes do not need the throw — `#write`'s `onFailure` hook (client.ts:485-492) aborts `#controllers[rid]`, so the awaited request/stream/channel promise already rejects. Rid-less writes have no controller, so a throw is their only channel. `#notifyAbort` (client.ts:503) always passes a `rid`, so it never hits the new throw.

- [ ] **Step 1: Write the failing test**

Create `packages/client/test/send-event-failure.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { Transport } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/event': { type: 'event' },
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

/** A transport whose every write fails with a non-benign error. */
function createFailingWriteTransport(): Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  const readable = new ReadableStream<AnyServerMessageOf<Protocol>>()
  const writable = new WritableStream<AnyClientMessageOf<Protocol>>({
    write() {
      throw new Error('socket exploded')
    },
  })
  return new Transport({ stream: { readable, writable } })
}

describe('sendEvent write failures', () => {
  test('rejects when the transport write fails', async () => {
    const client = new Client<Protocol>({ transport: createFailingWriteTransport() })

    await expect(client.sendEvent('test/event')).rejects.toThrow('socket exploded')

    await client.dispose()
  })

  test('still emits writeFailed alongside the rejection', async () => {
    const client = new Client<Protocol>({ transport: createFailingWriteTransport() })
    const failed = vi.fn()
    client.events.on('writeFailed', failed)

    await expect(client.sendEvent('test/event')).rejects.toThrow('socket exploded')
    expect(failed).toHaveBeenCalled()

    await client.dispose()
  })

  test('rid-bearing writes still resolve and surface on the controller', async () => {
    const client = new Client<Protocol>({ transport: createFailingWriteTransport() })

    // The request call rejects via its controller, not via a safeWrite throw.
    await expect(client.request('test/request', { id: 'r1' })).rejects.toBeDefined()

    await client.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/client exec vitest run test/send-event-failure.test.ts`
Expected: FAIL — the first two tests fail with "promise resolved instead of rejecting".

- [ ] **Step 3: Rethrow for rid-less writes**

In `packages/client/src/safe-write.ts`, replace the doc comment and body of `safeWrite` (lines 23-48):

```ts
/**
 * Send a client message through the transport. Classifies any failure as
 * either a benign teardown (swallowed → `writeDropped` event) or a real
 * transport failure (`writeFailed` event + `onFailure` hook for per-call
 * surfacing).
 *
 * Rejects only for rid-less messages (events). A rid-bearing message already
 * surfaces its failure through `onFailure`, which aborts the per-rid
 * controller so the awaited call rejects there. A rid-less message has no
 * controller, so throwing is the only way its caller can learn the write
 * failed.
 */
export async function safeWrite(params: SafeWriteParams): Promise<void> {
  const { transport, message, rid, events, signal, onFailure } = params
  try {
    await transport.write(message)
    return
  } catch (error) {
    if (isBenignTeardownError(error) && signal.aborted) {
      await events.emit('writeDropped', {
        rid,
        reason: 'disposing',
        error: error as Error,
      })
      return
    }
    await events.emit('writeFailed', { error: error as Error, rid })
    onFailure?.(error as Error)
    if (rid == null) {
      throw error
    }
  }
}
```

- [ ] **Step 4: Update the two existing tests that assert the old behavior**

`packages/client/test/safe-write.test.ts` has two rid-less tests that assert `safeWrite` never rejects. Both must now expect a rejection. Replace lines 57-90 (the last two `test(...)` blocks) with:

```ts
  test('emits writeFailed on non-benign errors and rejects rid-less writes', async () => {
    const transport = fakeTransport('boom')
    const events = new EventEmitter<ClientEvents>()
    const failed = vi.fn()
    events.on('writeFailed', failed)

    await expect(
      safeWrite({
        transport,
        message: 'x',
        events,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('non-benign')

    expect(failed).toHaveBeenCalled()
  })

  test('emits writeFailed on non-benign errors and resolves rid-bearing writes', async () => {
    const transport = fakeTransport('boom')
    const events = new EventEmitter<ClientEvents>()
    const failed = vi.fn()
    const onFailure = vi.fn()
    events.on('writeFailed', failed)

    await safeWrite({
      transport,
      message: 'x',
      rid: 'r1',
      events,
      signal: new AbortController().signal,
      onFailure,
    })

    expect(failed).toHaveBeenCalled()
    expect(onFailure).toHaveBeenCalled()
  })

  test('surfaces benign errors outside disposal via writeFailed', async () => {
    const transport = fakeTransport('closed')
    const events = new EventEmitter<ClientEvents>()
    const failed = vi.fn()
    const dropped = vi.fn()
    events.on('writeFailed', failed)
    events.on('writeDropped', dropped)

    await expect(
      safeWrite({
        transport,
        message: 'x',
        events,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('Invalid state: WritableStream is closed')

    expect(dropped).not.toHaveBeenCalled()
    expect(failed).toHaveBeenCalled()
  })
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/client exec vitest run test/send-event-failure.test.ts test/safe-write.test.ts`
Expected: PASS.

Run the whole client suite — `test/lib.test.ts` may contain other `sendEvent` calls against failing transports:

Run: `pnpm --filter @enkaku/client exec vitest run`
Expected: PASS. If a test in `lib.test.ts` now fails because an event write rejects, that test was asserting the bug. Update it to `await expect(...).rejects` and note it in the commit body.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/safe-write.ts packages/client/test/
git commit -m "feat(client)!: reject sendEvent when the transport write fails

safeWrite now rethrows for rid-less messages. Rid-bearing writes still
resolve, because onFailure aborts their controller and the awaited call
rejects there. Events had no such channel, so a failed event write was
silently reported as success."
```

---

# Phase 2 — transports

### Task 5: Socket write-after-close no longer crashes the process

**Files:**
- Modify: `packages/socket/src/index.ts:44-101`
- Test: `packages/socket/test/write-after-close.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `createTransportStream`'s writable sink rejects (rather than crashing the process) when the socket is destroyed or has errored.

**Background:** `detach()` (socket/src/index.ts:78-82) removes the socket's only `'error'` listener once the readable settles. The writable returned from the same function still calls `socket.write()`. A write on the destroyed socket emits `'error'` with zero listeners, which Node escalates to an uncaught exception.

- [ ] **Step 1: Write the failing test**

Create `packages/socket/test/write-after-close.test.ts`:

```ts
import { PassThrough } from 'node:stream'
import type { Socket } from 'node:net'
import { describe, expect, test } from 'vitest'

import { createTransportStream } from '../src/index.js'

/**
 * A duplex stand-in for a Socket. `destroy()` marks it destroyed and emits
 * 'close', mimicking a peer that hung up.
 */
function fakeSocket(): Socket {
  const socket = new PassThrough() as unknown as Socket & PassThrough
  // node:net sockets have these; PassThrough does not.
  Object.assign(socket, {
    unref: () => socket,
    ref: () => socket,
  })
  return socket as unknown as Socket
}

describe('socket write-after-close', () => {
  test('rejects the write instead of emitting an unhandled error', async () => {
    const socket = fakeSocket()
    const { writable } = await createTransportStream<unknown, { hello: string }>(socket)

    const uncaught: Array<Error> = []
    const onUncaught = (err: Error) => uncaught.push(err)
    process.on('uncaughtException', onUncaught)

    try {
      socket.destroy()
      // Let the 'close' event settle the readable and run detach().
      await new Promise((resolve) => setTimeout(resolve, 10))

      const writer = writable.getWriter()
      await expect(writer.write({ hello: 'world' })).rejects.toThrow(/closed/i)

      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(uncaught).toEqual([])
    } finally {
      process.off('uncaughtException', onUncaught)
    }
  })

  test('a late socket error does not crash the process', async () => {
    const socket = fakeSocket()
    await createTransportStream<unknown, unknown>(socket)

    const uncaught: Array<Error> = []
    const onUncaught = (err: Error) => uncaught.push(err)
    process.on('uncaughtException', onUncaught)

    try {
      socket.destroy()
      await new Promise((resolve) => setTimeout(resolve, 10))

      // detach() has run. With no listener left, this would be an uncaught throw.
      socket.emit('error', new Error('EPIPE'))
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(uncaught).toEqual([])
    } finally {
      process.off('uncaughtException', onUncaught)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/socket exec vitest run test/write-after-close.test.ts`
Expected: FAIL — the first test's `writer.write(...)` resolves instead of rejecting; the second records an entry in `uncaught`.

- [ ] **Step 3: Keep a permanent error listener and guard the sink**

In `packages/socket/src/index.ts`, replace `createTransportStream` (lines 44-101):

```ts
export async function createTransportStream<R, W>(
  source: SocketSource,
  options?: FromJSONLinesOptions<R>,
): Promise<ReadableWritablePair<R, W>> {
  const socket = await Promise.resolve(typeof source === 'function' ? source() : source)

  // Attached once and never removed. A socket with zero 'error' listeners
  // escalates any late error (a write on a destroyed socket, an EPIPE) to an
  // uncaught exception, which takes the process down.
  let socketError: Error | null = null
  socket.on('error', (err: Error) => {
    socketError = err
  })

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      let settled = false
      function onData(buffer: Buffer): void {
        if (!settled) {
          controller.enqueue(buffer)
        }
      }
      function onClose(): void {
        if (settled) {
          return
        }
        settled = true
        detach()
        try {
          controller.close()
        } catch {
          // Controller already closed or errored
        }
      }
      function onError(err: Error): void {
        if (settled) {
          return
        }
        settled = true
        detach()
        controller.error(err)
      }
      function detach(): void {
        socket.off('data', onData)
        socket.off('close', onClose)
        socket.off('error', onError)
      }
      socket.on('data', onData)
      socket.on('close', onClose)
      socket.on('error', onError)
    },
  }).pipeThrough(fromJSONLines<R>(options))

  const writable = writeTo<W>(
    (msg) => {
      if (socketError != null) {
        throw socketError
      }
      if (socket.destroyed || socket.writableEnded) {
        throw new Error('Socket is closed')
      }
      socket.write(`${JSON.stringify(msg)}\n`)
    },
    () => {
      socket.end()
      // Release the half-closed socket so it stops holding the event loop open
      socket.unref()
    },
  )

  return { readable, writable }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/socket exec vitest run test/write-after-close.test.ts`
Expected: PASS, 2 tests.

Run: `pnpm --filter @enkaku/socket exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/socket/src/index.ts packages/socket/test/write-after-close.test.ts
git commit -m "fix(socket): never leave the socket without an error listener

detach() removed the socket's only 'error' listener while the writable was
still calling socket.write(). A write on the destroyed socket emitted
'error' with no listeners, which Node escalates to an uncaught exception.
The sink now rejects instead."
```

---

### Task 6: Socket backpressure

**Files:**
- Modify: `packages/socket/src/index.ts` (readable strategy, writable sink, options type)
- Test: `packages/socket/test/backpressure.test.ts` (create)

**Interfaces:**
- Consumes: `createTransportStream` from Task 5.
- Produces: `CreateTransportStreamOptions<R> = FromJSONLinesOptions<R> & { highWaterMark?: number }`, exported. `SocketTransportParams<R>` extends it, so `new SocketTransport({ socket, highWaterMark })` type-checks. Default `highWaterMark` is `1_048_576`.

**Background:** `onData` enqueues every chunk unconditionally, and the sink ignores `socket.write()`'s return value. A fast peer with a slow consumer grows memory without bound in both directions.

- [ ] **Step 1: Write the failing test**

Create `packages/socket/test/backpressure.test.ts`:

```ts
import type { Socket } from 'node:net'
import { PassThrough } from 'node:stream'
import { describe, expect, test, vi } from 'vitest'

import { createTransportStream } from '../src/index.js'

function fakeSocket(): Socket & { paused: boolean } {
  const socket = new PassThrough() as unknown as Socket & PassThrough & { paused: boolean }
  socket.paused = false
  Object.assign(socket, {
    unref: () => socket,
    ref: () => socket,
    pause: vi.fn(() => {
      socket.paused = true
      return socket
    }),
    resume: vi.fn(() => {
      socket.paused = false
      return socket
    }),
  })
  return socket as unknown as Socket & { paused: boolean }
}

describe('socket backpressure', () => {
  test('pauses the socket once the readable queue is full', async () => {
    const socket = fakeSocket()
    await createTransportStream<unknown, unknown>(socket, { highWaterMark: 64 })

    // Nobody reads the readable. Two things matter here:
    //  - the chunks must be *complete* JSON lines, or fromJSONLines buffers them
    //    as a partial line, emits nothing, and never signals backpressure;
    //  - `pipeThrough` drains the source readable eagerly into the transform, so
    //    the source queue only grows once the transform's own queues are full.
    // Hence: feed lines until the socket is paused, with a bounded loop.
    const line = `${JSON.stringify({ v: 'x'.repeat(100) })}\n`
    for (let i = 0; i < 50 && !socket.paused; i++) {
      socket.emit('data', Buffer.from(line))
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    expect(socket.pause).toHaveBeenCalled()
  })

  test('awaits drain when the socket write buffer is full', async () => {
    const socket = fakeSocket()
    let drainPending = false
    // Simulate a full kernel buffer: write() returns false until 'drain' fires.
    socket.write = vi.fn(() => {
      drainPending = true
      return false
    }) as unknown as Socket['write']

    const { writable } = await createTransportStream<unknown, { n: number }>(socket)
    const writer = writable.getWriter()

    const pending = writer.write({ n: 1 })
    let settled = false
    void pending.then(() => {
      settled = true
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(drainPending).toBe(true)
    expect(settled).toBe(false)

    socket.emit('drain')
    await pending
    expect(settled).toBe(true)
  })

  test('a socket closing mid-drain rejects the pending write', async () => {
    const socket = fakeSocket()
    socket.write = vi.fn(() => false) as unknown as Socket['write']

    const { writable } = await createTransportStream<unknown, { n: number }>(socket)
    const writer = writable.getWriter()

    const pending = writer.write({ n: 1 })
    await new Promise((resolve) => setTimeout(resolve, 10))

    socket.emit('close')

    await expect(pending).rejects.toThrow(/closed while draining/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/socket exec vitest run test/backpressure.test.ts`
Expected: FAIL — `highWaterMark` is not a valid option (TypeScript error), `socket.pause` is never called, and the write resolves immediately.

- [ ] **Step 3: Implement backpressure**

In `packages/socket/src/index.ts`, add the constant and helper above `createTransportStream`:

```ts
const DEFAULT_HIGH_WATER_MARK = 1_048_576 // 1 MiB

export type CreateTransportStreamOptions<R> = FromJSONLinesOptions<R> & {
  /** Bytes to buffer before pausing the socket / awaiting drain. Defaults to 1 MiB. */
  highWaterMark?: number
}

/**
 * Resolve when the socket drains. Reject if it closes or errors first, so a
 * write can never hang on a drain event that will never arrive.
 */
function waitForDrain(socket: Socket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    function cleanup(): void {
      socket.off('drain', onDrain)
      socket.off('close', onClose)
      socket.off('error', onError)
    }
    function onDrain(): void {
      cleanup()
      resolve()
    }
    function onClose(): void {
      cleanup()
      reject(new Error('Socket closed while draining'))
    }
    function onError(err: Error): void {
      cleanup()
      reject(err)
    }
    socket.on('drain', onDrain)
    socket.on('close', onClose)
    socket.on('error', onError)
  })
}
```

Then change `createTransportStream`'s signature and body. Replace the signature line and the first statement:

```ts
export async function createTransportStream<R, W>(
  source: SocketSource,
  options?: CreateTransportStreamOptions<R>,
): Promise<ReadableWritablePair<R, W>> {
  const socket = await Promise.resolve(typeof source === 'function' ? source() : source)
  const { highWaterMark = DEFAULT_HIGH_WATER_MARK, ...jsonOptions } = options ?? {}
```

Replace `onData` and the `ReadableStream` construction (keep `onClose`/`onError`/`detach` exactly as Task 5 left them):

```ts
  const readable = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        let settled = false
        function onData(buffer: Buffer): void {
          if (settled) {
            return
          }
          controller.enqueue(buffer)
          if ((controller.desiredSize ?? 0) <= 0) {
            socket.pause()
          }
        }
        function onClose(): void {
          if (settled) {
            return
          }
          settled = true
          detach()
          try {
            controller.close()
          } catch {
            // Controller already closed or errored
          }
        }
        function onError(err: Error): void {
          if (settled) {
            return
          }
          settled = true
          detach()
          controller.error(err)
        }
        function detach(): void {
          socket.off('data', onData)
          socket.off('close', onClose)
          socket.off('error', onError)
        }
        socket.on('data', onData)
        socket.on('close', onClose)
        socket.on('error', onError)
      },
      pull() {
        // The consumer drained below the high-water mark — let data flow again.
        socket.resume()
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark }),
  ).pipeThrough(fromJSONLines<R>(jsonOptions))
```

Replace the writable sink so it awaits drain:

```ts
  const writable = writeTo<W>(
    async (msg) => {
      if (socketError != null) {
        throw socketError
      }
      if (socket.destroyed || socket.writableEnded) {
        throw new Error('Socket is closed')
      }
      if (!socket.write(`${JSON.stringify(msg)}\n`)) {
        // Returning a promise makes WritableStream apply backpressure upstream.
        await waitForDrain(socket)
      }
    },
    () => {
      socket.end()
      // Release the half-closed socket so it stops holding the event loop open
      socket.unref()
    },
  )
```

Finally widen `SocketTransportParams` (currently line 103):

```ts
export type SocketTransportParams<R> = CreateTransportStreamOptions<R> & {
  socket: SocketSource | string
  signal?: AbortSignal
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/socket exec vitest run test/backpressure.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter @enkaku/socket exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/socket/src/index.ts packages/socket/test/backpressure.test.ts
git commit -m "feat(socket): bound read and write buffers with backpressure

Pause the socket when the readable queue exceeds highWaterMark and resume
on pull; await 'drain' when socket.write() reports a full buffer, racing it
against close/error so a dying socket rejects the write rather than hanging
it. New highWaterMark option, default 1 MiB."
```

---

### Task 7: SSE writes refresh the session timeout

**Files:**
- Modify: `packages/http-serve/src/index.ts:191-192`
- Test: `packages/http-serve/test/session-limits.test.ts` (add one test)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new. Behavior only: `session.lastAccess` is refreshed by outbound SSE writes.

**Background:** `session.lastAccess` is set on session creation (line 333) and refreshed only by inbound POSTs on an existing session (line 319). A stream whose consumer only reads — the common case for a server-push stream — is killed by the cleanup interval (lines 133-149) at the 5-minute default despite continuous outbound traffic.

- [ ] **Step 1: Write the failing test**

Append to the `describe('session limits', ...)` block in `packages/http-serve/test/session-limits.test.ts`:

```ts
  test('an outbound SSE write refreshes the session timeout', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({ maxSessions: 1, sessionTimeoutMs: 1000 })

      const res1 = await bridge.handleRequest(createStreamPost('r1'))
      expect(res1.status).toBe(200)

      vi.advanceTimersByTime(800)

      // Server pushes a stream value for r1 — this must refresh lastAccess.
      const writer = bridge.stream.writable.getWriter()
      await writer.write({
        payload: { typ: 'receive', rid: 'r1', val: 'tick' },
      } as never)
      writer.releaseLock()

      vi.advanceTimersByTime(800)

      // Only 800ms since the SSE write, so the session must still be alive:
      // a new session request hits maxSessions and is refused.
      const res2 = await bridge.handleRequest(createStreamPost('r2'))
      expect(res2.status).toBe(503)
    } finally {
      vi.useRealTimers()
    }
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/http-serve exec vitest run test/session-limits.test.ts`
Expected: FAIL — `expected 200 to be 503`. The session was reaped despite the write.

- [ ] **Step 3: Refresh `lastAccess` on enqueue**

In `packages/http-serve/src/index.ts`, replace the `try` block at lines 191-202:

```ts
      try {
        session.controller.enqueue(`data: ${JSON.stringify(msg)}\n\n`)
        // Outbound traffic keeps the session alive: a stream whose consumer only
        // reads would otherwise be reaped at sessionTimeoutMs.
        session.lastAccess = Date.now()
      } catch (cause) {
        options.onWriteError?.({
          error: new Error(`Error writing to SSE feed for session: ${request.sessionID}`, {
            cause,
          }),
          rid,
        })
        sessions.delete(request.sessionID)
        clearSessionInflight(request.sessionID)
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/http-serve exec vitest run test/session-limits.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/http-serve/src/index.ts packages/http-serve/test/session-limits.test.ts
git commit -m "fix(http-serve): refresh session lastAccess on outbound SSE writes

lastAccess was refreshed only by inbound POSTs, so a passive stream consumer
was cut off at sessionTimeoutMs despite continuous server-push traffic."
```

---

### Task 8: Reject duplicate in-flight request IDs

**Files:**
- Modify: `packages/http-serve/src/index.ts:272-355`
- Test: `packages/http-serve/test/duplicate-rid.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new. Behavior only: a `request`, `stream`, or `channel` POST whose `rid` is already in `inflight` gets `409 { error: 'Duplicate request ID' }`.

**Background:** `inflight.set(rid, ...)` is unconditional at lines 281, 320, and 343. Reusing an rid while the first is still in flight overwrites the map entry: the first caller's deferred `Response` never resolves (it hangs until `requestTimeoutMs`) and the second caller receives the first's reply.

- [ ] **Step 1: Write the failing test**

Create `packages/http-serve/test/duplicate-rid.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { createServerBridge } from '../src/index.js'

function createRequestPost(rid: string): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { typ: 'request', rid, prc: 'test/request' } }),
  })
}

function createStreamPost(rid: string, sessionID?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sessionID != null) {
    headers['enkaku-session-id'] = sessionID
  }
  return new Request('http://localhost/', {
    method: 'POST',
    headers,
    body: JSON.stringify({ payload: { typ: 'stream', rid, prc: 'test/stream' } }),
  })
}

describe('duplicate request IDs', () => {
  test('a second in-flight request with the same rid gets 409', async () => {
    const bridge = createServerBridge()

    // First request never gets a reply — it stays in flight.
    void bridge.handleRequest(createRequestPost('r1'))
    await new Promise((resolve) => setTimeout(resolve, 10))

    const res = await bridge.handleRequest(createRequestPost('r1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/duplicate request id/i)
  })

  test('a stream reusing an in-flight rid gets 409', async () => {
    const bridge = createServerBridge()

    const res1 = await bridge.handleRequest(createStreamPost('r1'))
    expect(res1.status).toBe(200)
    const sessionID = res1.headers.get('enkaku-session-id') as string

    const res2 = await bridge.handleRequest(createStreamPost('r1', sessionID))
    expect(res2.status).toBe(409)
  })

  test('a released rid can be reused', async () => {
    const bridge = createServerBridge()

    void bridge.handleRequest(createRequestPost('r1'))
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Server replies, which deletes the inflight entry.
    const writer = bridge.stream.writable.getWriter()
    await writer.write({ payload: { typ: 'result', rid: 'r1', val: 'ok' } } as never)
    writer.releaseLock()
    await new Promise((resolve) => setTimeout(resolve, 10))

    void bridge.handleRequest(createRequestPost('r1'))
    await new Promise((resolve) => setTimeout(resolve, 10))

    // The second one is now the in-flight holder; a third is refused.
    const res = await bridge.handleRequest(createRequestPost('r1'))
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/http-serve exec vitest run test/duplicate-rid.test.ts`
Expected: FAIL — the first two tests hang or report a non-409 status.

- [ ] **Step 3: Guard `inflight.set`**

In `packages/http-serve/src/index.ts`, in the `case 'request':` block, insert the guard immediately after `const rid = message.payload.rid` (line 279) and before `const response = defer<Response>()`:

```ts
          const rid = message.payload.rid
          if (inflight.has(rid)) {
            return Response.json({ error: 'Duplicate request ID' }, { headers, status: 409 })
          }
          const response = defer<Response>()
```

In the `case 'channel': case 'stream':` block, insert the guard as the first statement of the block, before `const sid = request.headers.get('enkaku-session-id')` (line 309):

```ts
        case 'channel':
        case 'stream': {
          if (inflight.has(message.payload.rid)) {
            return Response.json({ error: 'Duplicate request ID' }, { headers, status: 409 })
          }
          const sid = request.headers.get('enkaku-session-id')
```

`abort`, `event`, and `send` never touch `inflight` and are unaffected.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/http-serve exec vitest run test/duplicate-rid.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter @enkaku/http-serve exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/http-serve/src/index.ts packages/http-serve/test/duplicate-rid.test.ts
git commit -m "fix(http-serve)!: reject duplicate in-flight request IDs with 409

inflight.set(rid) was unconditional, so reusing an rid inside the window
overwrote the map entry: the first caller hung until requestTimeoutMs and
the second received the first caller's reply."
```

---

### Task 9: Bound the SSE session buffer

**Files:**
- Modify: `packages/http-serve/src/index.ts` (options type, SSE readable construction, writable sink, new `dropSession` helper)
- Test: `packages/http-serve/test/sse-buffer-limits.test.ts` (create)

**Interfaces:**
- Consumes: `clearSessionInflight` (existing, http-serve/src/index.ts:124-130).
- Produces: `ServerBridgeOptions.maxSessionBufferBytes?: number` and `ServerTransportOptions.maxSessionBufferBytes?: number`, default `1_048_576`. New internal `dropSession(sessionID: string, rid: string | undefined, error: Error): void`.

**Background:** `session.controller.enqueue(...)` (line 192) runs inside the bridge's single writable sink, shared by every session. Awaiting one session's `desiredSize` there would head-of-line-block every other session. Instead, give the SSE readable a byte-denominated queuing strategy so `desiredSize` becomes a live budget, and drop the session when it is exhausted.

- [ ] **Step 1: Write the failing test**

Create `packages/http-serve/test/sse-buffer-limits.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'

import { createServerBridge } from '../src/index.js'

function createStreamPost(rid: string, sessionID?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sessionID != null) {
    headers['enkaku-session-id'] = sessionID
  }
  return new Request('http://localhost/', {
    method: 'POST',
    headers,
    body: JSON.stringify({ payload: { typ: 'stream', rid, prc: 'test/stream' } }),
  })
}

describe('SSE buffer limits', () => {
  test('drops a session whose buffer overflows and reports it', async () => {
    const onWriteError = vi.fn()
    const bridge = createServerBridge({ maxSessionBufferBytes: 256, onWriteError })

    const res = await bridge.handleRequest(createStreamPost('r1'))
    expect(res.status).toBe(200)
    // Deliberately never read res.body — the consumer is stalled.

    const writer = bridge.stream.writable.getWriter()
    const big = 'x'.repeat(200)
    for (let i = 0; i < 5; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: big } } as never)
    }
    writer.releaseLock()

    expect(onWriteError).toHaveBeenCalled()
    const { error } = onWriteError.mock.calls[0][0] as { error: Error }
    expect(error.message).toMatch(/overflow/i)
  })

  test('a dropped session frees its slot', async () => {
    const bridge = createServerBridge({ maxSessions: 1, maxSessionBufferBytes: 256 })

    const res1 = await bridge.handleRequest(createStreamPost('r1'))
    expect(res1.status).toBe(200)

    const writer = bridge.stream.writable.getWriter()
    const big = 'x'.repeat(200)
    for (let i = 0; i < 5; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: big } } as never)
    }
    writer.releaseLock()

    // The overflowing session was deleted, so a new one is accepted despite maxSessions: 1.
    const res2 = await bridge.handleRequest(createStreamPost('r2'))
    expect(res2.status).toBe(200)
  })

  test('a healthy session is never dropped', async () => {
    const bridge = createServerBridge({ maxSessions: 1, maxSessionBufferBytes: 1024 })

    const res = await bridge.handleRequest(createStreamPost('r1'))
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    await reader.read() // consume the priming ':\n\n' comment

    const writer = bridge.stream.writable.getWriter()
    for (let i = 0; i < 20; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: 'tick' } } as never)
      await reader.read()
    }
    writer.releaseLock()

    // Still occupied: a second session is refused.
    const res2 = await bridge.handleRequest(createStreamPost('r2'))
    expect(res2.status).toBe(503)

    reader.releaseLock()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/http-serve exec vitest run test/sse-buffer-limits.test.ts`
Expected: FAIL — `maxSessionBufferBytes` is not a valid option (TypeScript error), and `onWriteError` is never called.

- [ ] **Step 3: Add the option and the bounded readable**

In `packages/http-serve/src/index.ts`, add `maxSessionBufferBytes` to `ServerBridgeOptions` (line 45-55) and `ServerTransportOptions` (line 424-433). In both, add:

```ts
  maxSessionBufferBytes?: number
```

Read it alongside the other defaults (after line 119):

```ts
  const maxSessionBufferBytes = options.maxSessionBufferBytes ?? 1_048_576 // 1 MiB
```

Add `dropSession` immediately after `clearSessionInflight` (after line 130):

```ts
  /**
   * Tear down a session that can no longer be written to. Isolated per session
   * on purpose: the bridge's writable sink is shared by every session, so
   * blocking on one slow consumer would stall all the others.
   */
  function dropSession(sessionID: string, rid: string | undefined, error: Error): void {
    const session = sessions.get(sessionID)
    if (session?.controller != null) {
      try {
        session.controller.close()
      } catch {
        // Already closed or errored
      }
    }
    sessions.delete(sessionID)
    clearSessionInflight(sessionID)
    options.onWriteError?.({ error, rid })
  }
```

Replace the `try`/`catch` in the writable sink (as Task 7 left it) with:

```ts
      try {
        session.controller.enqueue(`data: ${JSON.stringify(msg)}\n\n`)
        // Outbound traffic keeps the session alive: a stream whose consumer only
        // reads would otherwise be reaped at sessionTimeoutMs.
        session.lastAccess = Date.now()
      } catch (cause) {
        dropSession(
          request.sessionID,
          rid,
          new Error(`Error writing to SSE feed for session: ${request.sessionID}`, { cause }),
        )
        return
      }
      if ((session.controller.desiredSize ?? 0) <= 0) {
        // The consumer has fallen maxSessionBufferBytes behind. Drop this session
        // alone rather than growing its queue without bound.
        dropSession(
          request.sessionID,
          rid,
          new Error(`SSE buffer overflow for session: ${request.sessionID}`),
        )
      }
```

Replace the SSE body construction (line 330) — `createReadable` gives no control over the queuing strategy, so build the stream directly:

```ts
          const sessionID = runtime.getRandomID()
          let sseController: ReadableStreamDefaultController<string> | undefined
          const body = new ReadableStream<string>(
            {
              start(ctrl) {
                sseController = ctrl
              },
            },
            // A byte-denominated strategy makes `desiredSize` a live budget:
            // decremented on enqueue, restored as the consumer pulls. `length`
            // counts UTF-16 code units rather than the bytes TextEncoderStream
            // will emit — proportional, cheap, and this is a safety bound rather
            // than an accounting guarantee.
            { highWaterMark: maxSessionBufferBytes, size: (chunk) => chunk.length },
          )
          const controllerRef = sseController as ReadableStreamDefaultController<string>
          // Send an SSE comment to flush response headers immediately.
          controllerRef.enqueue(':\n\n')
          sessions.set(sessionID, { controller: controllerRef, lastAccess: Date.now() })

          request.signal.addEventListener('abort', () => {
            try {
              controllerRef.close()
            } catch {}
            sessions.delete(sessionID)
            clearSessionInflight(sessionID)
          })
```

Wire the option through `ServerTransport`'s call to `createServerBridge` (line 442-454) by adding:

```ts
      maxSessionBufferBytes: options.maxSessionBufferBytes,
```

If `createReadable` is now unused in this file, remove it from the `@sozai/stream` import on line 25. Check with `grep -n createReadable packages/http-serve/src/index.ts` — the incoming-message readable on line 154 still uses it, so keep the import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/http-serve exec vitest run test/sse-buffer-limits.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter @enkaku/http-serve exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/http-serve/src/index.ts packages/http-serve/test/sse-buffer-limits.test.ts
git commit -m "feat(http-serve)!: bound the per-session SSE buffer

The bridge's writable sink is shared by every session, so awaiting one
session's desiredSize would head-of-line-block the rest. Give the SSE
readable a byte-denominated queuing strategy and drop the session when its
budget is exhausted. New maxSessionBufferBytes option, default 1 MiB."
```

---

### Task 10: HTTP client disconnect aborts the server handler

**Files:**
- Modify: `packages/http-serve/src/index.ts` (`onRequestAborted` option, `clearSessionInflight`, `request` disconnect listener, `ServerTransport` wiring)
- Test: `packages/http-serve/test/disconnect-abort.test.ts` (create)

**Interfaces:**
- Consumes: `TransportEvents['requestAborted']` from Task 1; `dropSession` from Task 9.
- Produces: `ServerBridgeOptions.onRequestAborted?: (event: TransportEvents['requestAborted']) => void`. `ServerTransport` forwards it to `this.events.emit('requestAborted', event)`. Task 12 subscribes.

**Background:** only the SSE path listens for `request.signal` abort (line 335). A `request`-type client that disconnects leaves its handler computing until `controllerTimeoutMs`. The bridge cannot synthesize an `abort` *message*, because `requireAuth` servers reject unsigned aborts (server.ts:630-647) and the bridge has no signing identity — hence the transport-level event.

The `request` case holds a deferred `Response` (line 280). The disconnect listener must resolve it, or the promise leaks.

- [ ] **Step 1: Write the failing test**

Create `packages/http-serve/test/disconnect-abort.test.ts`:

```ts
import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { createServerBridge, ServerTransport } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function createRequestPost(rid: string, signal: AbortSignal): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { typ: 'request', rid, prc: 'test/request' } }),
    signal,
  })
}

function createStreamPost(rid: string): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { typ: 'stream', rid, prc: 'test/stream' } }),
  })
}

describe('client disconnect', () => {
  test('emits requestAborted when a request client disconnects', async () => {
    const onRequestAborted = vi.fn()
    const bridge = createServerBridge({ onRequestAborted })
    const abort = new AbortController()

    const pending = bridge.handleRequest(createRequestPost('r1', abort.signal))
    await new Promise((resolve) => setTimeout(resolve, 10))

    abort.abort()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(onRequestAborted).toHaveBeenCalledWith({ rid: 'r1', reason: 'ClientDisconnected' })

    // The deferred Response must settle rather than leak.
    const res = await pending
    expect(res.status).toBe(499)
  })

  test('emits requestAborted for every rid in a dropped session', async () => {
    const onRequestAborted = vi.fn()
    const bridge = createServerBridge({ maxSessionBufferBytes: 256, onRequestAborted })

    const res = await bridge.handleRequest(createStreamPost('r1'))
    expect(res.status).toBe(200)

    const writer = bridge.stream.writable.getWriter()
    const big = 'x'.repeat(200)
    for (let i = 0; i < 5; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: big } } as never)
    }
    writer.releaseLock()

    expect(onRequestAborted).toHaveBeenCalledWith(
      expect.objectContaining({ rid: 'r1' }),
    )
  })

  test('ServerTransport re-emits requestAborted on its events emitter', async () => {
    const transport = new ServerTransport<Protocol>()
    const listener = vi.fn()
    transport.events.on('requestAborted', listener)

    const abort = new AbortController()
    void transport.fetch(createRequestPost('r1', abort.signal))
    await new Promise((resolve) => setTimeout(resolve, 10))

    abort.abort()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(listener).toHaveBeenCalledWith({ rid: 'r1', reason: 'ClientDisconnected' })

    await transport.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/http-serve exec vitest run test/disconnect-abort.test.ts`
Expected: FAIL — `onRequestAborted` is not a valid option (TypeScript error).

- [ ] **Step 3: Emit `requestAborted`**

In `packages/http-serve/src/index.ts`, import the event type by widening the existing `@enkaku/transport` import (line 15):

```ts
import { Transport, type TransportEvents } from '@enkaku/transport'
```

Add to `ServerBridgeOptions`:

```ts
  onRequestAborted?: (event: TransportEvents['requestAborted']) => void
```

Replace `clearSessionInflight` (lines 124-130) so dropped rids are announced:

```ts
  function clearSessionInflight(sessionID: string, reason: unknown = 'SessionClosed'): void {
    for (const [rid, entry] of inflight) {
      if (entry.type === 'stream' && entry.sessionID === sessionID) {
        inflight.delete(rid)
        options.onRequestAborted?.({ rid, reason })
      }
    }
  }
```

In the `case 'request':` block, after `inflightTimers.set(rid, timer)` (line 300) and before `controller.enqueue(message)`, add the disconnect listener:

```ts
          request.signal.addEventListener(
            'abort',
            () => {
              const entry = inflight.get(rid)
              if (entry == null || entry.type !== 'request') {
                // Already answered — nothing in flight to abort.
                return
              }
              const pendingTimer = inflightTimers.get(rid)
              if (pendingTimer != null) {
                clearTimeout(pendingTimer)
                inflightTimers.delete(rid)
              }
              inflight.delete(rid)
              // The client is gone, but the deferred Response must still settle
              // or its promise leaks.
              entry.resolve(new Response(null, { status: 499 }))
              options.onRequestAborted?.({ rid, reason: 'ClientDisconnected' })
            },
            { once: true },
          )
```

In the SSE `request.signal` listener (added in Task 9), pass a reason through:

```ts
          request.signal.addEventListener('abort', () => {
            try {
              controllerRef.close()
            } catch {}
            sessions.delete(sessionID)
            clearSessionInflight(sessionID, 'ClientDisconnected')
          })
```

Finally, wire it in `ServerTransport`'s `createServerBridge` call:

```ts
      onRequestAborted: (event) => {
        this.events.emit('requestAborted', event)
      },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/http-serve exec vitest run test/disconnect-abort.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter @enkaku/http-serve exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/http-serve/src/index.ts packages/http-serve/test/disconnect-abort.test.ts
git commit -m "feat(http-serve): emit requestAborted when an HTTP client goes away

A disconnected request client left its handler computing until
controllerTimeoutMs. The bridge cannot sign a synthetic abort message, so
it emits a transport-level requestAborted event instead — trusted because
it cannot arrive over the wire. Session teardown announces each dropped rid."
```

---

### Task 11: http-fetch surfaces failed event writes

**Files:**
- Modify: `packages/http-fetch/src/index.ts` (`TransportStream` type, `sendClientMessage`, new `send` function, `ClientTransport`)
- Test: `packages/http-fetch/test/event-write-failure.test.ts` (create)

**Interfaces:**
- Consumes: `safeWrite`'s rid-less rethrow from Task 4.
- Produces: `TransportStream<Protocol>` gains `send: (msg: AnyClientMessageOf<Protocol>) => Promise<void>`. `ClientTransport` overrides `write` to call it.

**Background:** two layers swallow the failure. `sendClientMessage` returns early on `!res.ok` when the message has no rid (http-fetch/src/index.ts:245-266 only handles the rid case). The writable sink catches everything and calls `controller.error(...)` **without rethrowing** (lines 315-317), so the sink resolves and `transport.write()` reports success.

**Why the obvious fix does not work.** Making the sink rethrow does surface the failure — and permanently errors the WritableStream. `Transport.write` is `(await this._getWriter()).write(value)` (transport/src/index.ts:123-126), and per the Streams spec a rejected `UnderlyingSink.write` transitions the stream to `errored`, so *every subsequent* `transport.write()` rejects with the same error. A single 500 on one fire-and-forget event would kill the connection for good. There is no "reject just this write" primitive on `WritableStream`.

So the rejection has to travel outside the stream. Extract the sink body into a standalone `send(msg)`, expose it on the returned `TransportStream`, and have `ClientTransport` override `write` to call `send` directly. The writable is then only used for `dispose()`'s `writer.close()`, which still runs the close callback and aborts the in-flight SSE fetch.

`send` classifies its failures the same way the sink used to, minus the swallowing: a `ResponseError` means the server answered and the connection is alive, so it rejects the one message and leaves the readable intact; anything else is a genuine transport failure, so it errors the readable *and* rejects.

- [ ] **Step 1: Write the failing test**

Create `packages/http-fetch/test/event-write-failure.test.ts`:

```ts
import type { AnyClientMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { ClientTransport } from '../src/index.js'

const protocol = {
  'test/event': { type: 'event' },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('http-fetch event write failures', () => {
  test('rejects the write when the server returns a non-2xx for a rid-less message', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }))
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    await expect(
      transport.write({ payload: { typ: 'event', prc: 'test/event' } } as unknown as AnyClientMessageOf<Protocol>),
    ).rejects.toThrow()

    await transport.dispose()
  })

  test('a failed event does not tear down the transport', async () => {
    let calls = 0
    const fetchFn = vi.fn(async () => {
      calls += 1
      return calls === 1 ? new Response('nope', { status: 500 }) : new Response(null, { status: 204 })
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    await expect(
      transport.write({ payload: { typ: 'event', prc: 'test/event' } } as unknown as AnyClientMessageOf<Protocol>),
    ).rejects.toThrow()

    // The readable was not errored: a second event goes through.
    await expect(
      transport.write({ payload: { typ: 'event', prc: 'test/event' } } as unknown as AnyClientMessageOf<Protocol>),
    ).resolves.toBeUndefined()

    await transport.dispose()
  })

  test('a network failure still errors the readable', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    await expect(
      transport.write({ payload: { typ: 'event', prc: 'test/event' } } as unknown as AnyClientMessageOf<Protocol>),
    ).rejects.toThrow()

    await expect(transport.read()).rejects.toThrow(/Transport write failed/)

    await transport.dispose()
  })
})
```

`ClientTransport` with `{ url, fetch }` is confirmed against `packages/http-fetch/src/index.ts:328-342`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/http-fetch exec vitest run test/event-write-failure.test.ts`
Expected: FAIL — the first two tests resolve instead of rejecting.

- [ ] **Step 3: Throw for rid-less non-2xx, and route writes around the sink**

In `packages/http-fetch/src/index.ts`, first widen `TransportStream` (lines 64-67):

```ts
export type TransportStream<Protocol extends ProtocolDefinition> = ReadableWritablePair<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> & {
  controller: ReadableStreamDefaultController<AnyServerMessageOf<Protocol>>
  /**
   * Send a single client message, rejecting if it could not be delivered.
   * `ClientTransport.write` calls this instead of writing to `writable`,
   * because a rejecting WritableStream sink errors its stream permanently.
   */
  send: (msg: AnyClientMessageOf<Protocol>) => Promise<void>
}
```

Replace the `!res.ok` block in `sendClientMessage` (lines 245-266):

```ts
    const res = await sendMessage(msg, headers)
    if (!res.ok) {
      const rid = (msg.payload as { rid?: string }).rid
      if (rid == null) {
        // No controller to route the failure to — the send itself must reject,
        // or the caller (client.sendEvent) sees a silent success.
        throw new ResponseError(res)
      }
      // Reject only this call: enqueue a synthetic error reply for its rid.
      // Session-level failures keep using controller.error elsewhere.
      try {
        controller.enqueue({
          payload: {
            typ: 'error',
            rid,
            code: 'EK_HTTP_REQUEST_FAILED',
            msg: `Transport request failed with status ${res.status} (${res.statusText})`,
            data: { status: res.status },
          },
        } as unknown as AnyServerMessageOf<Protocol>)
      } catch {
        // Readable already closed or errored (e.g. a concurrent SSE disconnect) —
        // there is no longer anywhere to deliver the per-rid error
      }
      return
    }
```

Now turn the sink callback (lines 287-323) into a named `send`, and build the writable from it:

```ts
  async function send(msg: AnyClientMessageOf<Protocol>): Promise<void> {
    try {
      if (msg.payload.typ === 'channel' || msg.payload.typ === 'stream') {
        if (sessionState.status === 'idle') {
          // First stream/channel message — connect SSE session
          const promise = connectSSESession(msg)
          sessionState = { status: 'connecting', promise }
          promise
            .then((sessionID) => {
              if (sessionState.status === 'connecting') {
                sessionState = { status: 'connected', sessionID }
              }
            })
            .catch((cause) => {
              const error = new Error('Failed to connect SSE session', { cause })
              sessionState = { status: 'error', error }
              controller.error(error)
            })
          await promise
        } else {
          // Subsequent stream/channel messages — wait for session and send with ID
          const sessionID = await getSessionID()
          await sendClientMessage(msg, sessionID)
        }
      } else {
        await sendClientMessage(msg)
      }
    } catch (cause) {
      if (cause instanceof ResponseError) {
        // The server answered and the connection is alive. Fail this message
        // alone: erroring the readable would tear the whole transport down.
        throw cause
      }
      const error = new Error('Transport write failed', { cause })
      // Already-errored controllers ignore this, so the double call on the
      // SSE-connect path above is harmless.
      controller.error(error)
      throw error
    }
  }

  const writable = writeTo<AnyClientMessageOf<Protocol>>(
    send,
    // The transport will call this method when disposing
    async () => {
      abortController.abort()
    },
  )

  return { controller, readable, writable, send }
```

Finally, override `write` on `ClientTransport` (lines 335-342):

```ts
export class ClientTransport<Protocol extends ProtocolDefinition> extends Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  #send: (msg: AnyClientMessageOf<Protocol>) => Promise<void>

  constructor(params: ClientTransportParams) {
    const stream = createTransportStream<Protocol>(params)
    super({ stream })
    this.#send = stream.send
    // Materialise the stream so dispose() closes the writable — and so aborts
    // the in-flight SSE fetch — even if nothing ever reads from this transport.
    void this._getStream()
  }

  /**
   * Bypass the WritableStream sink. A sink that rejects errors its stream
   * permanently, so routing a failed message through it would let one rejected
   * event kill every later write.
   */
  override write(value: AnyClientMessageOf<Protocol>): Promise<void> {
    return this.#send(value)
  }
}
```

`getWritable()` on the base class is `writeTo((value) => this.write(value))`, so it picks up the override for free.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/http-fetch exec vitest run test/event-write-failure.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter @enkaku/http-fetch exec vitest run`
Expected: PASS. `test/lib.test.ts` may assert that a failed write resolves — if so, that test asserted the bug; update it to expect a rejection and say so in the commit body.

- [ ] **Step 5: Commit**

```bash
git add packages/http-fetch/src/index.ts packages/http-fetch/test/event-write-failure.test.ts
git commit -m "fix(http-fetch): surface non-2xx responses for rid-less messages

Two layers swallowed the failure: sendClientMessage returned early when the
message had no rid, and the writable sink called controller.error() without
rethrowing.

Rethrowing from the sink is not enough on its own — a rejected sink write
errors the WritableStream permanently, so one bad event would kill every
later write. Expose the send function on the transport stream and have
ClientTransport.write call it directly, so a ResponseError rejects that one
message and leaves both the readable and the connection intact."
```

---

# Phase 3 — server

### Task 12: Server aborts handlers on `requestAborted`

**Files:**
- Modify: `packages/server/src/server.ts` (new `abortRunningHandler` helper, `abort` case, `requestAborted` subscription, disposer cleanup)
- Test: `packages/server/test/request-aborted.test.ts` (create)

**Interfaces:**
- Consumes: `TransportEvents['requestAborted']` from Task 1.
- Produces: internal `abortRunningHandler(rid: string, reason: unknown): void`.

**Background and correction to the spec:** the spec claimed three call sites share abort bookkeeping. They do not. The timeout sweep (server.ts:137-152) calls `limiter.removeController`, `limiter.releaseHandler()`, `delete controllers[rid]`, `delete running[rid]`. The `abort`-message case (server.ts:703-707) deliberately does none of that, leaving it to `processHandler`'s completion handler (server.ts:284-298), which is guarded by `running[rid] === returned`. Sharing one helper across both would double-release the limiter.

`requestAborted` must behave exactly like a client-sent `abort` message. So the helper covers **two** sites and does only `controller.abort(reason)` + `events.emit('handlerAbort', …)`. The timeout sweep is untouched.

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/request-aborted.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken } from '@kokuin/token'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('transport requestAborted', () => {
  test('aborts the running handler for the rid', async () => {
    let handlerSignal: AbortSignal | undefined
    const handler = vi.fn(async (ctx: { signal: AbortSignal }) => {
      handlerSignal = ctx.signal
      await new Promise((resolve) => setTimeout(resolve, 5000))
      return 'never'
    })
    const handlers = { 'test/request': handler } as unknown as ProcedureHandlers<Protocol>

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
      createUnsignedToken({
        typ: 'request',
        prc: 'test/request',
        rid: 'r1',
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(handlerSignal?.aborted).toBe(false)

    await transports.server.events.emit('requestAborted', {
      rid: 'r1',
      reason: 'ClientDisconnected',
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(handlerSignal?.aborted).toBe(true)

    await server.dispose()
    await transports.dispose()
  })

  test('emits handlerAbort with the reason', async () => {
    const handler = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000))
      return 'never'
    })
    const handlers = { 'test/request': handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const aborted = vi.fn()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers,
      transport: transports.server,
    })
    server.events.on('handlerAbort', aborted)

    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        prc: 'test/request',
        rid: 'r1',
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    await transports.server.events.emit('requestAborted', {
      rid: 'r1',
      reason: 'ClientDisconnected',
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(aborted).toHaveBeenCalledWith({ rid: 'r1', reason: 'ClientDisconnected' })

    await server.dispose()
    await transports.dispose()
  })

  test('an unknown rid is ignored', async () => {
    const handlers = {
      'test/request': vi.fn(async () => 'ok'),
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

    await expect(
      transports.server.events.emit('requestAborted', { rid: 'nope' }),
    ).resolves.toBeUndefined()

    await server.dispose()
    await transports.dispose()
  })
})
```

Both shapes used here are confirmed against source: `serve()` returns a `Server` (extends `Disposer`) with a `get events()` accessor (`packages/server/src/server.ts:856,978`), and `{ requireAuth: false }` without an `identity` is a valid `ServerAccessOptions` branch (server.ts:826-828).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server exec vitest run test/request-aborted.test.ts`
Expected: FAIL — the handler's signal is never aborted and `handlerAbort` is never emitted.

- [ ] **Step 3: Extract the helper and subscribe**

In `packages/server/src/server.ts`, add `abortRunningHandler` just after `rejectReplay` (after line 130):

```ts
  /**
   * Abort a running handler without touching limiter bookkeeping: the handler's
   * own completion path in `processHandler` releases its controller and slot,
   * guarded by `running[rid] === returned`. Doing it here as well would release
   * twice. (The timeout sweep is different — there the handler is abandoned, so
   * it does the bookkeeping itself.)
   */
  function abortRunningHandler(rid: string, reason: unknown): void {
    const controller = controllers[rid]
    if (controller == null) {
      return
    }
    controller.abort(reason)
    events.emit('handlerAbort', { rid, reason })
  }
```

Subscribe to the transport event immediately below that definition, so the handler is declared before it is referenced:

```ts
  // Trusted: TransportEvents is an in-process emitter, so `requestAborted` can
  // only come from the transport implementation, never from the wire.
  const unsubscribeRequestAborted = transport.events.on('requestAborted', ({ rid, reason }) => {
    abortRunningHandler(rid, reason)
  })
```

Call it in the disposer (inside the existing `dispose` at line 162, as the first statement after `clearInterval(cleanupInterval)`):

```ts
      clearInterval(cleanupInterval)
      unsubscribeRequestAborted()
```

Finally, make the `abort` message case use the helper. Replace lines 703-707:

```ts
          abortRunningHandler(msg.payload.rid, msg.payload.rsn)
          break
```

Note the `const controller = controllers[msg.payload.rid]` binding at line 682 is still needed above it for the issuer check, so leave that in place. The `if (controller == null) break` guard at 683-685 also stays — it short-circuits before the issuer check.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/server exec vitest run test/request-aborted.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter @enkaku/server exec vitest run`
Expected: PASS. Pay attention to `test/controller-timeout.test.ts`, `test/resource-limits.test.ts`, and `test/limits.test.ts` — a double-release would show up there as an exhausted handler pool.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/request-aborted.test.ts
git commit -m "feat(server): abort handlers on the transport requestAborted event

Lets a transport report that a request's peer went away — an HTTP client
disconnecting, an SSE session dropped — without forging a wire message that
requireAuth would reject as unsigned."
```

---

### Task 13: Close the auth-mode channel-open / send ordering race

**Files:**
- Modify: `packages/server/src/server.ts` (new `pending` map and `track` helper; `channel`/`stream`/`request` cases; `send`/`abort` cases)
- Test: `packages/server/test/auth-ordering.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: internal `pending: Record<string, Promise<void>>` and `track(rid: string, result: void | Promise<void>): void`.

**Background:** `process` is synchronous when `requireAuth` is false (server.ts:466-486) and async when it is true (server.ts:487+). The `channel`, `stream`, and `request` cases call it **un-awaited** (lines 712, 722, 808). The `send` and `abort` cases `await verifyToken(...)` inline and then look up `controllers[rid]`. So a `send` arriving right behind its channel open can reach the lookup before `handleChannel` has registered the controller, and is dropped as "unknown channel".

Non-auth mode has no race: `handleChannel` registers `ctx.controllers[rid]` synchronously before any await (`packages/server/src/handlers/channel.ts:64`), so `process` → `processHandler` → `handle()` completes registration before `handleNext()` recurses.

The test lever is an async `allow` predicate. `checkProcedureAccess` awaits it (`packages/server/src/access-control.ts:120`), and that path runs **only** inside `process` — never in the `send`/`abort` cases. So a predicate that blocks on a deferred stalls the channel open while letting the `send` race ahead. Deterministic, no timers.

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/auth-ordering.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { defer } from '@sozai/async'
import { randomIdentity } from '@kokuin/token'
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

describe('auth-mode message ordering', () => {
  test('a send arriving behind its channel open is not dropped', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const receivedValues: Array<unknown> = []
    // ctx.readable is a ReadableStream (server/src/types.ts:98), so read it with
    // a reader rather than for-await — the DOM lib type has no asyncIterator.
    const handler = vi.fn(async (ctx: { readable: ReadableStream<unknown> }) => {
      const reader = ctx.readable.getReader()
      while (true) {
        const next = await reader.read()
        if (next.done) {
          break
        }
        receivedValues.push(next.value)
      }
      return 'done'
    })
    const handlers = { chat: handler } as unknown as ProcedureHandlers<Protocol>

    // Blocks the channel's access check — and only the channel's, because the
    // send/abort paths never reach checkProcedureAccess.
    const gate = defer<void>()
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
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

    const channelMsg = await clientSigner.signToken({
      typ: 'channel',
      prc: 'chat',
      rid: 'c1',
      aud: serverSigner.id,
    } as const)
    const sendMsg = await clientSigner.signToken({
      typ: 'send',
      prc: 'chat',
      rid: 'c1',
      val: 'hello',
      aud: serverSigner.id,
    } as const)

    await transports.client.write(channelMsg as unknown as AnyClientMessageOf<Protocol>)
    await transports.client.write(sendMsg as unknown as AnyClientMessageOf<Protocol>)

    // The send has raced ahead while the channel is stuck in its access check.
    await new Promise((resolve) => setTimeout(resolve, 20))
    gate.resolve()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(receivedValues).toEqual(['hello'])

    await server.dispose()
    await transports.dispose()
  })

  test('a send for a channel whose auth failed is still dropped', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const receivedValues: Array<unknown> = []
    // ctx.readable is a ReadableStream (server/src/types.ts:98), so read it with
    // a reader rather than for-await — the DOM lib type has no asyncIterator.
    const handler = vi.fn(async (ctx: { readable: ReadableStream<unknown> }) => {
      const reader = ctx.readable.getReader()
      while (true) {
        const next = await reader.read()
        if (next.done) {
          break
        }
        receivedValues.push(next.value)
      }
      return 'done'
    })
    const handlers = { chat: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { '*': { allow: async () => false } },
      transport: transports.server,
    })

    const channelMsg = await clientSigner.signToken({
      typ: 'channel',
      prc: 'chat',
      rid: 'c1',
      aud: serverSigner.id,
    } as const)
    const sendMsg = await clientSigner.signToken({
      typ: 'send',
      prc: 'chat',
      rid: 'c1',
      val: 'hello',
      aud: serverSigner.id,
    } as const)

    await transports.client.write(channelMsg as unknown as AnyClientMessageOf<Protocol>)
    await transports.client.write(sendMsg as unknown as AnyClientMessageOf<Protocol>)
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(receivedValues).toEqual([])
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('distinct rids still verify concurrently', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    let concurrent = 0
    let maxConcurrent = 0
    const gate = defer<void>()

    const handlers = {
      chat: vi.fn(async () => 'done'),
    } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: {
        '*': {
          allow: async () => {
            concurrent += 1
            maxConcurrent = Math.max(maxConcurrent, concurrent)
            await gate.promise
            concurrent -= 1
            return true
          },
        },
      },
      transport: transports.server,
    })

    for (const rid of ['c1', 'c2', 'c3']) {
      const msg = await clientSigner.signToken({
        typ: 'channel',
        prc: 'chat',
        rid,
        aud: serverSigner.id,
      } as const)
      await transports.client.write(msg as unknown as AnyClientMessageOf<Protocol>)
    }

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(maxConcurrent).toBeGreaterThan(1)
    gate.resolve()

    await server.dispose()
    await transports.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/server exec vitest run test/auth-ordering.test.ts`
Expected: the first test FAILS with `expected [] to deeply equal [ 'hello' ]` — the send was dropped. The second and third should already PASS; they are the regression guards for the fix.

- [ ] **Step 3: Add the pending map**

In `packages/server/src/server.ts`, add the map and helper next to `running` (after line 117):

```ts
  const running: Record<string, Promise<void>> = Object.create(null)
  /**
   * Per-rid barrier for the auth-mode `process`, which is async and therefore
   * un-awaited by the `handleNext` switch. `send` and `abort` await the entry
   * for their rid before looking up its controller, so a message arriving right
   * behind the call that creates the controller cannot overtake it. Distinct
   * rids never wait on each other.
   */
  const pending: Record<string, Promise<void>> = Object.create(null)

  function track(rid: string, result: void | Promise<void>): void {
    if (!(result instanceof Promise)) {
      // Non-auth mode: `process` is synchronous and the controller is already
      // registered by the time it returns.
      return
    }
    // Failures are surfaced by `process` itself; this barrier only cares that
    // the attempt has finished.
    const tracked = result.then(
      () => {},
      () => {},
    )
    pending[rid] = tracked
    void tracked.then(() => {
      if (pending[rid] === tracked) {
        delete pending[rid]
      }
    })
  }
```

Replace the three un-awaited `process(...)` calls. The `channel` case (lines 710-714):

```ts
        case 'channel': {
          const message = msg as ChannelMessageOf<Protocol>
          track(
            message.payload.rid,
            process(message, () => handleChannel(context, message)),
          )
          break
        }
```

The `request` case (lines 720-724):

```ts
        case 'request': {
          const message = msg as unknown as RequestMessageOf<Protocol>
          track(
            message.payload.rid,
            process(message, () => handleRequest(context, message)),
          )
          break
        }
```

The `stream` case (lines 806-810):

```ts
        case 'stream': {
          const message = msg as unknown as StreamMessageOf<Protocol>
          track(
            message.payload.rid,
            process(message, () => handleStream(context, message)),
          )
          break
        }
```

The `event` case (lines 715-719) keeps calling `process` directly — events have no rid and nothing awaits them.

Now make `send` and `abort` wait. In the `abort` case, insert immediately before `const controller = controllers[msg.payload.rid]` (line 682):

```ts
          // Wait for any in-flight auth for this rid so the controller it will
          // register is visible. Placed after this message's own signature and
          // replay checks, so a forged abort cannot make the server wait.
          await pending[msg.payload.rid]
          const controller = controllers[msg.payload.rid]
```

In the `send` case, insert immediately before `const controller = controllers[msg.payload.rid] as ChannelController | undefined` (line 775):

```ts
          // Wait for any in-flight auth for this rid so the channel it will
          // register is visible. Placed after this message's own signature and
          // replay checks, so a forged send cannot make the server wait.
          await pending[msg.payload.rid]
          const controller = controllers[msg.payload.rid] as ChannelController | undefined
```

`await undefined` is a no-op, so both are safe when nothing is pending — which is always the case in non-auth mode.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/server exec vitest run test/auth-ordering.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter @enkaku/server exec vitest run`
Expected: PASS. `test/channel-send-auth.test.ts` and `test/replay-server.test.ts` exercise the `send` path most heavily.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/auth-ordering.test.ts
git commit -m "fix(server): close the auth-mode channel-open / send ordering race

In requireAuth mode process() is async but the channel/stream/request cases
called it un-awaited, so a send arriving right behind its channel open could
reach the controller lookup first and be dropped. A per-rid pending barrier
orders them without serialising verification across distinct rids."
```

---

### Task 14: Changesets, docs, and full verification

**Files:**
- Create: `.changeset/transport-lifecycle-hardening.md`
- Delete: `docs/agents/plans/next/2026-07-07-client-transport-lifecycle-hardening.md`

**Interfaces:**
- Consumes: every preceding task.
- Produces: nothing.

- [ ] **Step 1: Write the changeset**

Create `.changeset/transport-lifecycle-hardening.md`:

```markdown
---
'@enkaku/transport': minor
'@enkaku/client': minor
'@enkaku/socket': minor
'@enkaku/http-serve': minor
'@enkaku/http-fetch': minor
'@enkaku/server': minor
---

Client and transport lifecycle hardening.

Fixes:

- The client read loop no longer dies on a malformed server message. `#controllers` and `#spans` are null-prototype maps, so a message with `rid: "__proto__"` cannot resolve to `Object.prototype`, and message dispatch is guarded so no throw can kill the loop.
- A graceful remote close now disposes the transport, so in-flight requests are aborted and `handleTransportDisposed` runs instead of every request hanging forever.
- The socket transport keeps a permanent `'error'` listener, so a write on a destroyed socket rejects rather than escalating to an uncaught exception.
- `http-serve` refreshes a session's `lastAccess` on outbound SSE writes, so a passive stream consumer is no longer cut off at `sessionTimeoutMs`.
- `http-serve` rejects a duplicate in-flight request ID with `409` instead of overwriting the first caller's entry.
- An HTTP client that disconnects now aborts its server handler, via the new `requestAborted` transport event.
- In `requireAuth` mode, a channel `send` arriving immediately behind its channel open is no longer dropped.

New options:

- `@enkaku/socket`: `highWaterMark` (default 1 MiB) bounds read and write buffering.
- `@enkaku/http-serve`: `maxSessionBufferBytes` (default 1 MiB) bounds each SSE session's queue; a session that exceeds it is dropped.

Behavior changes:

- `client.sendEvent()` now rejects when the transport write fails for a non-teardown reason. It previously resolved as if the event had been delivered. Over `@enkaku/http-fetch`, a non-2xx response to an event rejects that call alone and leaves the transport usable.
- `http-serve` returns `409` for a duplicate in-flight request ID.
- An `http-serve` SSE session whose buffer overflows is closed rather than growing without bound.

New public API:

- `TransportEvents` gains `requestAborted: { rid: string; reason?: unknown }`.
- `createServerBridge` gains `onRequestAborted`.
- `@enkaku/http-fetch`: `TransportStream` gains `send`, and `ClientTransport.write` uses it rather than the writable's sink.
```

- [ ] **Step 2: Run the full test suite**

Run: `rtk proxy pnpm run test`
Expected: PASS — type checks and unit tests across all packages.

If anything fails, fix it before continuing. Do not proceed on a red suite.

- [ ] **Step 3: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors. (Bare `pnpm run lint` is intercepted by an `rtk` shim and runs the wrong tool.)

- [ ] **Step 4: Remove the consumed backlog item**

The `next/` item is now implemented, and `kigu:dev-loop` says a backlog item is deleted once it has produced a spec.

```bash
git rm docs/agents/plans/next/2026-07-07-client-transport-lifecycle-hardening.md
```

- [ ] **Step 5: Commit**

```bash
git add .changeset/transport-lifecycle-hardening.md
git commit -m "chore: changeset for transport lifecycle hardening

Removes the next/ backlog item consumed by this work."
```

---

## Verification checklist

Before moving the plan to `reviewing`:

- [ ] `rtk proxy pnpm run test` passes.
- [ ] `rtk proxy pnpm run lint` reports no errors.
- [ ] All nine findings from the spec have a test that fails without its fix.
- [ ] No `sendEvent` caller inside the repo relies on the old resolve-on-failure behavior (`grep -rn "sendEvent" packages/ --include=*.ts`).
- [ ] The `@enkaku/electron`, `@enkaku/node-streams`, `@enkaku/message`, and `@enkaku/standalone` packages still build — they consume `TransportEvents` and `Transport`.
- [ ] Every caller of http-fetch's `createTransportStream` handles the added `send` field (`grep -rn "createTransportStream" packages/ tests/ --include=*.ts`). The field is additive, so this is a check rather than a migration.
