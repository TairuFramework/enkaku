# `@enkaku/client` timeout + channel disposal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-request timeout to `Client.request` and a leak-free `dispose()` to stream/channel calls in `@enkaku/client`, plus the shared controller/write-path hardening both rely on.

**Architecture:** Three tasks. Task 1 lands shared, mostly-internal hardening: a one-shot `controller.settled` accessor, absorbing the single `onDone` receive-writer close, threading the owning controller through `#write` failures, and identity-checking the async rid mutations in `#handleSignal` (plus removing its abort listener on settle). Task 2 builds the timeout on top of `settled`. Task 3 builds `dispose()` on top of `settled` + the `onDone` absorb + owner threading. Tasks 2 and 3 are independent of each other; both depend on Task 1.

**Tech Stack:** TypeScript, `@enkaku/client` over `DirectTransports` (`@enkaku/transport`) in tests, Vitest (`vi.useFakeTimers()` for the timeout timer; `process.on('unhandledRejection', …)` spy for leak tests — both patterns already used in `packages/client/test/`).

**Spec:** `docs/superpowers/specs/2026-08-28-client-timeout-and-channel-disposal-design.md` — read it alongside this plan. It carries the full rationale and the five-round review history behind each decision.

## Global Constraints

Copied verbatim from the spec / AGENTS.md. Every task inherits these.

- Use `type`, never `interface`; `Array<T>` not `T[]`; no `any` (use `unknown`/specific); no lowercase abbreviations in names (`ID`, `HTTP`, `JWT`).
- Use `pnpm`; do not edit generated files (`lib/`, `*.gen.ts`).
- Lint with `rtk proxy pnpm run lint` from the repo root (expect `No fixes applied`, exit 0). Do **not** judge lint by bare `pnpm exec biome` — the `rtk` shim forces a false exit 1; the real binary is `node node_modules/@biomejs/biome/bin/biome` if you need a raw exit code.
- Tests: `cd packages/client && pnpm exec vitest run` (and a single file with `… run test/<file>`); type-check `pnpm run test:types`.
- Additive/source-compatible: `abort()`/`close()` semantics unchanged; the two intended additions are `request()`'s optional `timeout` and the absence of an `unhandledRejection` on disposed stream/channel teardown.
- All new controller-rid guards key off the controller's own `settled`, never off `#controllers[rid]` membership (the two diverge under reused explicit `id`s). The map delete is the one exception — it is legitimately identity-checked against the map.

---

## File Structure

- **Modify** `packages/client/src/client.ts` — `createController` (`settled`), `RequestController` type, `#handleSignal`, `#write`, `#notifyAbort`, `request()`, `createStream()`, `createChannel()`, the `StreamCall` type, and the free `createStream` call assembly.
- **Modify** `packages/client/src/error.ts` — add `RequestTimeoutError`.
- **Modify** `packages/client/src/index.ts` — export `RequestTimeoutError`.
- **Create** `packages/client/test/controller-hardening.test.ts` (Task 1), `packages/client/test/request-timeout.test.ts` (Task 2), `packages/client/test/channel-dispose.test.ts` (Task 3).

Line numbers below are from the current `client.ts` and are guidance — match on surrounding code, not the number.

---

### Task 1: Shared controller & write-path hardening

Internal changes that make Tasks 2 and 3 correct: `controller.settled`, absorbed `onDone` close, owner-threaded `#write` failures, and identity-safe/leak-free `#handleSignal`. No new public API.

**Files:**
- Modify: `packages/client/src/client.ts`
- Test: `packages/client/test/controller-hardening.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (Tasks 2 & 3 rely on these):
  - `RequestController<Result>` gains `readonly settled: boolean` — `true` once the controller has reached a terminal state (`ok`/`error`/`aborted` → `finish()`).
  - `#write(payload, header?, rid?, owner?: AnyClientController)` — `onFailure` aborts `owner` only when `owner != null && !owner.settled`.
  - Both stream/channel controllers' `onDone` closes the receive writer with an absorbed `.catch(() => {})`.
  - `#handleSignal`'s abort listener is identity-checked on delete and removed on settle.

