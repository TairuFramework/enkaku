# Abort Signal and Release Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** executing
**Mode:** tasks

**Spec:** `docs/superpowers/specs/2026-07-13-abort-signal-and-release-lifecycle-design.md`
**Branch:** `abort-signal-and-release-lifecycle` (already created; do not create another)

**Goal:** Make an abort signal actually tear a transport down, make tearing it down actually release the socket, and stop the server admitting new messages once it has begun disposing.

**Architecture:** Three independent defects sharing one invariant — *abort means teardown, and teardown means release*. `Transport` already accepts a `signal` and drops it, so it opts into none of `Disposer`'s existing external-signal wiring; forwarding it is a one-line change with a large blast radius. `createTransportStream` releases its socket with `unref()`, which does not close it, and only on one of the writable sink's three terminal exits; release must mean `destroy()`, on all of them. `Server`'s read loop never checks whether disposal has started, so a message arriving mid-drain can register a handler after the abort-all sweep has passed.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, `@sozai/async` (`Disposer`), `@sozai/stream` (`writeTo`), `node:net`, changesets.

## Global Constraints

Copied verbatim from `AGENTS.md`. These apply to every task.

- Use `type`, never `interface`.
- Uppercase abbreviations in names: `ID` not `Id`, `HTTP` not `Http`, `JWT` not `Jwt`.
- `Array<T>`, never `T[]`.
- Never `any` — use `unknown`, `Record<string, unknown>`, or a more specific type.
- `pnpm` / `pnpx`, never `npm` / `npx`.
- No `protected` modifier — use public or `#private`.
- Lint via `rtk proxy pnpm run lint` (a machine-local `rtk` shim hijacks bare `pnpm run lint` and runs the wrong tool). Or invoke Biome directly: `pnpm exec biome check <path>`.
- Never edit generated files (`.gen.ts`, `__generated__/`, `lib/`).

**Test commands.** Run unit tests for a single package from the repo root:

```bash
pnpm --filter @enkaku/<package> exec vitest run test/<file>.test.ts
```

Full suite (types + unit): `pnpm run test`. Unit only: `pnpm run test:unit`.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `packages/transport/src/index.ts:64-85` | Modify — forward `params.signal` to `Disposer` | 1 |
| `packages/transport/test/signal.test.ts` | Create — external signal disposes the transport | 1 |
| `packages/socket/src/index.ts:237-269` | Modify — `releaseSocket()` at all three sink exits | 2 |
| `packages/socket/test/socket-release.test.ts` | Create — one test per sink exit | 2 |
| `packages/socket/test/signal-dispose.test.ts` | Create — `SocketTransport` external-signal integration | 3 |
| `packages/server/src/server.ts:689` | Modify — `void disposer.dispose()`, breaking the deadlock | 4 |
| `packages/server/src/server.ts:717-955` | Modify — `handleNext()` bails once disposing | 4 |
| `packages/server/test/dispose-read-window.test.ts` | Create — no handler starts mid-drain; dispose does not deadlock | 4 |
| `packages/http-serve/test/disconnect-abort.test.ts` | Modify — add throwing-`onRequestAborted` isolation test | 5 |
| `.changeset/*.md` | Create — one per behavior-changing package | 6 |

**Task order matters in one place:** Task 3 asserts that an external abort on a `SocketTransport` ends with the socket `destroyed`. That needs *both* Task 1 (signal reaches `dispose()`) and Task 2 (dispose releases the socket). Do 1 and 2 before 3. Tasks 4 and 5 are independent of everything.

---

### Task 1: `Transport` forwards `params.signal` to `Disposer`

`Disposer` (`@sozai/async`) already wires an external signal to teardown — `onAbort(params.signal, () => this.dispose(params.signal?.reason))`. `Transport` declares `signal` in `TransportParams`, accepts it, and never passes it to `super()`. `DirectTransports`, thirty lines below in the same file, does (`super({ ...options, dispose })`). Every transport subclass in the repo (`SocketTransport`, `NodeStreamsTransport`, `MessageTransport`) has been passing `signal` up into a black hole.

**Files:**
- Modify: `packages/transport/src/index.ts:64-85`
- Test: `packages/transport/test/signal.test.ts` (create)

**Interfaces:**
- Consumes: `Disposer` from `@sozai/async` (already imported), `createConnection` from `@sozai/stream` (already imported).
- Produces: no signature change. `TransportParams.signal` keeps its type; only its *behavior* changes — aborting it now disposes the transport.

- [ ] **Step 1: Write the failing test**

Create `packages/transport/test/signal.test.ts`:

```ts
import { createConnection } from '@sozai/stream'
import { describe, expect, test, vi } from 'vitest'

import { Transport } from '../src/index.js'

describe('Transport external signal', () => {
  test('aborting params.signal disposes the transport', async () => {
    const [stream] = createConnection<string, string>()
    const controller = new AbortController()
    const transport = new Transport<string, string>({ stream, signal: controller.signal })

    const disposing = vi.fn()
    const disposed = vi.fn()
    transport.events.on('disposing', disposing)
    transport.events.on('disposed', disposed)

    expect(transport.signal.aborted).toBe(false)

    controller.abort()
    await transport.disposed

    // The whole point: an abort on the caller's signal must run the transport's
    // own teardown, not just sit there.
    expect(transport.signal.aborted).toBe(true)
    expect(disposing).toHaveBeenCalledTimes(1)
    expect(disposed).toHaveBeenCalledTimes(1)
  })

  test('the abort reason reaches the disposed event', async () => {
    const [stream] = createConnection<string, string>()
    const controller = new AbortController()
    const transport = new Transport<string, string>({ stream, signal: controller.signal })

    const disposed = vi.fn()
    transport.events.on('disposed', disposed)

    const reason = new Error('caller went away')
    controller.abort(reason)
    await transport.disposed

    expect(disposed).toHaveBeenCalledWith({ reason })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @enkaku/transport exec vitest run test/signal.test.ts
```

