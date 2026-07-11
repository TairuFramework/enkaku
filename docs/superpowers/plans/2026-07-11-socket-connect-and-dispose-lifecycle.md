# Socket connect timeout and dispose release — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** planning
**Mode:** tasks
**Spec:** `docs/superpowers/specs/2026-07-11-socket-connect-and-dispose-lifecycle-design.md`

**Goal:** Make `connectSocket` bounded and leak-free, and make `SocketTransport.dispose()` actually release the socket it opened — for every source shape, including function sources.

**Architecture:** Three changes to the single file `packages/socket/src/index.ts`. `connectSocket` gains `{ timeoutMs, signal }`, uses `once` listeners and detaches them on settle, and destroys the pending socket on any abandon path. `createTransportStream`'s writable close callback becomes async: it awaits `socket.end()`'s flush (bounded by a 2s grace) before `unref()`ing. `SocketTransport` memoizes whichever socket its source resolved and registers a `disposed` hook — unconditionally, function sources included — that `destroy()`s it. `Transport.dispose()` closes the writer before emitting `disposed`, so the flush always precedes the destroy.

**Tech Stack:** TypeScript, Node.js `node:net`, vitest, biome, changesets, pnpm workspaces.

## Global Constraints

Copied from `AGENTS.md` — these apply to every task:

- Use `type`, never `interface`.
- Use `Array<T>`, never `T[]`.
- Never use `any` — use `unknown`, `Record<string, unknown>`, or a specific type.
- Uppercase abbreviations in names: `ID` not `Id`, `HTTP` not `Http`, `JWT` not `Jwt`.
- Use `pnpm`/`pnpx`, never `npm`/`npx`.
- Never edit generated files (`lib/`, `website/docs/api/**` — the latter is typedoc output).
- Lint with `rtk proxy pnpm run lint` (a shell shim hijacks a bare `pnpm run lint`).
- Do not create new packages.

Behaviour constants fixed by the spec:

- Default connect timeout: `10_000` ms. `timeoutMs: 0` disables it.
- Writable close flush grace: `2_000` ms, hardcoded, no option exposed.

---

## File Structure

| File | Responsibility | Tasks |
|------|----------------|-------|
| `packages/socket/src/index.ts` | All three changes — the package is a single module by existing convention | 1, 2, 3 |
| `packages/socket/test/connect.test.ts` | New. `connectSocket` timeout / abort / listener-cleanup tests, using a mocked `node:net` for the hang cases | 1 |
| `packages/socket/test/lib.test.ts` | Existing. Add a flush-on-close test; update the two dispose tests that assert the old `unref()`-only behaviour | 2, 3 |
| `tests/integration/socket-dispose-releases-server.test.ts` | New. End-to-end regression: a draining server closes once the client transport disposes | 4 |
| `.changeset/socket-connect-and-dispose-lifecycle.md` | New. Minor bump for `@enkaku/socket`, documenting three behaviour changes | 4 |

---

## Task 1: Bounded, leak-free `connectSocket`

**Files:**
- Modify: `packages/socket/src/index.ts:24-42` (the `connectSocket` function)
- Create: `packages/socket/test/connect.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `export type ConnectSocketOptions = { timeoutMs?: number; signal?: AbortSignal }`
  - `export function connectSocket(path: string, options?: ConnectSocketOptions): Promise<Socket>` — Task 3 calls this with `{ timeoutMs: connectTimeoutMs, signal }`.

**Why the tests mock `node:net`:** a Unix socket connect either succeeds immediately (a listener exists) or fails immediately with `ECONNREFUSED` (a stale socket file). There is no way to make a real local connect *hang*, which is exactly the case the timeout exists for. So the timeout and abort tests replace `createConnection` with a fake socket that never emits `connect`. The listener-cleanup test uses a real server, because it asserts on a real `Socket`.

- [ ] **Step 1: Write the failing tests**

Create `packages/socket/test/connect.test.ts`:

```ts
import { EventEmitter } from 'node:events'
import { createServer, type Socket, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'

// `connectSocket` is the unit under test; `createConnection` is mocked below so
// a connect attempt can be made to hang, which a real Unix socket cannot do.
const createConnectionMock = vi.hoisted(() => vi.fn())
vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>()
  return { ...actual, createConnection: createConnectionMock }
})