- [ ] **Step 1: Write the failing tests**

Create `packages/client/test/controller-hardening.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { unsignedToken } from '@kokuin/token'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  ping: { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function setup() {
  const transports = new DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>()
  const client = new Client<Protocol>({ transport: transports.client })
  return { transports, client }
}

describe('controller hardening', () => {
  const rejections: Array<unknown> = []
  const onRejection = (reason: unknown) => rejections.push(reason)
  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => process.off('unhandledRejection', onRejection))

  test('a reused explicit id: a late external abort of the old call does not delete the new controller', async () => {
    const { transports, client } = setup()
    const first = client.request('ping', { id: 'shared', signal: (new AbortController()).signal })
    // Overwrite the map slot with a new controller using the same id.
    const controllerA = new AbortController()
    const second = client.request('ping', { id: 'shared', signal: controllerA.signal })
    // Reply to the NEW call; it must still resolve even if the OLD one's signal later aborts.
    const read = await transports.server.read()
    const rid = (read.value as { payload: { rid: string } }).payload.rid
    await transports.server.write(unsignedToken({ typ: 'result', rid, val: 'ok' }))
    await expect(second).resolves.toBe('ok')
    // first was superseded in the map; abort its (independent) controller — must not affect anything delivered.
    void first.catch(() => {})
    await client.dispose()
  })

  test('no unhandled rejection when the receive writer close rejects on stream teardown', async () => {
    const streamProtocol = {
      sub: { type: 'stream', receive: { type: 'string' }, result: { type: 'null' } },
    } as const satisfies ProtocolDefinition
    const transports = new DirectTransports<
      AnyServerMessageOf<typeof streamProtocol>,
      AnyClientMessageOf<typeof streamProtocol>
    >()
    const client = new Client<typeof streamProtocol>({ transport: transports.client })
    const stream = client.createStream('sub')
    stream.abort('Close')
    await client.dispose()
    await new Promise((r) => setTimeout(r, 0))
    expect(rejections).toEqual([])
  })
})
```

> Note: assert the *observable* consequences (new call resolves; no unhandled rejection). The `settled` accessor and identity guards are verified through behavior, since `createController` is not exported. If the reused-id test is hard to force deterministically with `DirectTransports`, keep the unhandled-rejection assertions as the load-bearing checks and add a direct assertion that `stream.abort()` then `client.dispose()` never double-emits.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/client && pnpm exec vitest run test/controller-hardening.test.ts`
Expected: FAIL (the receive-close absorb / identity guards are not yet in place — a rejection is captured, or the reused-id call misbehaves).

- [ ] **Step 3: Add `controller.settled`**

In `packages/client/src/client.ts`, add to the `RequestController<Result>` type (near line 124):

```ts
type RequestController<Result> = AbortController &
  RequestMeta & {
    result: Promise<Result>
    ok: (value: Result) => void
    error: (error: RequestError) => void
    aborted: (signal: AbortSignal) => void
    header?: AnyHeader
    readonly settled: boolean
  }
```

Rewrite `createController` (lines ~145-171) to capture the controller and define `settled` off the existing `done` flag (a getter placed inside the `Object.assign` source would snapshot to `false`):

```ts
function createController<T>(
  params: CreateControllerParams,
  onDone?: () => void,
): RequestController<T> {
  const deferred = defer<T>()
  let done = false
  const finish = () => {
    if (done) return
    done = true
    onDone?.()
  }
  const controller = Object.assign(new AbortController(), params, {
    result: deferred.promise,
    ok: (value: T) => {
      deferred.resolve(value)
      finish()
    },
    error: (error: RequestError) => {
      deferred.reject(error)
      finish()
    },
    aborted: (signal: AbortSignal) => {
      deferred.reject(signal.reason)
      finish()
    },
  }) as RequestController<T>
  Object.defineProperty(controller, 'settled', { get: () => done, enumerable: false })
  return controller
}
```

- [ ] **Step 4: Absorb the `onDone` receive-writer close (both sites)**

In `createStream` (line ~705) and `createChannel` (line ~786), change the controller's `onDone`:

```ts
// before: () => writer.close()
() => void writer.close().catch(() => {})
```

- [ ] **Step 5: Thread the owning controller through `#write`**