Expected: FAIL. `transport.disposed` never settles, so the test times out — `expect(transport.signal.aborted).toBe(true)` is never reached. This is the defect the reviewer reproduced against the built lib.

- [ ] **Step 3: Forward the signal**

In `packages/transport/src/index.ts`, the `Transport` constructor currently ends its `super()` call with only `dispose`. Add `signal`:

```ts
  constructor(params: TransportParams<R, W>) {
    super({
      dispose: async (reason?: unknown) => {
        await this.#events.emit('disposing', { reason })
        if (this._stream != null) {
          try {
            const writer = await this._getWriter()
            await writer.close()
          } catch {
            // Ignore error getting the writer (e.g. the stream itself
            // rejected -- a failed connect) or closing it (e.g. already
            // closed). Either way 'disposed' below must still fire: it is
            // the only signal a caller that owns a resource behind this
            // transport gets that it is safe to release it.
          }
        }
        await this.#events.emit('disposed', { reason })
      },
      // Disposer wires this to dispose(). Without it, every subclass that
      // accepts a `signal` -- all of them -- passes it into a black hole:
      // the caller's abort tears nothing down and the resource behind the
      // transport is never released.
      signal: params.signal,
    })
    this.#events = new EventEmitter<TransportEvents>()
    this.#params = params
  }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @enkaku/transport exec vitest run test/signal.test.ts
```

Expected: PASS, both tests.

- [ ] **Step 5: Run the whole transport suite for regressions**

```bash
pnpm --filter @enkaku/transport exec vitest run
```

Expected: PASS. Nothing in this package passed a `signal` before, so nothing should change.

- [ ] **Step 6: Commit**

```bash
git add packages/transport/src/index.ts packages/transport/test/signal.test.ts
git commit -m "fix(transport): forward params.signal to Disposer

Transport declared signal in TransportParams, accepted it, and never passed it
to super() -- so aborting it disposed nothing and every subclass had been
passing signal into a black hole."
```

---

### Task 2: `createTransportStream` releases its socket on every sink exit

`socket.end()` half-closes; `socket.unref()` only stops the socket holding the event loop open. Neither closes it, so a consumer using `createTransportStream` **bare** — no `Transport` on top, and therefore no `disposed` hook — leaks the socket. That consumer exists: mokei's `host-monitor` does `createTransportStream(connectSocket(socketPath))`.

The writable sink has three terminal exits and today only one of them releases anything:

| Exit | Sink callback invoked |
|---|---|
| clean close, healthy peer | `close` |
| clean close, stalled peer (the `end()` flush grace expires) | `close` |
| the sink's `write()` **rejects** | **none** |
| explicit `writer.abort(reason)` | `abort` (not currently passed to `writeTo`) |

The rejecting-write exit runs *no callback at all* — the WritableStream errors, and a later `writer.close()` rejects with `Invalid state: WritableStream is closed`. That is the stalled-peer path, not a corner case. `SocketTransport` survives it only because `dispose()` catches the rejected `writer.close()` and fires `disposed` regardless. A bare consumer has nothing.

**Files:**
- Modify: `packages/socket/src/index.ts:237-269` (the `writeTo(...)` call at the end of `createTransportStream`)
- Test: `packages/socket/test/socket-release.test.ts` (create)

**Interfaces:**
- Consumes: `writeTo` from `@sozai/stream` — signature is `writeTo<T>(write, close?, abort?)`. The third parameter is already supported and simply not being passed today.
- Produces: no signature change to `createTransportStream`. Behavior change only: the socket it was given (or opened) is `destroyed` once the writable reaches any terminal state.

- [ ] **Step 1: Write the failing tests**

Create `packages/socket/test/socket-release.test.ts`:

```ts
import { createServer, type Server, type Socket as NetSocket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { connectSocket, createTransportStream } from '../src/index.js'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-socket-release-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const server = createServer()
    server.listen(socketPath, () => {
      resolve({ server, socketPath })
    })
  })
}

function waitForConnection(server: Server): Promise<NetSocket> {
  return new Promise((resolve) => {
    server.once('connection', resolve)
  })
}

// A bare consumer -- createTransportStream with no Transport on top, and so no
// 'disposed' hook to destroy the socket for it. mokei's host-monitor is one.
// end() + unref() leaves the socket open: unref() only stops it holding the
// event loop, and the peer keeps seeing a live connection.
describe('bare createTransportStream socket release', () => {
  test('destroys the socket after a clean close against a healthy peer', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const { writable } = await createTransportStream<unknown, { payload: string }>(socket)

    const serverSocket = await connectionPromise
    let receivedBytes = 0
    serverSocket.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length
    })
    const serverDone = new Promise<void>((resolve) => {
      serverSocket.on('end', resolve)
      serverSocket.on('close', resolve)
    })

    const payload = 'x'.repeat(1024)
    const encoded = `${JSON.stringify({ payload })}\n`

    const writer = writable.getWriter()
    await writer.write({ payload })
    await writer.close()
    await serverDone

    // Releasing must not truncate: the flush still runs before the destroy.
    expect(receivedBytes).toBe(encoded.length)
    // The peer read everything, so the end() grace never expired -- and this is
    // exactly the case a "destroy only when the grace expires" fix would miss.
    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  }, 10_000)

  test('destroys the socket when the sink write rejects against a stalled peer', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const controller = new AbortController()
    const { writable } = await createTransportStream<unknown, { payload: string }>(socket, {
      signal: controller.signal,
    })

    const serverSocket = await connectionPromise
    // Never reads: no 'data' listener, no resume(). Bytes pile up with nowhere
    // to go, so socket.write() returns false and the write parks in waitForDrain.

    const writer = writable.getWriter()
    // Several MiB, so the write genuinely hits backpressure. A small payload
    // never enters waitForDrain at all and would not exercise this path.
    const bigWrite = writer.write({ payload: 'x'.repeat(8 * 1_048_576) })
    // The abort below legitimately rejects this write; catch immediately so it
    // never surfaces as an unhandled rejection.
    bigWrite.catch(() => {})

    await new Promise((resolve) => setTimeout(resolve, 50))

    // waitForDrain gives the peer END_GRACE_MS (2s) to recover, then rejects.
    controller.abort()
    await bigWrite.catch(() => {})

    // The rejected write errors the WritableStream, which runs NEITHER the
    // `close` nor the `abort` sink callback -- so this is the exit that a
    // release living only in the close callback misses entirely.
    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  }, 15_000)

  test('destroys the socket when the writer is explicitly aborted', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const { writable } = await createTransportStream<unknown, { payload: string }>(socket)

    const serverSocket = await connectionPromise

    const writer = writable.getWriter()
    await writer.abort(new Error('caller gave up'))

    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  }, 10_000)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @enkaku/socket exec vitest run test/socket-release.test.ts
```

Expected: all three FAIL on `expect(socket.destroyed).toBe(true)` — received `false`. Three different exits, one missing release.

- [ ] **Step 3: Release the socket at every sink exit**

In `packages/socket/src/index.ts`, replace the `const writable = writeTo<W>(...)` call (currently ending with `socket.unref()`) with:

```ts
  // Releasing a socket means destroy(), not unref(): end() only half-closes it
  // and unref() only stops it holding the event loop open, so on both counts the
  // peer keeps seeing a live connection. Idempotent, so SocketTransport's own
  // 'disposed' hook destroying it again afterwards is harmless.
  function releaseSocket(): void {
    if (!socket.destroyed) {
      socket.destroy()
    }
  }

  const writable = writeTo<W>(
    async (msg) => {
      try {
        if (socketError != null) {
          throw socketError
        }
        if (socket.destroyed || socket.writableEnded) {
          throw new Error('Socket is closed')
        }
        if (!socket.write(`${JSON.stringify(msg)}\n`)) {
          // Returning a promise makes WritableStream apply backpressure upstream.
          await waitForDrain(socket, signal)
        }
      } catch (cause) {
        // A rejecting write errors the WritableStream, and an errored stream runs
        // NEITHER the `close` nor the `abort` callback below -- a later close()
        // just rejects with 'Invalid state'. So this is the only place a bare
        // consumer's socket can be released on the stalled-peer path.
        releaseSocket()
        throw cause
      }
    },
    async () => {
      // Wait for queued writes to actually flush, so a caller that closes the
      // writer (or disposes the transport) does not cut off its own last message.
      await new Promise<void>((resolve) => {
        if (socket.destroyed || socket.writableEnded || socketError != null) {
          resolve()
          return
        }
        // A stalled peer must not hang the close
        const timer = setTimeout(resolve, END_GRACE_MS)
        timer.unref()
        socket.end(() => {
          clearTimeout(timer)
          resolve()
        })
      })
      releaseSocket()
    },
    async () => {
      // Explicit writer.abort(): the caller has given up on the stream, so there
      // is nothing left to flush.
      releaseSocket()
    },
  )
```

Note the `write` body is unchanged apart from being wrapped in the `try`/`catch`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @enkaku/socket exec vitest run test/socket-release.test.ts
```

Expected: PASS, all three.

- [ ] **Step 5: Run the whole socket suite for regressions**

```bash
pnpm --filter @enkaku/socket exec vitest run
```

Expected: PASS. Pay attention to `stalled-peer-recovery.test.ts` (asserts a recovering peer still receives every byte — the flush must still run *before* the destroy) and `dispose-drain-hang.test.ts` (asserts `dispose()` stays bounded). If either fails, the release is happening before the flush, not after.

- [ ] **Step 6: Commit**

```bash
git add packages/socket/src/index.ts packages/socket/test/socket-release.test.ts
git commit -m "fix(socket): destroy the socket on every terminal sink exit