const { connectSocket } = await import('../src/index.js')

/** A socket that connects to nothing and never emits 'connect'. */
function hangingSocket(): Socket & { destroy: ReturnType<typeof vi.fn> } {
  const socket = new EventEmitter() as unknown as Socket & {
    destroy: ReturnType<typeof vi.fn>
  }
  socket.destroy = vi.fn(() => socket)
  return socket
}

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-connect-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const server = createServer()
    server.listen(socketPath, () => {
      resolve({ server, socketPath })
    })
  })
}

afterEach(() => {
  createConnectionMock.mockReset()
})

describe('connectSocket() timeout', () => {
  test('rejects and destroys the socket when the connect attempt times out', async () => {
    const socket = hangingSocket()
    createConnectionMock.mockReturnValue(socket)

    await expect(connectSocket('/hangs.sock', { timeoutMs: 20 })).rejects.toThrow(
      'Socket connect timed out after 20ms',
    )
    // The abandoned attempt must not leave a pending socket behind
    expect(socket.destroy).toHaveBeenCalled()
    expect(socket.listenerCount('connect')).toBe(0)
  })

  test('timeoutMs: 0 disables the timeout', async () => {
    const socket = hangingSocket()
    createConnectionMock.mockReturnValue(socket)

    let settled = false
    const promise = connectSocket('/hangs.sock', { timeoutMs: 0 })
    promise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(settled).toBe(false)
    expect(socket.destroy).not.toHaveBeenCalled()

    // Let it connect so the test doesn't leave a dangling promise
    socket.emit('connect')
    await expect(promise).resolves.toBe(socket)
  })
})

describe('connectSocket() signal', () => {
  test('rejects without connecting when the signal is already aborted', async () => {
    const reason = new Error('nope')
    await expect(
      connectSocket('/hangs.sock', { signal: AbortSignal.abort(reason) }),
    ).rejects.toThrow('nope')
    expect(createConnectionMock).not.toHaveBeenCalled()
  })

  test('rejects and destroys the socket when aborted mid-flight', async () => {
    const socket = hangingSocket()
    createConnectionMock.mockReturnValue(socket)
    const controller = new AbortController()

    const promise = connectSocket('/hangs.sock', { signal: controller.signal })
    controller.abort(new Error('shutting down'))

    await expect(promise).rejects.toThrow('shutting down')
    expect(socket.destroy).toHaveBeenCalled()
  })
})