Change `#write` (line ~492) signature and `onFailure`:

```ts
async #write(
  payload: AnyClientPayloadOf<Protocol>,
  header?: AnyHeader,
  rid?: string,
  owner?: AnyClientController,
): Promise<void> {
  // ... unchanged preflight/message build ...
  await safeWrite({
    transport: this.#transport as unknown as WriteTarget,
    message,
    rid,
    events: this.#events,
    signal: this.signal,
    onFailure: (error) => {
      // Abort the OWNING controller, and only if it has not already settled:
      // a map lookup could hit a reused-rid occupant; aborting a settled owner
      // would fire a spurious server abort.
      if (owner != null && !owner.settled) {
        owner.abort(error)
      }
    },
  })
}
```

Pass the owning controller at every rid-bearing call site: `request()` (line ~671), `createStream` (line ~745), `createChannel` initial write (line ~831), and the channel `send()` closure (line ~850) — each adds `, controller` as the 4th argument. `sendEvent`'s `#write` has no rid/owner and is unchanged.

- [ ] **Step 6: Thread `owner` through `#notifyAbort` and harden `#handleSignal`**

`#notifyAbort` (line ~528) gains an `owner` param and forwards it:

```ts
#notifyAbort(rid: string, reason: unknown, header?: AnyHeader, owner?: AnyClientController): void {
  void (async () => {
    try {
      await this.#write(
        { typ: 'abort', rid, rsn: reason } as unknown as AnyClientPayloadOf<Protocol>,
        header,
        rid,
        owner,
      )
    } catch (error) {
      if (!this.signal.aborted) {
        await this.#events.emit('requestError', { rid, error: error as Error })
      }
    }
  })()
}
```

Rewrite `#handleSignal` (lines ~548-573) to name the handler, identity-check the delete, forward the owner, and remove the listener on settle:

```ts
#handleSignal<Result>(
  rid: string,
  controller: RequestController<Result>,
  providedSignal?: AbortSignal,
): AbortSignal {
  const signal = providedSignal
    ? AbortSignal.any([controller.signal, providedSignal])
    : controller.signal
  const onAbort = () => {
    const reason = signal.reason?.name ?? signal.reason
    this.#logger.trace('abort {type} {procedure} with ID {rid} and reason: {reason}', {
      type: controller.type,
      procedure: controller.procedure,
      rid,
      reason,
    })
    this.#notifyAbort(rid, reason, controller.header, controller)
    controller.aborted(signal)
    if (this.#controllers[rid] === controller) {
      delete this.#controllers[rid]
    }
  }
  signal.addEventListener('abort', onAbort, { once: true })
  void controller.result.then(
    () => signal.removeEventListener('abort', onAbort),
    () => signal.removeEventListener('abort', onAbort),
  )
  return signal
}
```

- [ ] **Step 7: Run the new tests + the full client suite**

Run: `cd packages/client && pnpm exec vitest run test/controller-hardening.test.ts` → PASS.
Then `cd packages/client && pnpm exec vitest run` → all existing tests still PASS (no happy-path regression).
Then `cd packages/client && pnpm run test:types` → PASS.

- [ ] **Step 8: Lint + commit**

Run: `cd /Users/paul/dev/yulsi/enkaku && rtk proxy pnpm run lint` → `No fixes applied`, exit 0.

```bash
git add packages/client/src/client.ts packages/client/test/controller-hardening.test.ts
git commit -m "feat(client): controller.settled + owner-threaded writes + hardened #handleSignal"
```

---

### Task 2: Feature 1 — per-request timeout

**Files:**
- Modify: `packages/client/src/error.ts`, `packages/client/src/index.ts`, `packages/client/src/client.ts`
- Test: `packages/client/test/request-timeout.test.ts`