end() half-closes and unref() only drops the event-loop ref, so a bare
createTransportStream consumer -- one with no Transport and so no 'disposed'
hook -- leaked its socket. A rejecting write runs neither the close nor the
abort callback, so releasing only in close() would still miss the stalled-peer
path."
```

---

### Task 3: `SocketTransport` external-signal integration

Tasks 1 and 2 are each half of one promise: the signal must reach `dispose()` (Task 1) *and* `dispose()` must release the socket (Task 2). Neither is worth much alone, and the property a caller actually cares about — "I abort my signal, the socket dies" — is only observable once both land. This task adds the test that pins it.

It also covers the double-fire that Task 1 introduces. `SocketTransport` uses `params.signal` for two other things: `connectSocket(socket, { signal })` aborts a *pending connect*, and the drain wait uses `this.signal`. After Task 1, aborting the external signal both rejects a pending connect *and* disposes the transport. That is correct — the `disposed` hook awaits `socketPromise` inside a `try`/`catch`, so a rejected connect is swallowed and there is nothing to release — but it must be asserted, not assumed.

**Files:**
- Test: `packages/socket/test/signal-dispose.test.ts` (create)
- No source changes. If a test here fails, the bug is in Task 1 or Task 2.

**Interfaces:**
- Consumes: `SocketTransport` and `connectSocket` from `../src/index.js`; the behavior established by Tasks 1 and 2.
- Produces: nothing.

- [ ] **Step 1: Write the tests**

Create `packages/socket/test/signal-dispose.test.ts`:

```ts
import { createServer, type Server, type Socket as NetSocket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'

import { connectSocket, SocketTransport } from '../src/index.js'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-signal-dispose-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const server = createServer()
    server.listen(socketPath, () => {
      resolve({ server, socketPath })
    })
  })
}

function waitForConnection(server: Server): Promise<NetSocket> {
  return new Promise((resolve) => {
    server.once('connection', resolve)
  })
}