describe('connectSocket() listener hygiene', () => {
  test('leaves no listeners attached once the connect succeeds', async () => {
    const actualNet = await vi.importActual<typeof import('node:net')>('node:net')
    createConnectionMock.mockImplementation(actualNet.createConnection)
    const { server, socketPath } = await createTestServer()

    const socket = await connectSocket(socketPath)

    // A settled promise must not keep listeners (and its closure) alive for the
    // whole life of the socket -- the 'error' one in particular used to stay
    // attached forever, calling reject() on an already-settled promise.
    expect(socket.listenerCount('connect')).toBe(0)
    expect(socket.listenerCount('error')).toBe(0)

    socket.destroy()
    server.close()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @enkaku/socket exec vitest run test/connect.test.ts`

Expected: FAIL. The timeout tests hang until vitest's own test timeout, the abort tests fail with a timeout or an unrejected promise, and the listener test fails with `expected 1 to be 0` (both listeners are still attached).

- [ ] **Step 3: Implement the bounded connect**

In `packages/socket/src/index.ts`, replace the whole `connectSocket` function (lines 24-42) with:

```ts
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000

export type ConnectSocketOptions = {
  /** Milliseconds before the connect attempt is abandoned. Defaults to 10_000. `0` disables the timeout. */
  timeoutMs?: number
  /** Aborts a pending connect attempt, destroying the socket. */
  signal?: AbortSignal
}

export async function connectSocket(
  path: string,
  options: ConnectSocketOptions = {},
): Promise<Socket> {
  const { timeoutMs = DEFAULT_CONNECT_TIMEOUT_MS, signal } = options
  return withSpan(
    tracer,
    EnkakuSpanNames.TRANSPORT_SOCKET_CONNECT,
    {
      attributes: {
        [EnkakuAttributeKeys.TRANSPORT_TYPE]: 'socket',
        [AttributeKeys.NET_PEER_NAME]: path,
      },
    },
    async () => {
      signal?.throwIfAborted()
      const socket = createConnection(path)
      return new Promise<Socket>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined

        function cleanup(): void {
          if (timer != null) {
            clearTimeout(timer)
          }
          socket.off('connect', onConnect)
          socket.off('error', onError)
          signal?.removeEventListener('abort', onAbort)
        }
        function onConnect(): void {
          cleanup()
          resolve(socket)
        }
        function onError(error: Error): void {
          cleanup()
          reject(error)
        }
        function abandon(reason: unknown): void {
          cleanup()
          // The abandoned attempt may still fail (a late ECONNREFUSED). With no
          // 'error' listener at all, Node escalates that to an uncaught throw.
          socket.on('error', () => {})
          socket.destroy()
          reject(reason)
        }
        function onAbort(): void {
          abandon(signal?.reason ?? new Error('Socket connect aborted'))
        }

        socket.once('connect', onConnect)
        socket.once('error', onError)
        signal?.addEventListener('abort', onAbort, { once: true })

        if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
          timer = setTimeout(() => {
            abandon(new Error(`Socket connect timed out after ${timeoutMs}ms`))
          }, timeoutMs)
          // The timer must not hold the event loop open on its own
          timer.unref()
        }
      })
    },
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @enkaku/socket exec vitest run test/connect.test.ts test/lib.test.ts`

Expected: PASS. `connect.test.ts` fully green, and `lib.test.ts`'s existing `connectSocket()` tests (`connects to a Unix socket`, `rejects when socket path does not exist`) still pass — the default timeout must not break them.

- [ ] **Step 5: Type check and lint**

Run: `pnpm --filter @enkaku/socket exec tsc --noEmit -p tsconfig.test.json`
Expected: no output (success).

Run: `rtk proxy pnpm run lint`
Expected: biome reports no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/socket/src/index.ts packages/socket/test/connect.test.ts
git commit -m "feat(socket): bound connectSocket with a timeout and abort signal

Both listeners were 'on' and never detached, so the 'error' one stayed
attached for the socket's whole life, rejecting an already-settled promise
on every later error. They are now 'once' and detached on settle, and an
abandoned attempt destroys its pending socket."
```

---

## Task 2: Flush pending writes before releasing the socket

**Files:**
- Modify: `packages/socket/src/index.ts:145-163` (the `writeTo` close callback in `createTransportStream`)
- Test: `packages/socket/test/lib.test.ts` (add one test to the existing `createTransportStream()` describe block)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `writer.close()` on a `createTransportStream` writable now resolves only once buffered writes have flushed. Task 3 depends on this: its `destroy()` hook runs after the writer closes, and would otherwise cut off queued bytes.

**Background:** `writeTo(write, close)` from `@sozai/stream` passes `close` straight to `new WritableStream({ write, close })`. `close` is an `UnderlyingSinkCloseCallback`, so returning a promise makes `writer.close()` await it. Today the callback is synchronous: it calls `socket.end()` and returns immediately, so `writer.close()` resolves while bytes are still queued in the socket's internal buffer.

- [ ] **Step 1: Write the failing test**

Add to `packages/socket/test/lib.test.ts`, inside the existing `describe('createTransportStream()', ...)` block:

```ts
  test('flushes buffered writes before the writer close resolves', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const stream = await createTransportStream<unknown, { payload: string }>(socket)

    // Large enough to exceed the socket's write buffer, so the bytes cannot
    // possibly have reached the peer by the time end() is called.
    const payload = 'x'.repeat(2_000_000)
    let receivedBytes = 0
    const serverDone = new Promise<void>((resolve) => {
      serverSocket.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length
      })
      serverSocket.on('end', resolve)
    })

    const writer = stream.writable.getWriter()
    // Deliberately not awaited: the close below must flush whatever is queued.
    void writer.write({ payload })
    await writer.close()

    await serverDone
    // The full JSON line, not a truncated prefix
    expect(receivedBytes).toBe(JSON.stringify({ payload }).length + 1)

    socket.destroy()
    serverSocket.destroy()
    server.close()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @enkaku/socket exec vitest run test/lib.test.ts -t 'flushes buffered writes'`

Expected: FAIL. `writer.close()` resolves before the payload has flushed, so the assertion sees a truncated byte count (or the test times out waiting for `end`).

- [ ] **Step 3: Make the close callback flush**

In `packages/socket/src/index.ts`, add the grace constant next to `DEFAULT_HIGH_WATER_MARK`:

```ts
const END_GRACE_MS = 2_000 // Max wait for a half-close to flush before giving up
```

Then replace the close callback passed to `writeTo` (the second argument, currently `() => { socket.end(); socket.unref() }`) with:

```ts
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
      // Release the half-closed socket so it stops holding the event loop open
      socket.unref()
    },
```

The `write` callback above it is unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @enkaku/socket exec vitest run`

Expected: PASS, all files. `write-after-close.test.ts` in particular must stay green — its `fakeSocket` is a `PassThrough`, whose `end(callback)` fires on `finish`, and its two write-after-close cases hit the `destroyed` / `writableEnded` early-return in the new callback.

- [ ] **Step 5: Type check and lint**

Run: `pnpm --filter @enkaku/socket exec tsc --noEmit -p tsconfig.test.json`
Expected: no output.

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/socket/src/index.ts packages/socket/test/lib.test.ts
git commit -m "fix(socket): flush buffered writes before releasing the socket

The writable's close callback returned before socket.end() had flushed, so
writer.close() resolved with bytes still queued. It now awaits the flush,
bounded by a 2s grace so a stalled peer cannot hang the close."
```

---

## Task 3: Release the socket on `SocketTransport` dispose, for every source shape

**Files:**
- Modify: `packages/socket/src/index.ts:168-190` (`SocketTransportParams` and the `SocketTransport` class)
- Test: `packages/socket/test/lib.test.ts` (update two existing tests in the `SocketTransport` describe block, add two)

**Interfaces:**
- Consumes: `connectSocket(path, { timeoutMs, signal })` from Task 1; the flushing close callback from Task 2 (which is what makes `destroy()` safe to run right after).
- Produces:
  - `SocketTransportParams<R>` gains `connectTimeoutMs?: number`.
  - `SocketTransport.dispose()` now destroys the socket the transport opened.

**Key constraint (do not design around a problem that doesn't exist):** `Transport._getStream()` in `packages/transport/src/index.ts:88-94` memoizes the stream, so the `stream` thunk — and therefore a function `source` — is invoked **at most once per transport instance**. Reconnection means a new transport per attempt. There is no "current socket across reconnects" to track: capture the one socket this transport resolved and you are done.

**Ordering:** `Transport`'s dispose (`packages/transport/src/index.ts:64-78`) emits `disposing`, closes the writer *if a stream was ever created*, then emits `disposed`. The hook below runs on `disposed`, so the Task 2 flush always completes before `destroy()`. That makes `ERR_STREAM_DESTROYED` from `end()`ing a destroyed socket unreachable, rather than merely absorbed.

- [ ] **Step 1: Update the two tests that assert the old behaviour, and write two new ones**

In `packages/socket/test/lib.test.ts`, inside `describe('SocketTransport', ...)`, replace the test named `'releases the socket handle on dispose without destroying it'` (currently at lines 282-307) with:

```ts
  test('destroys the socket on dispose', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const unrefSpy = vi.spyOn(socket, 'unref')

    const transport = new SocketTransport<{ n: number }, unknown>({ socket })

    // Drive a round-trip so the stream is established
    serverSocket.write('{"n":1}\n')
    const result = await transport.read()
    expect(result.value).toEqual({ n: 1 })

    await transport.dispose()

    // The writer close flushed and half-closed it, then the disposed hook
    // destroyed it -- unref() alone left the peer seeing a live connection.
    expect(unrefSpy).toHaveBeenCalled()
    expect(socket.writableEnded).toBe(true)
    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  })
```

Then replace the test named `'releases the socket handle on dispose when the stream was never used'` (currently at lines 309-329) with:

```ts
  test('destroys the socket on dispose when the stream was never used', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise

    // Construct the transport but never read/write: the lazily-created transport
    // stream is never materialized, so the writable-close cleanup never runs and
    // the disposed hook is the only path that can release the socket.
    const transport = new SocketTransport<{ n: number }, unknown>({ socket })

    await transport.dispose()

    expect(socket.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  })
```

Then add these two new tests to the same describe block:

```ts
  test('destroys the socket opened by a function source on dispose', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    // The reconnecting-client shape: the socket is created by the source, so
    // the caller has no handle on it and cannot release it itself.
    let opened: NetSocket | undefined
    const transport = new SocketTransport<{ n: number }, unknown>({
      socket: async () => {
        opened = await connectSocket(socketPath)
        return opened
      },
    })
    const serverSocket = await connectionPromise

    serverSocket.write('{"n":3}\n')
    const result = await transport.read()
    expect(result.value).toEqual({ n: 3 })

    await transport.dispose()

    expect(opened?.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  })

  test('opens no socket when a function source transport is disposed unused', async () => {
    const { server, socketPath } = await createTestServer()

    let calls = 0
    const transport = new SocketTransport<{ n: number }, unknown>({
      socket: () => {
        calls++
        return connectSocket(socketPath)
      },
    })

    await transport.dispose()

    // Nothing was ever connected, so there is nothing to release -- and dispose
    // must not connect one just to destroy it.
    expect(calls).toBe(0)

    server.close()
  })
```

The `NetSocket` type is already imported at the top of the file (`import { createServer, type Socket as NetSocket, type Server } from 'node:net'`).

Finally, cover the remaining source shape. The existing test `'accepts a Promise<Socket>'` (currently at lines 264-280) exercises a `Promise<Socket>` source but never asserts on the release. Give it a handle on the socket and assert it. Replace it with:

```ts
  test('accepts a Promise<Socket> and destroys it on dispose', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    let opened: NetSocket | undefined
    const socketPromise = connectSocket(socketPath).then((sock) => {
      opened = sock
      return sock
    })
    const transport = new SocketTransport<{ n: number }, unknown>({ socket: socketPromise })
    const serverSocket = await connectionPromise

    serverSocket.write('{"n":7}\n')
    const result = await transport.read()
    expect(result.value).toEqual({ n: 7 })

    await transport.dispose()

    expect(opened?.destroyed).toBe(true)

    serverSocket.destroy()
    server.close()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @enkaku/socket exec vitest run test/lib.test.ts -t 'destroys the socket'`

Expected: FAIL on all three `destroys the socket…` tests with `expected false to be true` — dispose only `unref()`s today, and the function-source case registers no hook at all. (`opens no socket when a function source transport is disposed unused` passes already; it is a guard against the fix over-reaching.)

- [ ] **Step 3: Implement the release hook**

In `packages/socket/src/index.ts`, replace `SocketTransportParams` and the `SocketTransport` class (lines 168-190) with:

```ts
export type SocketTransportParams<R> = CreateTransportStreamOptions<R> & {
  socket: SocketSource | string
  signal?: AbortSignal
  /** Connect timeout when `socket` is a path, in milliseconds. Defaults to 10_000. `0` disables it. */
  connectTimeoutMs?: number
}

export class SocketTransport<R, W> extends Transport<R, W> {
  constructor(params: SocketTransportParams<R>) {
    const { connectTimeoutMs, socket, signal, ...options } = params
    const source: SocketSource =
      typeof socket === 'string'
        ? () => connectSocket(socket, { timeoutMs: connectTimeoutMs, signal })
        : socket

    // Memoized so the socket this transport opened can be released on dispose.
    // Transport caches the stream, so a function source is invoked at most once.
    let socketPromise: Promise<Socket> | undefined =
      typeof source === 'function' ? undefined : Promise.resolve(source)
    function getSocket(): Promise<Socket> {
      socketPromise ??= Promise.resolve((source as () => SocketOrPromise)())
      return socketPromise
    }

    super({ stream: () => createTransportStream(getSocket, options), signal })

    this.events.on('disposed', async () => {
      if (socketPromise == null) {
        // A function source that was never invoked opened no socket to release
        return
      }
      try {
        const sock = await socketPromise
        // unref() only stops the socket holding the event loop open -- it stays
        // open, and the peer's server keeps seeing a live connection.
        sock.destroy()
      } catch {
        // Socket failed to connect or is already gone; nothing to release
      }
    })
  }
}
```

A `string` path is now connected lazily, on first read/write, rather than eagerly in the constructor. A transport that is constructed and never used opens no socket at all, and the params' `signal` now also aborts a pending connect.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @enkaku/socket exec vitest run`

Expected: PASS, all files.

- [ ] **Step 5: Type check and lint**

Run: `pnpm --filter @enkaku/socket exec tsc --noEmit -p tsconfig.test.json`
Expected: no output.

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/socket/src/index.ts packages/socket/test/lib.test.ts
git commit -m "fix(socket): destroy the socket on SocketTransport dispose

The disposed hook only unref()d the socket -- which leaves it open, so a peer
draining its connections before closing waits forever -- and skipped function
sources entirely, so a reconnecting transport released nothing at all. The hook
is now registered for every source shape and destroys whichever socket the
transport opened.

BREAKING: dispose() now closes the socket instead of leaving it open, and a
string path connects lazily rather than in the constructor."
```

---

## Task 4: End-to-end regression test, changeset, docs

**Files:**
- Create: `tests/integration/socket-dispose-releases-server.test.ts`
- Create: `.changeset/socket-connect-and-dispose-lifecycle.md`
- Modify: `docs/skills/transport.skill.md` (the `SocketTransport` section, around line 89)

**Interfaces:**
- Consumes: everything from Tasks 1-3. The integration test imports from `@enkaku/socket`, which resolves to the **built** `lib/`, so the package must be built before the test runs.

**This is the tejika bug, verbatim:** a server that awaits its connections draining before closing hung forever, because the client's `dispose()` left the socket open. Nothing in the unit tests covers it, because it needs a real server observing a real connection count.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/socket-dispose-releases-server.test.ts`:

```ts
import { createServer, type Socket, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { SocketTransport } from '@enkaku/socket'

function createTestServer(): Promise<{ server: Server; socketPath: string }> {
  return new Promise((resolve) => {
    const socketPath = join(
      tmpdir(),
      `enkaku-dispose-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const server = createServer()
    server.listen(socketPath, () => {
      resolve({ server, socketPath })
    })
  })
}

/** Resolves once the server has closed -- which only happens after every connection is gone. */
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      error ? reject(error) : resolve()
    })
  })
}