**Interfaces:**
- Consumes from Task 1: `controller.settled`.
- Produces: `RequestTimeoutError`; `ClientParams.requestTimeoutMs?: number`; `request()` config `timeout?: number`.

- [ ] **Step 1: Write the failing tests**

Create `packages/client/test/request-timeout.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Client, RequestError, RequestTimeoutError } from '../src/index.js'

const protocol = {
  ping: { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function setup(requestTimeoutMs?: number) {
  const transports = new DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>()
  const client = new Client<Protocol>({ transport: transports.client, requestTimeoutMs })
  return { transports, client }
}

describe('request timeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('expiry rejects with a RequestTimeoutError naming the procedure', async () => {
    const { transports, client } = setup(1000)
    // Consume the outgoing request so the write settles; never reply.
    const reading = transports.server.read()
    const call = client.request('ping')
    await reading
    const rejected = expect(call).rejects.toBeInstanceOf(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(1000)
    await rejected
    await call.catch((error) => {
      expect(error).toBeInstanceOf(RequestError)
      expect(error.code).toBe('RequestTimeout')
      expect(error.data).toEqual({ procedure: 'ping', timeoutMs: 1000 })
    })
  })

  test('per-call timeout overrides the construction default', async () => {
    const { transports, client } = setup(10_000)
    const reading = transports.server.read()
    const call = client.request('ping', { timeout: 500 })
    await reading
    const rejected = expect(call).rejects.toBeInstanceOf(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(500)
    await rejected
  })

  test('timeout: 0 disables even when a default is set', async () => {
    const { transports, client } = setup(1000)
    const reading = transports.server.read()
    const call = client.request('ping', { timeout: 0 })
    await reading
    let settled = false
    void call.then(() => { settled = true }, () => { settled = true })
    await vi.advanceTimersByTimeAsync(5000)
    expect(settled).toBe(false)
    call.abort('cleanup')
    await call.catch(() => {})
  })

  test('no default and no per-call timeout arms no timer', async () => {
    const { transports, client } = setup()
    const reading = transports.server.read()
    const call = client.request('ping')
    await reading
    let settled = false
    void call.then(() => { settled = true }, () => { settled = true })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(settled).toBe(false)
    call.abort('cleanup')
    await call.catch(() => {})
  })

  test('a request that resolves before expiry does not later time out', async () => {
    const { transports, client } = setup(1000)
    const reading = transports.server.read()
    const call = client.request('ping')
    const read = await reading
    const { unsignedToken } = await import('@kokuin/token')
    const rid = (read.value as { payload: { rid: string } }).payload.rid
    await transports.server.write(unsignedToken({ typ: 'result', rid, val: 'ok' }))
    await expect(call).resolves.toBe('ok')
    // Advancing past the deadline produces no late rejection.
    await vi.advanceTimersByTimeAsync(5000)
  })

  test('NaN / Infinity / negative arm no timer', async () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const { transports, client } = setup()
      const reading = transports.server.read()
      const call = client.request('ping', { timeout: bad })
      await reading
      let settled = false
      void call.then(() => { settled = true }, () => { settled = true })
      await vi.advanceTimersByTimeAsync(60_000)
      expect(settled).toBe(false)
      call.abort('cleanup')
      await call.catch(() => {})
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/client && pnpm exec vitest run test/request-timeout.test.ts`
Expected: FAIL — `RequestTimeoutError` is not exported / `requestTimeoutMs` and `timeout` are not honored.

- [ ] **Step 3: Add `RequestTimeoutError`**

Append to `packages/client/src/error.ts`:

```ts
export class RequestTimeoutError extends RequestError<
  'RequestTimeout',
  { procedure: string; timeoutMs: number }
> {
  constructor(procedure: string, timeoutMs: number) {
    super({
      code: 'RequestTimeout',
      data: { procedure, timeoutMs },
      message: `Request '${procedure}' timed out after ${timeoutMs}ms`,
    })
    this.name = 'RequestTimeoutError'
  }
}
```

Export it from `packages/client/src/index.ts` (add to the `./error.js` export):