describe('SocketTransport external signal', () => {
  test('aborting the signal disposes the transport and destroys the socket', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const controller = new AbortController()
    let clientSocket: NetSocket | undefined
    const transport = new SocketTransport<unknown, { ping: boolean }>({
      socket: async () => {
        clientSocket = await connectSocket(socketPath)
        return clientSocket
      },
      signal: controller.signal,
    })

    const disposed = vi.fn()
    transport.events.on('disposed', disposed)

    // Force the lazy connect so there is a real socket to release.
    await transport.write({ ping: true })
    const serverSocket = await connectionPromise
    serverSocket.resume()
    expect(clientSocket?.destroyed).toBe(false)

    controller.abort()
    await transport.disposed

    // The whole chain: signal -> dispose() -> 'disposed' -> socket released.
    // Before this branch the abort did nothing at all: no dispose, no destroy.
    expect(disposed).toHaveBeenCalledTimes(1)
    expect(clientSocket?.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  }, 10_000)

  test('aborting during a pending connect rejects the connect and still disposes cleanly', async () => {
    // A path that never resolves a socket: nothing is listening, and the connect
    // is abandoned mid-flight. The transport must still dispose -- the 'disposed'
    // hook awaits the socket promise, which rejects, and must swallow it.
    const socketPath = join(
      tmpdir(),
      `enkaku-nothing-listening-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const controller = new AbortController()
    const transport = new SocketTransport<unknown, { ping: boolean }>({
      socket: socketPath,
      signal: controller.signal,
      connectTimeoutMs: 0,
    })

    const disposed = vi.fn()
    transport.events.on('disposed', disposed)

    // Kick off the lazy connect, then abort it before it can settle.
    const write = transport.write({ ping: true })
    write.catch(() => {})
    controller.abort()

    await expect(write).rejects.toThrow()
    await expect(transport.disposed).resolves.toBeUndefined()
    expect(disposed).toHaveBeenCalledTimes(1)
  }, 10_000)
})
```

- [ ] **Step 2: Run the tests**

```bash
pnpm --filter @enkaku/socket exec vitest run test/signal-dispose.test.ts
```

Expected: PASS, both. They should pass immediately given Tasks 1 and 2.

If the first fails on `clientSocket?.destroyed` being `false` while `disposed` *was* called, the signal reached `dispose()` (Task 1 works) but the release did not run (Task 2 is incomplete). If `disposed` was never called, Task 1 is incomplete. Do not patch this test to make it pass — fix the task it is reporting on.

- [ ] **Step 3: Commit**

```bash
git add packages/socket/test/signal-dispose.test.ts
git commit -m "test(socket): pin SocketTransport external-signal teardown

Asserts the whole chain -- abort -> dispose -> 'disposed' -> socket destroyed --
which is the property a caller wiring up a signal actually expects, and which
neither the transport fix nor the socket fix delivers on its own."
```

---

### Task 4: `Server` stops admitting messages once disposal starts

`handleNext()` reads a message, processes it, and tail-recurses, and never checks whether disposal has begun. The disposer meanwhile drains `pending` (auth in flight), aborts every registered controller, drains `running`, then unsubscribes.

So a message *arriving during* the drain is still read, auth-checked, and can register its controller **after** the abort-all sweep. `handleRequest` gives that handler a fresh `AbortController` (`handlers/request.ts:38`) registered in `ctx.controllers` but never linked to `ctx.signal` — so once the sweep has passed, nothing aborts it. It runs to completion on a dead signal, after `dispose()` resolved.

**Check `disposer.signal`, not the `signal` param.** `handleMessages` reaches `dispose()` by two routes: the server's `#abortController` (arriving as the `signal` param) *and* direct `disposer.dispose()` calls from the transport-read-error, stream-`done`, and replay-cache-failure paths. Only `disposer.signal` is aborted on both, because `Disposer.dispose()` calls `this.abort()`. Checking the param would silently miss the direct routes — and one of those routes is what Step 1's second test exercises.

**This task also fixes a THIRD defect, found during Task 1's review.** `Server` (`server.ts:1011-1050`) forwards `params.signal` to `Disposer` and its dispose callback opens with `await this.#events.emit('disposing', ...)`. If the signal is **already aborted** at construction, `Disposer` invokes that callback synchronously from inside `super()` — before the derived constructor body has run, so `this` is still in TDZ. The `ReferenceError` is caught by `Disposer`, warned, and `disposed` **resolves anyway**.

Confirmed empirically against the current source:

```
Disposer dispose callback rejected ReferenceError: Must call super constructor in derived class before accessing 'this'
server.disposed: DISPOSED_RESOLVED
disposing fired: 0
disposed fired: 0
```

So `new Server({ ..., signal })` with an already-fired signal reports successful disposal while never disposing its transports, never aborting its handlers, and never clearing the cleanup interval. `Transport` and `DirectTransports` had the identical flaw and were fixed in Task 1 (commit `d0e9ae0`) by yielding a microtask at the top of the dispose callback before any `this` access. Apply the same fix here, and mirror Task 1's test. `Client` does **not** forward a signal to `Disposer`, so it is unaffected — leave it alone.

**This task also fixes a second, previously unknown defect on the same file.** `server.ts:689` — when the replay cache throws, `process()` does `await disposer.dispose()`. But `process()` is itself an entry in the `pending` map, and the disposer's first act is `await Promise.all(Object.values(pending))`. `process` waits on `dispose`; `dispose` waits on `process`. The graceful path never completes, and `Server.dispose()` escapes only via its `cleanupTimeoutMs` race — burning the whole 30s default on every replay-cache failure. Measured: unresolved after 3s on the default timeout, ~700ms with a 500ms one.

The two fixes are in one task because they are in one file and their tests interlock: the deadlock route is also the only route that proves the bail must check `disposer.signal` rather than the `signal` param.

**Files:**
- Modify: `packages/server/src/server.ts:689` — `await disposer.dispose()` → `void disposer.dispose()`
- Modify: `packages/server/src/server.ts` — inside `handleNext()`, after the `next.done` check and before `processMessage`
- Modify: `packages/server/src/server.ts:1011-1050` — microtask yield at the top of `Server`'s dispose callback, mirroring `d0e9ae0`
- Test: `packages/server/test/dispose-read-window.test.ts` (create)
- Test: `packages/server/test/dispose-aborted-signal.test.ts` (create) — the already-aborted-signal case

Read commit `d0e9ae0` (`git show d0e9ae0`) before writing the third fix: it is the same fix on `Transport`/`DirectTransports`, including the comment that explains why the microtask yield exists. Match it, and match its test's shape — assert that `disposing` and `disposed` actually fire and that disposal really happened, NOT merely that no console warning appeared.

**Interfaces:**
- Consumes: `disposer` (the `Disposer` declared at `server.ts:265`) and `logger` (destructured from `params` at `server.ts:108`) — both already in scope inside `handleNext()` and inside `process()`. `ReplayCache` is `{ checkAndRecord(key: string, expiresAt: number): boolean | Promise<boolean> }` (`src/replay.ts:3`); a test cache may be an object literal of that shape. Replay protection only runs in auth mode — `resolveReplay` returns `null` when `requireAuth` is false — so the replay tests need a real `identity`.
- Produces: no signature change. Behavior: messages read after disposal has begun are dropped with a `logger.warn` and the read loop stops; a throwing replay cache no longer strands `dispose()`.

- [ ] **Step 1: Write the failing tests**

Create `packages/server/test/dispose-read-window.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken, randomIdentity } from '@kokuin/token'
import { defer } from '@sozai/async'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

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

    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        rid: 'r1',
        prc: 'test/slow',
      }) as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Begin disposal. The sweep aborts r1's controller, then awaits `running`.
    const disposed = server.dispose()
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Message 2 lands *while dispose() is draining*. The transport is still
    // readable -- it is only disposed after `handling.done` resolves.
    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        rid: 'r2',
        prc: 'test/second',
      }) as AnyClientMessageOf<Protocol>,
    )
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
    await transports.client.write(m1 as unknown as AnyClientMessageOf<Protocol>)

    // Let the cache throw and take the dispose route.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toBe(1)

    const m2 = await signer.signToken({
      typ: 'request',
      prc: 'test/second',
      rid: 'r2',
      aud: signer.id,
    } as const)
    await transports.client.write(m2 as unknown as AnyClientMessageOf<Protocol>)
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
```

`createUnsignedToken` (from `@kokuin/token`, already a dependency of this package) builds the `{ header, payload }` shape the server expects — `createHandleSpan` reads `message.header` to extract the trace context, so a raw `{ payload }` object is not sufficient. This is the same helper `lifecycle-events.test.ts` uses. The auth-mode tests use `signer.signToken(...)` instead, as `replay-server.test.ts` does — replay protection only runs in auth mode (`resolveReplay` returns `null` when `requireAuth` is false), so the discriminating route is unreachable without a real identity.

**A transport-read-failure test is deliberately NOT written.** That path `return`s from `handleNext` immediately, so the loop stops and message 2 is never read — it would pass on unfixed code and prove nothing. It was in an earlier draft of this plan and was cut for exactly that reason.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @enkaku/server exec vitest run test/dispose-read-window.test.ts
```

Expected, all three RED, each on a concrete value rather than a bare timeout:

1. mid-drain drop — `expect(secondHandler).not.toHaveBeenCalled()` receives 1 call. A handler started after the abort-all sweep.
2. replay-cache-failure drop — same assertion, same failure. Confirmed against unfixed code before this plan was written.
3. deadlock — `expect(outcome).toBe('resolved')` receives `'deadlocked'`.

If any of the three passes here, stop and say so: it means the test cannot discriminate and needs reworking, not that the code is fine. Eight plan-authored tests on the two preceding branches passed on unfixed code.

- [ ] **Step 3: Fix the dispose deadlock**

`packages/server/src/server.ts:689`, inside the async auth-mode `process()`. `handleNext` registers this call in `pending` via `track()` and does not await it — and the disposer's first act is `await Promise.all(Object.values(pending))`. So `await disposer.dispose()` here makes `process` wait on `dispose` while `dispose` waits on `process`.

Change the `await` to `void`:

```ts
          if (replay != null) {
            let replayResult: ReplayCheckResult
            try {
              replayResult = await checkReplay(message as unknown as SignedToken, replay)
            } catch (cause) {
              const error = new Error('Replay cache check failed', { cause })
              logger.warn('replay cache check failed', { cause })
              events.emit('transportError', { error })
              // NOT awaited: this `process()` call is itself an entry in `pending`,
              // and the disposer awaits every entry in `pending` before it does
              // anything else -- so awaiting here deadlocks the graceful path and
              // strands shutdown until cleanupTimeoutMs (30s) force-disposes.
              // dispose() aborts its signal synchronously, so handleNext's bail
              // still sees it on the very next read.
              void disposer.dispose()
              return
            }
```

Leave the other four `disposer.dispose()` call sites (lines 725, 729, 790, 894) alone. They sit in `handleNext`'s direct flow, are never registered in `pending`, and do not deadlock.

- [ ] **Step 4: Bail out of the read loop once disposing**

In the same file, inside `handleNext()`, insert the check immediately after the `next.done` block and before `const msg = processMessage(next.value)`:

```ts
    if (next.done) {
      await disposer.dispose()
      return
    }

    // Disposal has begun: the abort-all sweep may already have run, so a handler
    // registered from here on would hold a controller nothing will ever abort and
    // would run to completion after dispose() resolved. Drop the message and stop
    // reading.
    //
    // `disposer.signal`, not the `signal` param: the async `process()` disposes the
    // disposer directly when the replay cache throws, and on that route the server's
    // #abortController -- which is what arrives as `signal` -- is never aborted at
    // all, while this loop keeps running. Only the disposer's own signal is aborted
    // on every route, because Disposer.dispose() calls this.abort().
    if (disposer.signal.aborted) {
      logger.warn('dropped message received while disposing', {
        typ: (next.value as { payload?: { typ?: unknown } }).payload?.typ,
      })
      return
    }

    const msg = processMessage(next.value)
```

The `return` — rather than a `break` or a recursive call — is the point: once disposal has started there is no reason to keep reading, and the loop ends here.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter @enkaku/server exec vitest run test/dispose-read-window.test.ts
```

Expected: PASS, all three.

- [ ] **Step 6: Prove each test discriminates**

Green tests are worthless if they would also be green on the unfixed code — the failure mode that bit the two preceding branches eight times. Revert each fix independently and confirm the right tests go red:

```bash
# Revert ONLY the bail (Step 4), keep the deadlock fix. Then:
pnpm --filter @enkaku/server exec vitest run test/dispose-read-window.test.ts
```
Expected: tests 1 and 2 RED, test 3 GREEN.

```bash
# Revert ONLY the deadlock fix (Step 3), keep the bail. Then:
pnpm --filter @enkaku/server exec vitest run test/dispose-read-window.test.ts
```
Expected: test 3 RED. (Test 2 sets `cleanupTimeoutMs: 500`, so it stays green — it is asserting the drop, not the timing.)

Restore both fixes before continuing. Report the observed red/green matrix in your report file; a fix whose revert leaves the suite green has no test guarding it and must be reported, not quietly accepted.

- [ ] **Step 7: Run the whole server suite for regressions**

```bash
pnpm --filter @enkaku/server exec vitest run
```

Expected: PASS. Watch `dispose-pending-auth.test.ts` (the sibling case this completes — a message whose auth is *already* in flight must still be swept, which the `pending` barrier handles and this bail must not disturb), `dispose-timeout.test.ts`, `handling-cleanup.test.ts`, and `replay-server.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/dispose-read-window.test.ts
git commit -m "fix(server): stop admitting messages once disposal starts, and unblock dispose

handleNext() never checked whether dispose() had begun, so a message arriving
mid-drain could register its controller after the abort-all sweep and run to
completion on a signal nothing would ever abort.

The replay-cache-failure path also awaited disposer.dispose() from inside a
pending entry that the disposer itself awaits, deadlocking the graceful path and
stranding shutdown until cleanupTimeoutMs force-disposed it."
```

---

### Task 5: `http-serve` throwing-`onRequestAborted` isolation test

No live defect — the guard works. `reportRequestAborted` (`http-serve/src/index.ts:160`) swallows a throwing consumer callback so one bad subscriber cannot error the shared writable or crash the process from the sweep timer.

The gap is in coverage. `clearSessionInflight` reaches it from the sweep interval and the SSE listener, and the `dropSession` path has a throwing-callback test (`sse-buffer-limits.test.ts:77`, for the sibling `onWriteError`). But the request-`signal` listener (`src/index.ts:382`) calls `reportRequestAborted` **directly**, and nothing tests that path. A future edit there could reintroduce a raw unguarded call and no test would notice.

**Files:**
- Modify: `packages/http-serve/test/disconnect-abort.test.ts` (append one test to the existing `describe('client disconnect')` block)

**Interfaces:**
- Consumes: `createServerBridge` and the existing `createRequestPost(rid, signal)` helper already defined at the top of the file. Do not redefine it.
- Produces: nothing.

- [ ] **Step 1: Write the test**

Append to the `describe('client disconnect')` block in `packages/http-serve/test/disconnect-abort.test.ts`, after the last test:

```ts
  test('a throwing onRequestAborted does not break the disconnect path', async () => {
    // The request-signal listener calls reportRequestAborted *directly*, unlike
    // the sweep and the SSE listener which route through clearSessionInflight.
    // So its guard is the one with no test of its own: a future edit that dropped
    // the try/catch would go unnoticed. Mirrors the onWriteError isolation test
    // in sse-buffer-limits.test.ts.
    const onRequestAborted = vi.fn(() => {
      throw new Error('onRequestAborted consumer callback blew up')
    })
    const bridge = createServerBridge({ onRequestAborted })

    const abort = new AbortController()
    const pending = bridge.handleRequest(createRequestPost('r1', abort.signal))
    await new Promise((resolve) => setTimeout(resolve, 10))

    abort.abort()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(onRequestAborted).toHaveBeenCalledWith({ rid: 'r1', reason: 'ClientDisconnected' })

    // The throw must not have escaped: the deferred Response still settles rather
    // than leaking, and the bridge is still usable for a fresh request.
    expect((await pending).status).toBe(499)

    const abort2 = new AbortController()
    const pending2 = bridge.handleRequest(createRequestPost('r2', abort2.signal))
    await new Promise((resolve) => setTimeout(resolve, 10))
    abort2.abort()
    expect((await pending2).status).toBe(499)
  })
```

- [ ] **Step 2: Run the test**

```bash
pnpm --filter @enkaku/http-serve exec vitest run test/disconnect-abort.test.ts
```

Expected: PASS. The guard already works — this test proves it and pins it. If it *fails*, the guard is broken and that is a real bug to fix in `src/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/http-serve/test/disconnect-abort.test.ts
git commit -m "test(http-serve): pin the onRequestAborted guard on the disconnect path

The request-signal listener calls reportRequestAborted directly rather than via
clearSessionInflight, so its guard had no test and a future edit could drop it
undetected."
```

---

### Task 6: Changesets, lint, and full verification

Three packages change behavior; `@enkaku/http-serve` gets a test only and so gets no changeset.

**Files:**
- Create: `.changeset/transport-signal-disposes.md`
- Create: `.changeset/socket-release-destroys.md`
- Create: `.changeset/server-dispose-read-window.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Confirm the changeset format used in this repo**

```bash
ls .changeset/ && cat .changeset/config.json
```

Match the bump level and frontmatter style of any existing changeset files. If none exist, use `patch` for all three — these are bug fixes, not features. `@enkaku/transport`'s is the one a consumer must actually read, so its body carries the migration note.

- [ ] **Step 2: Write the changesets**

`.changeset/transport-signal-disposes.md`:

```markdown
---
'@enkaku/transport': patch
---

`Transport` now forwards `params.signal` to its `Disposer`, so aborting that signal disposes the transport.

Previously `signal` was accepted, declared on `TransportParams`, and silently dropped: aborting it did nothing. Every transport subclass (`SocketTransport`, `NodeStreamsTransport`, `MessageTransport`) passes `signal` up to the base class, so all of them were affected — a caller wiring up a signal expecting "abort tears this down" got no dispose, no `disposed` event, and a leaked underlying resource.

Aborting the signal now runs the same graceful teardown as calling `dispose()`: `disposing` is emitted, queued writes are flushed (bounded), then `disposed` is emitted and the resource behind the transport is released. If you pass a `signal` today and rely on it *not* disposing the transport, stop passing it.

Also fixes teardown for a transport constructed with a signal that is **already aborted**. The disposal callback previously ran before the instance had finished initializing, threw internally, and was swallowed — so `dispose()` resolved successfully while `disposing`/`disposed` never fired and the underlying resource was never released. This affected `DirectTransports` already, and would have affected every transport once `signal` was wired through.
```

`.changeset/socket-release-destroys.md`:

```markdown
---
'@enkaku/socket': patch
---

`createTransportStream` now destroys its socket when the writable reaches any terminal state, instead of half-closing it with `end()` and dropping the event-loop reference with `unref()`.

Neither `end()` nor `unref()` closes a socket: the read side stays open and the peer keeps seeing a live connection. `SocketTransport` was unaffected — its `disposed` hook already destroyed the socket — but a consumer using `createTransportStream` **bare**, with no `Transport` on top and so no `disposed` event to hook, had no release path at all and leaked the socket until the process exited.

The socket is now released on every exit from the writable sink: a clean close (after the flush), an explicit `writer.abort()`, and a rejected write — which errors the stream and runs neither the `close` nor the `abort` callback, and is the path a stalled peer takes. The flush still runs before the destroy, so a clean close does not truncate.
```

`.changeset/server-dispose-read-window.md`:

```markdown
---
'@enkaku/server': patch
---

Shutdown fixes.

**`Server` no longer reads and admits new messages while `dispose()` is draining.** `dispose()` aborts every registered handler controller, then waits for the in-flight ones to finish. But the read loop never checked whether disposal had started, so a message arriving *during* that wait was still read, authenticated, and could register its controller after the abort-all sweep had already passed — leaving a handler running on a signal nothing would ever abort, after `dispose()` had resolved. Such messages are now dropped with a warning log and the read loop stops. Clients receive no reply for them; they see the transport close, as they would anyway.

**`dispose()` no longer deadlocks when the replay cache throws.** On that path the server awaited its own disposer from inside a handler-tracking entry that the disposer itself waits on, so the graceful shutdown path could never complete and `dispose()` only returned once `cleanupTimeoutMs` (30 seconds by default) expired and force-disposed the transports. This only affects servers with a custom `ReplayCache` that can throw — a remote cache losing its connection, for example; the built-in in-memory cache never does.

**A handled transport is now disposed on every route, not just via `Server.dispose()`.** When message handling ended on its own — a peer hanging up, a transport read error, a replay-cache failure — the server detached the transport from its active list without ever closing it. The shutdown deadlock above had been masking this: it held the entry open long enough for the timeout path to clean up. In-flight handlers still flush their final replies before the transport closes, and the close is bounded by `cleanupTimeoutMs` so a transport that will not close cannot hang `Server.handle()`.

**A `Server` constructed with an already-aborted `signal` now actually disposes.** Previously the teardown callback ran before the instance had finished initializing, threw internally, and was swallowed — so `dispose()` reported success while the server never disposed its transports, never aborted its handlers, and never cleared its cleanup interval.

**Forced disposal no longer skips transports.** The timeout path iterated the active-transport list while entries were being removed from it, so it could step over some of them.
```

- [ ] **Step 3: Lint**

```bash
rtk proxy pnpm run lint
```

Expected: clean. (Bare `pnpm run lint` is hijacked by a machine-local `rtk` shim into running eslint against this biome repo — use the `rtk proxy` form, or `pnpm exec biome check packages/`.)

- [ ] **Step 4: Full test suite**

```bash
pnpm run test
```

Expected: PASS — type checks and unit tests, every package. This is the gate for the whole branch, not just the tasks above: Task 1 changed the meaning of `signal` for every transport, and this is where a subclass that quietly depended on the old no-op behavior would surface.

- [ ] **Step 5: Commit**

```bash
git add .changeset/
git commit -m "chore: changesets for the abort-signal and release lifecycle fixes"
```

---

## Verification

Done when all of the following hold:

- [ ] `pnpm run test` passes from the repo root (type checks + unit tests, all packages).
- [ ] `rtk proxy pnpm run lint` is clean.
- [ ] Aborting a `signal` passed to any transport fires `disposed` (Task 1).
- [ ] Aborting a `signal` passed to a `SocketTransport` leaves the socket `destroyed` (Task 3 — the end-to-end property, and the reason Tasks 1 and 2 are both needed).
- [ ] A bare `createTransportStream` socket ends up `destroyed` on all three sink exits, including the rejecting-write exit that runs no callback (Task 2).
- [ ] No handler starts from a message read after disposal has begun — including on the replay-cache-failure route, where the `signal` param is never aborted and only `disposer.signal` catches it (Task 4).
- [ ] `Server.dispose()` resolves promptly when the replay cache throws, instead of stranding shutdown until `cleanupTimeoutMs` (Task 4).
- [ ] Every fix has been shown to red its own test when reverted (Task 4 Step 6, and the mutation checks in Tasks 2 and 3). A fix whose revert leaves the suite green is unguarded and must be reported.
- [ ] Three changesets exist; `@enkaku/http-serve` has none, because it only gained a test.

## Out of Scope

Recorded so a reviewer does not flag their absence as an oversight. Both are argued in full in the spec.

- **Linking per-handler `AbortController`s to `ctx.signal`.** Redundant: `handleRequest`, `handleStream`, and `handleChannel` all register their controller in `ctx.controllers`, and the disposer's sweep aborts every entry there. Task 4 closes the only window in which a controller escaped that sweep.
- **Aborting in-flight event handlers.** `handleEvent` registers no controller and exposes no `signal`, so on dispose it is awaited but never aborted. Deliberate — events are fire-and-forget with no reply — and bounded by `cleanupTimeoutMs`. Giving them a signal would add a public field to `EventHandlerContext`, which is a different change.