describe('SocketTransport dispose releases the peer server', () => {
  test('a draining server closes once the client transport disposes', async () => {
    const { server, socketPath } = await createTestServer()
    const connections: Array<Socket> = []
    server.on('connection', (socket) => {
      connections.push(socket)
    })

    // The reconnecting-client shape: a function source, used bare without a Client
    const transport = new SocketTransport<{ n: number }, { n: number }>({
      socket: socketPath,
    })
    await transport.write({ n: 1 })
    expect(connections).toHaveLength(1)

    await transport.dispose()

    // server.close() waits for its open connections. If dispose only unref()d the
    // socket, the connection stays live and this never resolves.
    await expect(
      Promise.race([
        closeServer(server),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('server did not close: connection still open')), 2000),
        ),
      ]),
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Prove the test catches the bug, then confirm the fix**

The integration test imports the built `lib/`, so it needs a build. Build the *pre-fix* source first, to watch the test fail the way tejika did:

```bash
git stash push -- packages/socket/src/index.ts
rtk proxy pnpm --filter @enkaku/socket run build
pnpm --filter integration-tests exec vitest run socket-dispose-releases-server.test.ts
```

Expected: FAIL with `server did not close: connection still open` — the pre-fix `dispose()` only `unref()`s, so the server's connection stays live and `server.close()` never calls back.

Then restore the fix and rebuild:

```bash
git stash pop
rtk proxy pnpm --filter @enkaku/socket run build
pnpm --filter integration-tests exec vitest run socket-dispose-releases-server.test.ts
```

Expected: PASS.

- [ ] **Step 3: Write the changeset**

Create `.changeset/socket-connect-and-dispose-lifecycle.md`:

```markdown
---
'@enkaku/socket': minor
---

Socket connect and dispose lifecycle.

- `connectSocket(path, options?)` accepts `{ timeoutMs, signal }`. The connect attempt now times out after **10 seconds by default** — pass `timeoutMs: 0` for the previous unbounded behaviour. An abandoned attempt (timeout or abort) destroys its pending socket, and both the `connect` and `error` listeners are detached once the promise settles (the `error` one previously stayed attached for the socket's whole life).
- The transport stream's writable close callback now awaits `socket.end()`'s flush, bounded by a 2 second grace, so `writer.close()` no longer resolves with bytes still queued.
- **`SocketTransport.dispose()` now destroys the socket** rather than only `unref()`ing it, and does so for every source shape — including a function source, which previously registered no release hook at all. `unref()` left the socket open, so a peer server draining its connections before closing would wait forever. A transport built from a function source that was never read from or written to opens no socket, and therefore has none to release.
- `SocketTransportParams` accepts `connectTimeoutMs`, applied when `socket` is a path string. Such a path is now connected **lazily**, on first read/write, rather than eagerly in the constructor.
```

- [ ] **Step 4: Update the transport skill doc**

In `docs/skills/transport.skill.md`, in the `SocketTransport` section (the example around line 89), note the two behaviour changes so the doc doesn't teach the old contract. Add after the existing `SocketTransport` example:

```markdown
`connectSocket(path, { timeoutMs, signal })` bounds the connect attempt (10s by default; `timeoutMs: 0` disables). `SocketTransport` accepts `connectTimeoutMs` when `socket` is a path string, and connects lazily on first read/write.

`transport.dispose()` flushes pending writes, then **destroys** the socket — including one opened by a function source. Do not also destroy it yourself; a second `destroy()` is a no-op, but the transport already owns the release.
```

- [ ] **Step 5: Run the full test suite**

Run: `rtk proxy pnpm run test`
Expected: PASS across all packages — this catches any other consumer of `@enkaku/socket` that relied on the socket surviving dispose.

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/socket-dispose-releases-server.test.ts .changeset/socket-connect-and-dispose-lifecycle.md docs/skills/transport.skill.md
git commit -m "test(socket): regression test for a draining server hanging on dispose

Adds the tejika failure as an integration test: a server awaiting its
connections before closing must close once the client transport disposes."
```

---

## Out of scope

- `website/docs/api/socket-transport/index.md` is typedoc output. It regenerates from the source doc comments; do not hand-edit it.
- No option is exposed for the 2s flush grace, and none for a default `connectTimeoutMs` on `SocketTransport` beyond passing it through. Add them if a consumer asks.