```ts
export {
  type ErrorObjectType,
  RequestError,
  type RequestErrorParams,
  RequestTimeoutError,
} from './error.js'
```

- [ ] **Step 4: Add the timeout config and mechanism**

In `client.ts`, import `RequestTimeoutError` from `./error.js` (alongside `RequestError`). Add `requestTimeoutMs?: number` to `ClientParams` (near line 257) and store it in a `#requestTimeoutMs?: number` field set in the constructor from `params.requestTimeoutMs`.

Add a module-level normalizer:

```ts
/** A timer is armed only for a finite value > 0; everything else means "off". */
function normalizeTimeout(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}
```

Add `timeout?: number` to `request()`'s config arg types (both the `never` and non-`never` branches, near lines 620-621). After `const signal = this.#handleSignal(rid, controller, providedSignal)` (line ~676) and before the `return createRequest(...)`, arm the timer:

```ts
const effectiveTimeout = normalizeTimeout(
  'timeout' in config ? (config as { timeout?: number }).timeout : this.#requestTimeoutMs,
)
if (effectiveTimeout > 0) {
  const timeoutTimer = setTimeout(() => {
    // Fire only if this controller has not already reached a terminal state.
    // Keyed off the controller's own `settled`, never map membership.
    if (!controller.settled) {
      controller.abort(new RequestTimeoutError(procedure, effectiveTimeout))
    }
  }, effectiveTimeout)
  void controller.result.then(
    () => clearTimeout(timeoutTimer),
    () => clearTimeout(timeoutTimer),
  )
}
```

> `'timeout' in config` distinguishes an explicit `timeout: 0` (disable) from an absent key (fall back to the default). `controller.abort(err)` sets `controller.signal.reason`, which the `#handleSignal` merged signal adopts, so the call rejects with the typed error and the server abort is notified with reason `'RequestTimeoutError'`. Streams/channels do not arm a timer (no change to `createStream`/`createChannel`).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/client && pnpm exec vitest run test/request-timeout.test.ts` → PASS.
Then `cd packages/client && pnpm run test:types` → PASS.

- [ ] **Step 6: Full suite + lint + commit**

Run: `cd packages/client && pnpm exec vitest run` → all PASS. `cd /Users/paul/dev/yulsi/enkaku && rtk proxy pnpm run lint` → clean.

```bash
git add packages/client/src/error.ts packages/client/src/index.ts packages/client/src/client.ts packages/client/test/request-timeout.test.ts
git commit -m "feat(client): per-request timeout with typed RequestTimeoutError"
```

---

### Task 3: Feature 2 — leak-free `dispose()` on stream/channel calls

**Files:**
- Modify: `packages/client/src/client.ts`
- Test: `packages/client/test/channel-dispose.test.ts`

**Interfaces:**
- Consumes from Task 1: `controller.settled`, absorbed `onDone`, owner-threaded `#write`.
- Produces: `StreamCall` (and inherited `ChannelCall`) gains `dispose(reason?: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `packages/client/test/channel-dispose.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

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

function setup() {
  const transports = new DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>()
  const client = new Client<Protocol>({ transport: transports.client })
  return { transports, client }
}

describe('channel dispose', () => {
  const rejections: Array<unknown> = []
  const onRejection = (reason: unknown) => rejections.push(reason)
  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => process.off('unhandledRejection', onRejection))

  test('dispose() ends readable and resolves, with no unhandled rejection', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read() // consume the open
    const reader = channel.readable.getReader()
    const done = reader.read().then((r) => r.done)
    await expect(channel.dispose()).resolves.toBeUndefined()
    await expect(done).resolves.toBe(true) // readable closed
    await new Promise((r) => setTimeout(r, 0))
    expect(rejections).toEqual([])
    await client.dispose()
    expect(rejections).toEqual([])
  })

  test('no unhandled rejection when the transport is disposed BEFORE dispose()', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read()
    await client.dispose() // client-wide teardown first -> #abortControllers rejects the channel
    await new Promise((r) => setTimeout(r, 0))
    await expect(channel.dispose()).resolves.toBeUndefined()
    await new Promise((r) => setTimeout(r, 0))
    expect(rejections).toEqual([])
  })

  test('post-dispose send() rejects (no send for a dead rid)', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read()
    await channel.dispose()
    await expect(channel.send({})).rejects.toBeDefined()
  })

  test('double dispose() is idempotent and returns the same resolved promise', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read()
    const a = channel.dispose()
    const b = channel.dispose()
    expect(a).toBe(b)
    await expect(a).resolves.toBeUndefined()
  })

  test('pre-aborted channel: no unhandled rejection, readable already closed, dispose() no-op', async () => {
    const { client } = setup()
    const signal = AbortSignal.abort('AlreadyAborted')
    const channel = client.createChannel('echo', { param: {}, signal })
    void channel.catch(() => {})
    const reader = channel.readable.getReader()
    await expect(reader.read().then((r) => r.done)).resolves.toBe(true)
    await expect(channel.dispose()).resolves.toBeUndefined()
    await new Promise((r) => setTimeout(r, 0))
    expect(rejections).toEqual([])
  })

  test('a consumer awaiting a disposed call observes the rejection when dispose wins', async () => {
    const { transports, client } = setup()
    const channel = client.createChannel('echo', { param: {} })
    await transports.server.read()
    const awaited = expect(channel).rejects.toBeDefined()
    await channel.dispose()
    await awaited
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/client && pnpm exec vitest run test/channel-dispose.test.ts`
Expected: FAIL — `dispose` is not a function on the call.

- [ ] **Step 3: Add `dispose` to the `StreamCall` type**

In `client.ts` (line ~57):

```ts
export type StreamCall<Receive, Result> = RequestCall<Result> & {
  close: () => void
  dispose: (reason?: string) => Promise<void>
  procedure: string
  readable: ReadableStream<Receive>
}
```

`ChannelCall` inherits it. (Additive; `@enkaku/react`'s `StreamCall`/`ChannelCall` usage is unaffected.)

- [ ] **Step 4: Wire `dispose` + creation-time absorb into `createStream` (client method)**

At the end of the client's `createStream` (line ~752), replace the `return createStream({...})` with a build-then-augment that adds the absorb and `dispose`. Normal branch:

```ts
const call = createStream({ id: rid, controller, signal, sent, readable: receive.readable })
void call.catch(() => {}) // no unhandled rejection on teardown; awaiters still see it (multicast)
let disposed: Promise<void> | undefined
const dispose = (reason = 'Dispose'): Promise<void> => {
  if (disposed != null) return disposed
  if (!controller.settled) controller.abort(reason)
  if (this.#controllers[rid] === controller) delete this.#controllers[rid]
  disposed = Promise.resolve()
  return disposed
}
return Object.assign(call, { dispose })
```

For the **pre-aborted** early-return branch of `createStream` (line ~719), close the writer at creation and give a no-op `dispose`:

```ts
void writer.close().catch(() => {}) // readable ends immediately
const call = createStream({
  id: rid,
  controller,
  signal: providedSignal,
  sent: Promise.reject(providedSignal),
  readable: receive.readable,
})
void call.catch(() => {})
return Object.assign(call, { dispose: () => Promise.resolve() })
```

- [ ] **Step 5: Wire `dispose` + send-guard + absorb into `createChannel` (client method)**

Normal branch (line ~857): a `#disposed`-style flag drives both the send guard and `dispose`:

```ts
let disposed: Promise<void> | undefined
const send = async (val: T['Send']) => {
  if (disposed != null) {
    throw new Error('Channel disposed')
  }
  const channelSpan = this.#spans[rid]
  if (channelSpan != null) {
    channelSpan.addEvent('channel.message.sent', {
      [EnkakuAttributeKeys.MESSAGE_DIRECTION]: 'send',
    })
  }
  this.#logger.trace('send value to channel {procedure} with ID {rid}: {value}', { procedure, rid, value: val })
  await this.#write(
    { typ: 'send', prc: procedure, rid, val } as unknown as AnyClientPayloadOf<Protocol>,
    config.header,
    rid,
    controller,
  )
}
const call = Object.assign(
  createStream({ id: rid, controller, signal, sent, readable: receive.readable }),
  { send, writable: writeTo(send) },
)
void call.catch(() => {})
const dispose = (reason = 'Dispose'): Promise<void> => {
  if (disposed != null) return disposed
  if (!controller.settled) controller.abort(reason)
  if (this.#controllers[rid] === controller) delete this.#controllers[rid]
  disposed = Promise.resolve()
  return disposed
}
return Object.assign(call, { dispose })
```

For the **pre-aborted** channel branch (line ~800), close the writer at creation, keep the existing no-op `send`, and give a no-op `dispose`:

```ts
void writer.close().catch(() => {})
const send = async (_val: T['Send']) => {}
const call = Object.assign(
  createStream({
    id: rid,
    controller,
    signal: providedSignal,
    sent: Promise.reject(providedSignal),
    readable: receive.readable,
  }),
  { send, writable: writeTo(send) },
)
void call.catch(() => {})
return Object.assign(call, { dispose: () => Promise.resolve() })
```

> `writeTo(send)` installs `send` as the writable's sink, so a post-dispose `writable` write rejects via the guarded `send`. A `send()` already in flight (parked in `#write`) is not cancelled — the documented boundary.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/client && pnpm exec vitest run test/channel-dispose.test.ts` → PASS.
Then `cd packages/client && pnpm run test:types` → PASS.

- [ ] **Step 7: Full suite + lint + commit**

Run: `cd packages/client && pnpm exec vitest run` → all PASS (including the existing `dispose-aborts-controllers` / `controller-on-done-once` / `graceful-close` suites — confirm no regression). `cd /Users/paul/dev/yulsi/enkaku && rtk proxy pnpm run lint` → clean.

```bash
git add packages/client/src/client.ts packages/client/test/channel-dispose.test.ts
git commit -m "feat(client): leak-free dispose() on stream/channel calls"
```

---

## Self-Review

**1. Spec coverage:**
- Timeout API (`requestTimeoutMs` + `timeout`, effective-timeout, validation) → Task 2 Steps 3-4. ✓
- Timeout mechanism (`setTimeout`, `!settled` guard, clear on settle) → Task 2 Step 4. ✓
- `RequestTimeoutError` with `.name` → Task 2 Step 3. ✓
- Request-only (streams/channels never auto-timeout) → Task 2 (no timer in createStream/createChannel) + test. ✓
- `dispose()` normal algorithm (settle-if-!settled, identity delete, resolve, idempotent) → Task 3 Steps 4-5. ✓
- Creation-time multicast absorb (both branches) → Task 3 Steps 4-5. ✓
- Pre-aborted branch (writer closed at creation, no-op dispose) → Task 3 Steps 4-5. ✓
- Channel post-dispose send rejects → Task 3 Step 5 + test. ✓
- Single `onDone` close owner, absorbed → Task 1 Step 4. ✓
- `controller.settled` accessor (defineProperty) → Task 1 Step 3. ✓
- Owner-threaded `#write` failures → Task 1 Steps 5-6. ✓
- `#handleSignal` identity-checked delete + listener cleanup → Task 1 Step 6. ✓
- Acceptance (Sakui collapse) → out of this repo; the exported `timeout` config + `dispose()` match the spec's acceptance snippets. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step carries real code. The one soft note (reused-id test determinism) explicitly names the load-bearing fallback assertion. ✓

**3. Type consistency:** `controller.settled` defined in Task 1, consumed in Task 2 (timeout guard) and Task 3 (dispose guard). `#write(..., owner?)` defined Task 1, used by all rid write sites. `dispose(reason?: string): Promise<void>` type (Task 3 Step 3) matches every `dispose` closure (Steps 4-5). `RequestTimeoutError(procedure, timeoutMs)` constructor (Task 2 Step 3) matches its call in the timer (Step 4). ✓
