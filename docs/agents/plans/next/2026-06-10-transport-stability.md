# Transport Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the transport-edge stability bugs from the June 2026 audit (Plan 2 of `2026-06-10-audit-remediation-design.md`): process crashes, UTF-8 corruption, silent read-loop death, inflight leaks, swallowed disconnects, hanging disposers, and the folded-in medium-severity client/transport fixes.

**Architecture:** Each fix is local to one transport/stream/lifecycle module and verified by an attack-shaped or failure-shaped regression test, following the existing zero-unhandled-rejection pattern from `tests/integration/server-teardown-no-unhandled.test.ts`. Tasks are ordered so the repo stays green after every commit: socket crash guard first, then the JSON-lines decoder it depends on, then server/HTTP lifecycle fixes, then the medium-severity items, finishing with a cross-package integration test.

**Tech Stack:** TypeScript, vitest, web streams, Node net/streams

**Out of scope (backlogged per design doc):** reconnect logic, backpressure redesign, client-side default request timeout.

**Conventions reminder:** `type` not `interface`, `Array<T>` not `T[]`, no `any` (use `unknown`), uppercase abbreviations (`ID`, `HTTP`, `SSE`, `UTF8` as `UTF-8` in prose), pnpm only. Lint with `rtk proxy pnpm run lint`.

**Design-doc deltas found against actual source (already reflected in the tasks below):**
1. `ServerEvents` has no transport-error event today (`packages/server/src/types.ts:170-191`) — Task 4 adds `transportError: { error: Error }`.
2. `Disposer` has no event emitter or logger (`packages/async/src/disposer.ts`) — Task 7 surfaces dispose-callback rejection via a new optional `onDisposeError` param (fallback `console.warn`) and always resolves `disposed`.
3. `@enkaku/stream` only depends on `@enkaku/async`, so the default `onInvalidJSON` (Task 15) surfaces via `console.warn`, not an event emitter.
4. `TransportEvents.writeFailed` requires `rid: string` (`packages/transport/src/index.ts:22`) but node-streams pipe failures have no rid — Task 13 relaxes it to `rid?: string` (the server-side `ServerEvents.writeFailed` is already `rid?: string`).
5. The existing http-client-transport tests `errors the readable stream when POST returns non-ok response` (line 155) and the `createSSEResponse` helper auto-close behavior (line 21-47) assert the OLD broken behavior — Tasks 6 and 10 update them.

---

### Task 1: socket-transport — guard controller after close/error, detach listeners

The `close` event after an `error` event calls `controller.close()` on an already-errored controller, which throws inside the Node `EventEmitter` callback → `uncaughtException` → process crash (`packages/socket-transport/src/index.ts:46-53`).

**Files:**
- Modify: `packages/socket-transport/src/index.ts` (lines 46-54, the `readable` in `createTransportStream`)
- Test: `packages/socket-transport/test/lib.test.ts` (add to existing `createTransportStream() error handling` describe block)

- [ ] Write the failing test in `packages/socket-transport/test/lib.test.ts`, inside the existing `describe('createTransportStream() error handling', ...)` block (the file already imports `connectSocket`, `createTransportStream`, and defines `createTestServer`/`waitForConnection`):

```ts
  test('socket error followed by close does not throw an uncaught exception', async () => {
    const uncaught: Array<unknown> = []
    const onUncaught = (error: unknown) => {
      uncaught.push(error)
    }
    process.on('uncaughtException', onUncaught)
    try {
      const { server, socketPath } = await createTestServer()
      const connectionPromise = waitForConnection(server)

      const socket = await connectSocket(socketPath)
      const serverSocket = await connectionPromise
      const stream = await createTransportStream<unknown, unknown>(socket)
      const reader = stream.readable.getReader()

      // destroy(error) emits 'error' then 'close' on the socket
      socket.destroy(new Error('boom'))
      await expect(reader.read()).rejects.toThrow('boom')

      // Let the trailing 'close' event fire — pre-fix this calls
      // controller.close() on an errored controller → uncaughtException
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(uncaught, `uncaught exceptions: ${uncaught.map(String).join(', ')}`).toHaveLength(0)

      serverSocket.destroy()
      server.close()
    } finally {
      process.off('uncaughtException', onUncaught)
    }
  })
```

- [ ] Run it and confirm FAIL (uncaught array contains a `TypeError` from `controller.close()`): `pnpm --filter @enkaku/socket-transport run test:unit -- test/lib.test.ts`
- [ ] Implement the fix in `packages/socket-transport/src/index.ts`. Replace the current `readable` construction (lines 46-54):

```ts
  const readable = new ReadableStream({
    start(controller) {
      socket.on('data', (buffer) => {
        controller.enqueue(buffer.toString())
      })
      socket.on('close', () => controller.close())
      socket.on('error', (err) => controller.error(err))
    },
  }).pipeThrough(fromJSONLines<R>(options))
```

with a settled-state guard that detaches all listeners once the stream settles:

```ts
  const readable = new ReadableStream<string>({
    start(controller) {
      let settled = false
      function onData(buffer: Buffer): void {
        if (!settled) {
          controller.enqueue(buffer.toString())
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
```

- [ ] Run the full package test suite and confirm PASS: `pnpm --filter @enkaku/socket-transport run test:unit`
- [ ] Commit:

```sh
git add packages/socket-transport/src/index.ts packages/socket-transport/test/lib.test.ts
git commit -m "fix(socket-transport): guard stream controller after close/error and detach listeners"
```

---

### Task 2: stream — per-stream TextDecoder with streaming decode in fromJSONLines

`packages/stream/src/json-lines.ts:5` declares a single module-level `TextDecoder` shared by every `fromJSONLines` instance, and line 76 calls `decoder.decode(chunk)` without `{ stream: true }`. Multi-byte UTF-8 sequences split across chunk boundaries decode as U+FFFD replacement characters, corrupting message contents (this is live today for `node-streams-transport`, which feeds `Uint8Array` chunks).

**Files:**
- Modify: `packages/stream/src/json-lines.ts` (lines 5, 21-23, 76, 109-110)
- Test: `packages/stream/test/json-lines.test.ts`

- [ ] Add two failing tests to the `describe('fromJSONLines()', ...)` block in `packages/stream/test/json-lines.test.ts`:

```ts
  test('decodes multi-byte UTF-8 characters split across chunks', async () => {
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines()).pipeTo(sink)

    const bytes = new TextEncoder().encode('{"text":"héllo 🌍"}\n')
    // Split inside the 2-byte 'é' (bytes 10-11) and inside the 4-byte '🌍' (bytes 16-19)
    controller.enqueue(bytes.slice(0, 11))
    controller.enqueue(bytes.slice(11, 18))
    controller.enqueue(bytes.slice(18))
    controller.close()

    await expect(result).resolves.toEqual([{ text: 'héllo 🌍' }])
  })

  test('keeps decoder state isolated between concurrent streams', async () => {
    const [sourceA, controllerA] = createReadable()
    const [sourceB, controllerB] = createReadable()
    const [sinkA, resultA] = createArraySink()
    const [sinkB, resultB] = createArraySink()
    sourceA.pipeThrough(fromJSONLines()).pipeTo(sinkA)
    sourceB.pipeThrough(fromJSONLines()).pipeTo(sinkB)

    const bytesA = new TextEncoder().encode('{"a":"é"}\n')
    const bytesB = new TextEncoder().encode('{"b":"ü"}\n')
    // Interleave chunks from both streams, splitting inside each 2-byte character (bytes 6-7)
    controllerA.enqueue(bytesA.slice(0, 7))
    controllerB.enqueue(bytesB.slice(0, 7))
    controllerA.enqueue(bytesA.slice(7))
    controllerB.enqueue(bytesB.slice(7))
    controllerA.close()
    controllerB.close()

    await expect(resultA).resolves.toEqual([{ a: 'é' }])
    await expect(resultB).resolves.toEqual([{ b: 'ü' }])
  })
```

- [ ] Run and confirm FAIL (replacement characters in decoded strings): `pnpm --filter @enkaku/stream run test:unit -- test/json-lines.test.ts`
- [ ] Implement in `packages/stream/src/json-lines.ts`:
  1. Delete the module-level declaration at line 5: `const decoder = new TextDecoder()`
  2. Inside `fromJSONLines`, right after the options destructuring (line 21), add a per-stream decoder:

```ts
  const { decode = JSON.parse, maxBufferSize, maxMessageSize, onInvalidJSON } = options

  const decoder = new TextDecoder()
  let input = ''
```

  3. In the transform callback (line 76), use streaming decode:

```ts
        input += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
```

  4. In the flush callback (line 109), flush the decoder's pending bytes before processing the remaining input:

```ts
    (controller) => {
      input += decoder.decode()
      for (const char of input) {
        processChar(char)
      }
```

- [ ] Run and confirm PASS: `pnpm --filter @enkaku/stream run test:unit`
- [ ] Commit:

```sh
git add packages/stream/src/json-lines.ts packages/stream/test/json-lines.test.ts
git commit -m "fix(stream): per-stream TextDecoder with streaming decode in fromJSONLines"
```

---

### Task 3: socket-transport — pass raw Buffers to fromJSONLines (UTF-8 over the wire)

`packages/socket-transport/src/index.ts` (now Task 1's `onData`) still calls `buffer.toString()` per chunk, which corrupts multi-byte UTF-8 sequences split across TCP chunks before they ever reach the (now streaming-safe) decoder. Pass the raw `Buffer` (a `Uint8Array`) through instead — `fromJSONLines` accepts `Uint8Array | string`.

**Files:**
- Modify: `packages/socket-transport/src/index.ts` (the `onData` handler and the `ReadableStream` type parameter from Task 1)
- Test: `packages/socket-transport/test/lib.test.ts`

- [ ] Write the failing test in `packages/socket-transport/test/lib.test.ts` (in the `describe('createTransportStream()', ...)` block):

```ts
  test('decodes multi-byte UTF-8 characters split across socket chunks', async () => {
    const { server, socketPath } = await createTestServer()
    const connectionPromise = waitForConnection(server)

    const socket = await connectSocket(socketPath)
    const serverSocket = await connectionPromise
    const stream = await createTransportStream<{ text: string }, unknown>(socket)

    const bytes = Buffer.from('{"text":"héllo 🌍"}\n', 'utf8')
    // Write byte-by-byte with a small delay so multi-byte sequences are
    // guaranteed to arrive in separate 'data' events
    for (let i = 0; i < bytes.length; i++) {
      serverSocket.write(bytes.subarray(i, i + 1))
      await new Promise((resolve) => setTimeout(resolve, 1))
    }

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual({ text: 'héllo 🌍' })

    reader.releaseLock()
    socket.destroy()
    serverSocket.destroy()
    server.close()
  })
```

- [ ] Run and confirm FAIL (replacement characters from per-chunk `toString()`): `pnpm --filter @enkaku/socket-transport run test:unit -- test/lib.test.ts`
- [ ] Implement: in `packages/socket-transport/src/index.ts`, change the stream type and `onData` from Task 1's version:

```ts
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      let settled = false
      function onData(buffer: Buffer): void {
        if (!settled) {
          controller.enqueue(buffer)
        }
      }
```

(`Buffer` is a `Uint8Array` subclass; everything else from Task 1 stays unchanged.)
- [ ] Run and confirm PASS: `pnpm --filter @enkaku/socket-transport run test:unit`
- [ ] Commit:

```sh
git add packages/socket-transport/src/index.ts packages/socket-transport/test/lib.test.ts
git commit -m "fix(socket-transport): pass raw buffers to fromJSONLines to preserve UTF-8 across chunk boundaries"
```

---

### Task 4: server — survive transport read errors, settle `handle().done`, emit `transportError`

`handleNext` (`packages/server/src/server.ts:521-524`) calls `await transport.read()` with no try/catch. A read rejection kills the loop as an unhandled rejection, `disposer.dispose()` is never called, and the promise returned by `Server#handle` never settles.

**Files:**
- Modify: `packages/server/src/server.ts` (lines 521-525), `packages/server/src/types.ts` (`ServerEvents`, line 170-191)
- Test: `packages/server/test/transport-read-failure.test.ts` (new file)

- [ ] Add the new event to `ServerEvents` in `packages/server/src/types.ts` (alphabetical position, after `transportAdded`):

```ts
  transportAdded: { transportID: string }
  transportError: { error: Error }
  transportRemoved: { transportID: string; reason?: unknown }
```

- [ ] Write the failing test at `packages/server/test/transport-read-failure.test.ts`:

```ts
import type { ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { Server } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Transport read failure', () => {
  test('settles handle() and emits transportError when transport.read() rejects', async () => {
    const failingTransport = {
      read: vi.fn(() => Promise.reject(new Error('read boom'))),
      write: vi.fn(() => Promise.resolve()),
      dispose: vi.fn(() => Promise.resolve()),
    } as unknown as ServerTransportOf<Protocol>

    const server = new Server<Protocol>({ handlers: { test: vi.fn() }, protocol })
    const transportError = vi.fn()
    server.events.on('transportError', transportError)

    // Pre-fix this promise never settles (test times out)
    await expect(server.handle(failingTransport)).resolves.toBeUndefined()

    expect(transportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Transport read failed' }),
      }),
    )

    await server.dispose()
  })
})
```

- [ ] Run and confirm FAIL (test times out waiting for `handle()` to settle): `pnpm --filter @enkaku/server run test:unit -- test/transport-read-failure.test.ts`
- [ ] Implement in `packages/server/src/server.ts`. Replace the top of `handleNext` (lines 521-526):

```ts
  async function handleNext() {
    const next = await transport.read()
    if (next.done) {
      await disposer.dispose()
      return
    }
```

with:

```ts
  async function handleNext() {
    let next: ReadableStreamReadResult<AnyClientMessageOf<Protocol>>
    try {
      next = await transport.read()
    } catch (cause) {
      const error = new Error('Transport read failed', { cause })
      logger.warn('failed to read from transport', { cause })
      events.emit('transportError', { error })
      await disposer.dispose()
      return
    }
    if (next.done) {
      await disposer.dispose()
      return
    }
```

(`AnyClientMessageOf` is already imported at the top of `server.ts`; `logger` and `events` are already destructured in `handleMessages`.)
- [ ] Run and confirm PASS, then run the whole server suite: `pnpm --filter @enkaku/server run test:unit`
- [ ] Commit:

```sh
git add packages/server/src/server.ts packages/server/src/types.ts packages/server/test/transport-read-failure.test.ts
git commit -m "fix(server): settle handler loop and emit transportError on transport read failure"
```

---

### Task 5: http-server-transport — release stream/channel rids from the inflight map

`inflight.set(rid, { type: 'stream', sessionID })` entries (`packages/http-server-transport/src/index.ts:267,289`) are never deleted, so every stream/channel call permanently consumes an inflight slot until `inflight.size >= maxInflightRequests` (line 220) makes the server return 503 for everything.

**Files:**
- Modify: `packages/http-server-transport/src/index.ts` (writable sink lines 112-155, cleanup interval lines 91-106, abort listener lines 282-287)
- Test: `packages/http-server-transport/test/inflight-limits.test.ts`

- [ ] Add two failing tests to `packages/http-server-transport/test/inflight-limits.test.ts` (the file already defines `createPostRequest`):

```ts
describe('inflight stream entries are released', () => {
  test('stream rid is released when its result is written', async () => {
    const bridge = createServerBridge({ maxInflightRequests: 1 })
    const writer = bridge.stream.writable.getWriter()

    // Stream message creates an SSE session and occupies the only inflight slot
    const sseResponse = await bridge.handleRequest(
      createPostRequest({ payload: { typ: 'stream', rid: 's1', prc: 'test' } }),
    )
    expect(sseResponse.status).toBe(200)

    // Terminal result for s1 must release the inflight slot
    await writer.write({ payload: { typ: 'result', rid: 's1', val: 'done' } } as never)

    // A new request must NOT hit the inflight limit (pre-fix: immediate 503)
    const requestPromise = bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
    )
    const raceResult = await Promise.race([
      requestPromise.then((r) => r.status),
      new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 50)),
    ])
    expect(raceResult).toBe('pending')

    // Settle the pending request cleanly
    await writer.write({ payload: { typ: 'result', rid: 'r1', val: 'ok' } } as never)
    const res = await requestPromise
    expect(res.status).toBe(200)
  })

  test('session teardown sweeps its inflight stream entries', async () => {
    const bridge = createServerBridge({ maxInflightRequests: 1 })
    const abortController = new AbortController()
    const request = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { typ: 'stream', rid: 's1', prc: 'test' } }),
      signal: abortController.signal,
    })
    const sseResponse = await bridge.handleRequest(request)
    expect(sseResponse.status).toBe(200)

    // Client disconnects the SSE request — the session and its rids must be swept
    abortController.abort()
    await new Promise((resolve) => setTimeout(resolve, 10))

    const requestPromise = bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
    )
    const raceResult = await Promise.race([
      requestPromise.then((r) => r.status),
      new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 50)),
    ])
    expect(raceResult).toBe('pending')
  })
})
```

- [ ] Run and confirm FAIL (both race results are `503`): `pnpm --filter @enkaku/http-server-transport run test:unit -- test/inflight-limits.test.ts`
- [ ] Implement in `packages/http-server-transport/src/index.ts`:
  1. After the `inflightTimers` declaration (line 88), add the sweep helper:

```ts
  function clearSessionInflight(sessionID: string): void {
    for (const [rid, entry] of inflight) {
      if (entry.type === 'stream' && entry.sessionID === sessionID) {
        inflight.delete(rid)
      }
    }
  }
```

  2. In the cleanup interval (line 101), sweep after deleting the session:

```ts
          sessions.delete(id)
          clearSessionInflight(id)
```

  3. In the writable sink's stream branch (the `else` starting at line 127), delete terminal entries and sweep on session failure:

```ts
    } else {
      // Terminal payloads end the stream/channel call — release the inflight slot
      if (msg.payload.typ === 'result' || msg.payload.typ === 'error') {
        inflight.delete(rid)
      }
      const session = sessions.get(request.sessionID)
      if (session == null) {
        inflight.delete(rid)
        options.onWriteError?.({
          error: new Error(`Session not found: ${request.sessionID}`),
          rid,
        })
        return
      }
      if (session.controller == null) {
        options.onWriteError?.({
          error: new Error(`No controller for session: ${request.sessionID}`),
          rid,
        })
        return
      }
      try {
        session.controller.enqueue(`data: ${JSON.stringify(msg)}\n\n`)
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
    }
```

  4. In the SSE request abort listener (lines 282-287), sweep the session's rids:

```ts
          request.signal.addEventListener('abort', () => {
            try {
              sseController.close()
            } catch {}
            sessions.delete(sessionID)
            clearSessionInflight(sessionID)
          })
```

- [ ] Run and confirm PASS, then the full package suite: `pnpm --filter @enkaku/http-server-transport run test:unit`
- [ ] Commit:

```sh
git add packages/http-server-transport/src/index.ts packages/http-server-transport/test/inflight-limits.test.ts
git commit -m "fix(http-server-transport): release stream/channel rids from inflight map on result and session end"
```

---### Task 6: http-client-transport — surface SSE disconnects instead of swallowing them

`pump()` (`packages/http-client-transport/src/index.ts:148-160`) swallows both graceful SSE stream end (`done` → silent break) and read errors (empty `catch`). In-flight stream/channel calls hang forever and `sessionState` stays `connected` pointing at a dead session.

**Files:**
- Modify: `packages/http-client-transport/src/index.ts` (lines 126-161)
- Test: `packages/http-client-transport/test/lib.test.ts` (update `createSSEResponse` helper + the `enqueues SSE messages` test, add disconnect tests)

- [ ] Update the `createSSEResponse` helper in `packages/http-client-transport/test/lib.test.ts` so closing the body is explicit (the current helper auto-closes whenever events are passed, which Task 6 turns into a disconnect):

```ts
function createSSEResponse(
  sessionID: string,
  events: Array<Record<string, unknown>> = [],
  options: { close?: boolean } = {},
): Response {
  const chunks = [':\n\n']
  for (const event of events) {
    chunks.push(`data: ${JSON.stringify(event)}\n\n`)
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      if (options.close === true) {
        controller.close()
      }
    },
  })
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'enkaku-session-id': sessionID,
    },
  })
}
```

(The existing `enqueues SSE messages to readable stream` test passes events and now keeps the body open — no other change needed to it.)
- [ ] Add failing tests in a new describe block:

```ts
describe('createTransportStream() SSE disconnect handling', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('SSE stream ending errors the readable so in-flight calls do not hang', async () => {
    globalThis.fetch = vi.fn(async () => {
      return createSSEResponse('drop-test', [], { close: true })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })
    const writer = stream.writable.getWriter()
    const streamMsg = {
      payload: { typ: 'stream', prc: 'test/stream' },
    } as unknown as ClientMessage
    await writer.write(streamMsg)

    const reader = stream.readable.getReader()
    await expect(reader.read()).rejects.toThrow('SSE session ended by server')
  })

  test('session resets to idle after disconnect so the next message reconnects', async () => {
    const acceptHeaders: Array<string | null> = []
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      acceptHeaders.push(req.headers.get('accept'))
      // Every SSE connect immediately ends, simulating a flapping server
      return createSSEResponse(`session-${acceptHeaders.length}`, [], { close: true })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })
    const writer = stream.writable.getWriter()
    const streamMsg = {
      payload: { typ: 'stream', prc: 'test/stream' },
    } as unknown as ClientMessage
    await writer.write(streamMsg)

    // Let the first session drop be processed
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Next stream message must open a fresh SSE session (accept: text/event-stream)
    await writer.write(streamMsg)
    expect(acceptHeaders).toEqual(['text/event-stream', 'text/event-stream'])
  })
})
```

- [ ] Run and confirm FAIL (first test: `read()` hangs/times out; second: one fetch call only): `pnpm --filter @enkaku/http-client-transport run test:unit -- test/lib.test.ts`
- [ ] Implement in `packages/http-client-transport/src/index.ts`. Inside `createTransportStream`, add a disconnect handler above `consumeSSEStream` and rewrite `pump`:

```ts
  function handleSSEDisconnect(error: Error): void {
    sessionState = { status: 'idle' }
    if (abortController.signal.aborted) {
      // Intentional transport disposal — close the readable so pending reads settle
      try {
        controller.close()
      } catch {
        // Already closed or errored
      }
      return
    }
    try {
      controller.error(error)
    } catch {
      // Already closed or errored
    }
  }
```

and in `consumeSSEStream`, replace `pump` (lines 148-160):

```ts
    async function pump(): Promise<void> {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            handleSSEDisconnect(new Error('SSE session ended by server'))
            return
          }
          parser.feed(decoder.decode(value, { stream: true }))
        }
      } catch (cause) {
        handleSSEDisconnect(new Error('SSE session disconnected', { cause }))
      }
    }
```

- [ ] Run and confirm PASS (including the unchanged existing SSE tests): `pnpm --filter @enkaku/http-client-transport run test:unit`
- [ ] Commit:

```sh
git add packages/http-client-transport/src/index.ts packages/http-client-transport/test/lib.test.ts
git commit -m "fix(http-client-transport): surface SSE disconnects and reset session state"
```

---

### Task 7: async — Disposer always settles `disposed` even when the dispose callback rejects

`packages/async/src/disposer.ts:27`: `params.dispose(...).then(() => this.#deferred.resolve())` — a rejected dispose callback leaves `disposed` pending forever, hanging every `await x.dispose()` upstream (Transport, Client, Server all extend Disposer).

**Files:**
- Modify: `packages/async/src/disposer.ts` (lines 4-8, 24-29)
- Test: `packages/async/test/disposer.test.ts`

- [ ] Add failing tests to `packages/async/test/disposer.test.ts`:

```ts
  test('disposed settles even if the dispose callback rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const disposer = new Disposer({
        dispose: () => Promise.reject(new Error('cleanup failed')),
      })
      // Pre-fix these promises never settle (test times out)
      await expect(disposer.dispose()).resolves.toBeUndefined()
      await expect(disposer.disposed).resolves.toBeUndefined()
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  test('surfaces dispose callback rejection via onDisposeError', async () => {
    const onDisposeError = vi.fn()
    const error = new Error('cleanup failed')
    const disposer = new Disposer({
      dispose: () => Promise.reject(error),
      onDisposeError,
    })
    await disposer.dispose()
    expect(onDisposeError).toHaveBeenCalledWith(error)
  })
```

- [ ] Run and confirm FAIL (timeout): `pnpm --filter @enkaku/async run test:unit -- test/disposer.test.ts`
- [ ] Implement in `packages/async/src/disposer.ts`:

```ts
export type DisposerParams = {
  dispose?: (reason?: unknown) => Promise<void>
  onDisposeError?: (error: unknown) => void
  signal?: AbortSignal
}
```

and replace the abort listener body (lines 19-32):

```ts
    this.signal.addEventListener(
      'abort',
      () => {
        if (!disposing) {
          disposing = true
          if (params.dispose == null) {
            this.#deferred.resolve()
          } else {
            params.dispose(this.signal.reason).then(
              () => this.#deferred.resolve(),
              (error) => {
                // The dispose callback rejected: `disposed` must still settle so
                // teardown chains never hang. Surface the error to the caller.
                if (params.onDisposeError != null) {
                  params.onDisposeError(error)
                } else {
                  console.warn('Disposer dispose callback rejected', error)
                }
                this.#deferred.resolve()
              },
            )
          }
        }
      },
      { once: true },
    )
```

- [ ] Run and confirm PASS: `pnpm --filter @enkaku/async run test:unit`
- [ ] Commit:

```sh
git add packages/async/src/disposer.ts packages/async/test/disposer.test.ts
git commit -m "fix(async): Disposer.disposed always settles when dispose callback rejects"
```

---

### Task 8: client — ignore stale transport-disposed handler after transport replacement

`#setupTransport` (`packages/client/src/client.ts:300-320`) registers `this.#transport.disposed.then(...)`. After the transport is replaced (via `#read`'s `handleTransportError` path, lines 364-384), the OLD transport's pending `disposed` continuation still fires later and operates on `this.#transport` (the NEW one) — without a `handleTransportDisposed` handler it calls `this.abort('TransportDisposed')` and kills a healthy client.

**Files:**
- Modify: `packages/client/src/client.ts` (lines 300-320)
- Test: `packages/client/test/transport-replacement.test.ts` (new file)

- [ ] Write the failing test at `packages/client/test/transport-replacement.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports, Transport } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function createFailingTransport(): Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  const readable = new ReadableStream<AnyServerMessageOf<Protocol>>({
    start(controller) {
      controller.error(new Error('read boom'))
    },
  })
  const writable = new WritableStream<AnyClientMessageOf<Protocol>>()
  return new Transport({ stream: { readable, writable } })
}

describe('transport replacement', () => {
  test('disposal of a replaced transport does not abort the client', async () => {
    const failing = createFailingTransport()
    const replacement = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const client = new Client<Protocol>({
      transport: failing,
      handleTransportError: () => replacement.client,
    })

    // Wait for the failing read to trigger replacement
    await new Promise<void>((resolve) => {
      client.events.on('transportReplaced', () => resolve())
    })

    // Now dispose the OLD transport — its stale disposed handler must not
    // abort the client, which is happily using the replacement transport
    await failing.dispose()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(client.signal.aborted).toBe(false)

    await client.dispose()
    await replacement.dispose()
  })
})
```

- [ ] Run and confirm FAIL (`client.signal.aborted` is `true`): `pnpm --filter @enkaku/client run test:unit -- test/transport-replacement.test.ts`
- [ ] Implement in `packages/client/src/client.ts`, replacing `#setupTransport` (lines 300-320):

```ts
  #setupTransport(): void {
    const transport = this.#transport
    transport.disposed.then(() => {
      if (this.signal.aborted || this.#transport !== transport) {
        // Client is gone or this transport was already replaced — stale handler
        return
      }
      const newTransport = this.#handleTransportDisposed?.(transport.signal)
      if (newTransport == null) {
        this.#logger.debug('transport disposed')
        // Abort client if no new transport is provided
        this.abort('TransportDisposed')
      } else {
        this.#logger.debug('using new transport provided by transport disposed handler')
        // Abort running procedures and start using new transport
        this.#abortControllers('TransportDisposed')
        this.#transport = newTransport
        this.#events.emit('transportReplaced', {})
        this.#setupTransport()
      }
    })
    this.#read()
  }
```

- [ ] Run and confirm PASS, plus full client suite: `pnpm --filter @enkaku/client run test:unit`
- [ ] Commit:

```sh
git add packages/client/src/client.ts packages/client/test/transport-replacement.test.ts
git commit -m "fix(client): ignore stale transport-disposed handler after transport replacement"
```

---

### Task 9: client — `request.abort()` must not throw an unhandled rejection when send failed

`createRequest` (`packages/client/src/client.ts:180-195`): `abort` does `void sent.then(() => { controller.abort(reason) })`. When `sent` is rejected (pre-aborted signal path passes `sent: Promise.reject(providedSignal)`, or signing/write preflight failures), `.then` produces a new rejected promise that nothing handles.

**Files:**
- Modify: `packages/client/src/client.ts` (lines 184-189)
- Test: `packages/client/test/transport-replacement.test.ts` → add to a new file `packages/client/test/abort-after-failed-send.test.ts`

- [ ] Write the failing test at `packages/client/test/abort-after-failed-send.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('abort after failed send', () => {
  const rejections: Array<unknown> = []
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

  test('abort() does not produce an unhandled rejection when the request was never sent', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    // Pre-aborted signal: the request is rejected before send and `sent` is a
    // rejected promise
    const signal = AbortSignal.abort('AlreadyAborted')
    const request = client.request('test/request', { signal })
    await expect(request).rejects.toBeDefined()

    // Pre-fix: this chains .then on the rejected `sent` promise → unhandled rejection
    request.abort('Cleanup')
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)

    await client.dispose()
    await transports.dispose()
  })
})
```

- [ ] Run and confirm FAIL (one unhandled rejection captured): `pnpm --filter @enkaku/client run test:unit -- test/abort-after-failed-send.test.ts`
- [ ] Implement in `packages/client/src/client.ts`, replacing the `abort` closure in `createRequest` (lines 185-189):

```ts
  const abort = (reason?: string) => {
    void sent.then(
      () => {
        controller.abort(reason)
      },
      () => {
        // The send already failed, so there is no in-flight request to notify,
        // but the local controller is still aborted to clear any pending state
        // without surfacing an unhandled rejection.
        controller.abort(reason)
      },
    )
  }
```

- [ ] Run and confirm PASS, plus full client suite: `pnpm --filter @enkaku/client run test:unit`
- [ ] Commit:

```sh
git add packages/client/src/client.ts packages/client/test/abort-after-failed-send.test.ts
git commit -m "fix(client): handle sent rejection in request.abort to avoid unhandled rejection"
```

---

### Task 10: http-client-transport — one failed POST rejects only its rid, not the session

`sendMessage` (`packages/http-client-transport/src/index.ts:107-110`) calls `controller.error(new ResponseError(res))` for any non-OK POST, destroying the shared readable for every other in-flight call. Reject only the failing rid via a synthetic error payload; reserve `controller.error` for session-level failures (SSE connect failure keeps its existing path through `connectSSESession`'s throw).

**Files:**
- Modify: `packages/http-client-transport/src/index.ts` (lines 106-113, 203-218)
- Test: `packages/http-client-transport/test/lib.test.ts` (replace the `errors the readable stream when POST returns non-ok response` test, line 155)

- [ ] Replace the existing test `errors the readable stream when POST returns non-ok response` in `packages/http-client-transport/test/lib.test.ts` with:

```ts
  test('non-ok POST response produces an error payload for that rid only', async () => {
    let calls = 0
    globalThis.fetch = vi.fn(async () => {
      calls++
      if (calls === 1) {
        return new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
      }
      return new Response(JSON.stringify({ payload: { typ: 'result', rid: 'r2', val: 'ok' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })
    const writer = stream.writable.getWriter()
    await writer.write({
      payload: { typ: 'request', rid: 'r1', prc: 'test/request' },
    } as unknown as ClientMessage)

    const reader = stream.readable.getReader()
    const first = await reader.read()
    expect(first.value?.payload).toMatchObject({
      typ: 'error',
      rid: 'r1',
      code: 'EK_HTTP_REQUEST_FAILED',
    })

    // The shared readable survives — a subsequent call still works
    await writer.write({
      payload: { typ: 'request', rid: 'r2', prc: 'test/request' },
    } as unknown as ClientMessage)
    const second = await reader.read()
    expect(second.value?.payload).toMatchObject({ typ: 'result', rid: 'r2' })

    await writer.close()
  })
```

- [ ] Run and confirm FAIL (`reader.read()` rejects with `ResponseError` instead of yielding the error payload): `pnpm --filter @enkaku/http-client-transport run test:unit -- test/lib.test.ts`
- [ ] Implement in `packages/http-client-transport/src/index.ts`:
  1. In `sendMessage`, remove the per-request session kill (lines 107-112). Replace:

```ts
      span.setAttribute(AttributeKeys.HTTP_STATUS_CODE, res.status)
      if (!res.ok) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
        controller.error(new ResponseError(res))
      } else {
        span.setStatus({ code: SpanStatusCode.OK })
      }
      return res
```

with:

```ts
      span.setAttribute(AttributeKeys.HTTP_STATUS_CODE, res.status)
      if (!res.ok) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.status}` })
      } else {
        span.setStatus({ code: SpanStatusCode.OK })
      }
      return res
```

  2. In `sendClientMessage` (lines 203-218), synthesize a per-rid error payload for non-OK responses:

```ts
  async function sendClientMessage(
    msg: AnyClientMessageOf<Protocol>,
    sessionID?: string,
  ): Promise<void> {
    const headers: Record<string, string> = { ...HEADERS }
    if (sessionID != null) {
      headers['enkaku-session-id'] = sessionID
    }
    const res = await sendMessage(msg, headers)
    if (!res.ok) {
      // Reject only this call: enqueue a synthetic error reply for its rid.
      // Session-level failures keep using controller.error elsewhere.
      const rid = (msg.payload as { rid?: string }).rid
      if (rid != null) {
        controller.enqueue({
          payload: {
            typ: 'error',
            rid,
            code: 'EK_HTTP_REQUEST_FAILED',
            msg: `Transport request failed with status ${res.status} (${res.statusText})`,
            data: { status: res.status },
          },
        } as unknown as AnyServerMessageOf<Protocol>)
      }
      return
    }
    if (res.status !== 204) {
      res.json().then(
        (msg) => controller.enqueue(msg),
        (cause) => controller.error(new Error('Failed to parse response', { cause })),
      )
    }
  }
```

(`connectSSESession` is unchanged: it already throws `ResponseError` on non-OK, and the `.catch` in the writable sink correctly treats SSE connect failure as session-level.)
- [ ] Run and confirm PASS: `pnpm --filter @enkaku/http-client-transport run test:unit`
- [ ] Commit:

```sh
git add packages/http-client-transport/src/index.ts packages/http-client-transport/test/lib.test.ts
git commit -m "fix(http-client-transport): reject only the failing rid on non-ok POST instead of erroring the session"
```

---

### Task 11: server — no floating channel writer promises

Two floating promises around channel plumbing:
1. `controller.writer.write(msg.payload.val)` (`packages/server/src/server.ts:669`) — rejects (unhandled) when the channel handler cancelled its readable.
2. `controller.writer.close()` in the channel abort listener (`packages/server/src/handlers/channel.ts:58-60`) — rejects (unhandled) when the pipe already errored/cancelled.

**Files:**
- Modify: `packages/server/src/server.ts` (line 669), `packages/server/src/handlers/channel.ts` (lines 58-60)
- Test: `packages/server/test/channel-floating-writes.test.ts` (new file)

- [ ] Write the failing test at `packages/server/test/channel-floating-writes.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

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

describe('channel writer promises are not left floating', () => {
  const rejections: Array<unknown> = []
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

  test('send to a channel whose handler cancelled the readable', async () => {
    const handler: ChannelHandler<Protocol, 'echo'> = (async (ctx) => {
      // Handler stops consuming inbound values immediately
      await ctx.readable.cancel()
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => resolve(), { once: true })
      })
      return null
    }) as ChannelHandler<Protocol, 'echo'>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers: { echo: handler } as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
    })

    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'echo',
        rid: 'c1',
        prm: {},
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Pre-fix: this write rejects on the cancelled pipe → unhandled rejection
    await transports.client.write(
      createUnsignedToken({
        typ: 'send',
        rid: 'c1',
        val: {},
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)

    await server.dispose()
    await transports.dispose()
  })
})
```

- [ ] Run and confirm FAIL (unhandled rejection from `controller.writer.write`): `pnpm --filter @enkaku/server run test:unit -- test/channel-floating-writes.test.ts`
- [ ] Implement:
  1. In `packages/server/src/server.ts` line 669, replace:

```ts
          controller.writer.write(msg.payload.val)
```

with:

```ts
          controller.writer.write(msg.payload.val).catch((cause) => {
            const error = new Error('Failed to write to channel', { cause })
            logger.debug('failed to write send value to channel {rid}', {
              rid: msg.payload.rid,
              cause,
            })
            events.emit('writeFailed', { error, rid: msg.payload.rid })
          })
```

  2. In `packages/server/src/handlers/channel.ts` lines 58-60, replace:

```ts
  controller.signal.addEventListener('abort', () => {
    controller.writer.close()
  })
```

with:

```ts
  controller.signal.addEventListener('abort', () => {
    controller.writer.close().catch(() => {
      // Writer already closed or the pipe errored — nothing left to flush
    })
  })
```

- [ ] Run and confirm PASS, plus full server suite: `pnpm --filter @enkaku/server run test:unit`
- [ ] Commit:

```sh
git add packages/server/src/server.ts packages/server/src/handlers/channel.ts packages/server/test/channel-floating-writes.test.ts
git commit -m "fix(server): catch floating channel writer promises"
```

---

### Task 12: server — remove settled transports from `#handling`

`Server#handle` pushes `{ done, transport }` into `this.#handling` (`packages/server/src/server.ts:884`) and never removes it, so a long-lived server accepting many transports leaks entries (and re-disposes long-gone transports on shutdown).

**Files:**
- Modify: `packages/server/src/server.ts` (lines 873-893, plus a small public counter getter for observability/testing)
- Test: `packages/server/test/handling-cleanup.test.ts` (new file)

- [ ] Write the failing test at `packages/server/test/handling-cleanup.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('handling list cleanup', () => {
  test('completed transports are removed from the handling list', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers: { test: vi.fn() } as unknown as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
    })
    expect(server.activeTransportsCount).toBe(1)

    // Closing the client side ends the server read loop (done: true)
    await transports.client.dispose()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(server.activeTransportsCount).toBe(0)

    await server.dispose()
    await transports.dispose()
  })
})
```

- [ ] Run and confirm FAIL (`activeTransportsCount` does not exist / stays 1): `pnpm --filter @enkaku/server run test:unit -- test/handling-cleanup.test.ts`
- [ ] Implement in `packages/server/src/server.ts`:
  1. Add a getter next to `get events()` (line 826):

```ts
  get activeTransportsCount(): number {
    return this.#handling.length
  }
```

  2. In `handle()`, replace lines 884-893:

```ts
    this.#handling.push({ done, transport })

    const transportID = this.#runtime.getRandomID()
    this.#events.emit('transportAdded', { transportID })
    logger.info('added')
    return done.then(() => {
      logger.info('done')
      this.#events.emit('transportRemoved', { transportID })
    })
```

with:

```ts
    const handling: HandlingTransport<Protocol> = { done, transport }
    this.#handling.push(handling)

    const transportID = this.#runtime.getRandomID()
    this.#events.emit('transportAdded', { transportID })
    logger.info('added')
    return done.then(() => {
      const index = this.#handling.indexOf(handling)
      if (index !== -1) {
        this.#handling.splice(index, 1)
      }
      logger.info('done')
      this.#events.emit('transportRemoved', { transportID })
    })
```

(`HandlingTransport` is the existing local type at line 687.)
- [ ] Run and confirm PASS, plus full server suite: `pnpm --filter @enkaku/server run test:unit`
- [ ] Commit:

```sh
git add packages/server/src/server.ts packages/server/test/handling-cleanup.test.ts
git commit -m "fix(server): remove settled transports from handling list"
```

---

### Task 13: node-streams-transport — catch the floating `pipeTo` and surface failures

`packages/node-streams-transport/src/index.ts:30`: `pipe.readable.pipeThrough(toJSONLines()).pipeTo(Writable.toWeb(streams.writable))` is a floating promise — a destination write error becomes an unhandled rejection.

**Files:**
- Modify: `packages/node-streams-transport/src/index.ts`, `packages/transport/src/index.ts` (relax `TransportEvents.writeFailed.rid` to optional)
- Test: `packages/node-streams-transport/test/lib.test.ts`

- [ ] In `packages/transport/src/index.ts` line 22, change:

```ts
  writeFailed: { error: Error; rid: string }
```

to:

```ts
  writeFailed: { error: Error; rid?: string }
```

then verify no consumer requires a non-optional rid: `grep -rn "writeFailed" /Users/paul/dev/yulsi/enkaku/packages --include='*.ts'` (the only typed consumer is `ServerBridgeOptions.onWriteError` in http-server-transport, which always supplies `rid`, and `ServerEvents.writeFailed` which is already `rid?: string`). Run `pnpm --filter @enkaku/transport run test:unit` to confirm green.
- [ ] Add the failing test to `packages/node-streams-transport/test/lib.test.ts`:

```ts
import { Readable, Writable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { NodeStreamsTransport } from '../src/index.js'

describe('write pipeline failures', () => {
  const rejections: Array<unknown> = []
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

  test('destination write error emits writeFailed instead of an unhandled rejection', async () => {
    const readable = new Readable({ read() {} })
    const writable = new Writable({
      write(_chunk, _encoding, callback) {
        callback(new Error('write boom'))
      },
    })
    const transport = new NodeStreamsTransport<unknown, { n: number }>({
      streams: { readable, writable },
    })
    const writeFailed = vi.fn()
    transport.events.on('writeFailed', writeFailed)

    await transport.write({ n: 1 }).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)
    expect(writeFailed).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'write boom' }) }),
    )

    await transport.dispose()
  })
})
```

- [ ] Run and confirm FAIL (unhandled rejection captured, no `writeFailed` event): `pnpm --filter @enkaku/node-streams-transport run test:unit -- test/lib.test.ts`
- [ ] Implement in `packages/node-streams-transport/src/index.ts`:

```ts
export type CreateTransportStreamOptions = {
  onWriteError?: (error: Error) => void
}

export async function createTransportStream<R, W>(
  source: StreamsSource,
  options: CreateTransportStreamOptions = {},
): Promise<ReadableWritablePair<R, W>> {
  const streams = await Promise.resolve(typeof source === 'function' ? source() : source)

  const input = Readable.toWeb(streams.readable) as ReadableStream<Uint8Array | string>
  const readable = input.pipeThrough(fromJSONLines<R>())

  const pipe = createPipe<W>()
  pipe.readable
    .pipeThrough(toJSONLines())
    .pipeTo(Writable.toWeb(streams.writable))
    .catch((cause) => {
      options.onWriteError?.(cause instanceof Error ? cause : new Error(String(cause)))
    })

  return { readable, writable: pipe.writable }
}
```

and the transport class:

```ts
export class NodeStreamsTransport<R, W> extends Transport<R, W> {
  constructor(params: NodeStreamsTransportParams) {
    super({
      stream: () =>
        createTransportStream<R, W>(params.streams, {
          onWriteError: (error) => {
            this.events.emit('writeFailed', { error })
          },
        }),
      signal: params.signal,
    })
  }
}
```

- [ ] Run and confirm PASS: `pnpm --filter @enkaku/node-streams-transport run test:unit && pnpm --filter @enkaku/transport run test:unit`
- [ ] Commit:

```sh
git add packages/node-streams-transport/src/index.ts packages/node-streams-transport/test/lib.test.ts packages/transport/src/index.ts
git commit -m "fix(node-streams-transport): catch floating pipeTo and surface failures via writeFailed"
```

---

### Task 14: message-transport — close the port and the readable on dispose

`packages/message-transport/src/index.ts:18-39`: the readable never closes and the port is never closed, so `transport.read()` calls pending at dispose time hang forever and the `MessagePort` keeps the process/worker alive.

**Files:**
- Modify: `packages/message-transport/src/index.ts` (lines 18-39)
- Test: `packages/message-transport/test/lib.test.ts`

- [ ] Add the failing test to `packages/message-transport/test/lib.test.ts` (the file already imports `MessageChannel` from `node:worker_threads` and `MessageTransport`/`PortSource`; add `vi` to the vitest import):

```ts
describe('MessageTransport disposal', () => {
  test('dispose closes the port and settles pending reads', async () => {
    const { port1, port2 } = new MessageChannel()
    const transport = new MessageTransport<unknown, unknown>({
      port: port1 as unknown as PortSource,
    })
    const closeSpy = vi.spyOn(port1, 'close')

    // Materialize the stream and start a read that has nothing to consume
    const pendingRead = transport.read()

    await transport.dispose()

    await expect(pendingRead).resolves.toEqual({ done: true, value: undefined })
    expect(closeSpy).toHaveBeenCalled()

    port2.close()
  })
})
```

- [ ] Run and confirm FAIL (`pendingRead` never settles → timeout): `pnpm --filter @enkaku/message-transport run test:unit -- test/lib.test.ts`
- [ ] Implement in `packages/message-transport/src/index.ts`, replacing `createTransportStream`:

```ts
export async function createTransportStream<R, W>(
  source: PortSource,
): Promise<ReadableWritablePair<R, W>> {
  const port = await Promise.resolve(typeof source === 'function' ? source() : source)

  let readableController: ReadableStreamDefaultController<R> | undefined
  function shutdown(): void {
    try {
      readableController?.close()
    } catch {
      // Readable already closed or errored
    }
    port.close()
  }

  const readable = new ReadableStream<R>({
    start(controller) {
      readableController = controller
      port.onmessage = (msg) => {
        controller.enqueue(msg.data)
      }
      port.start()
    },
    cancel() {
      port.close()
    },
  })

  const writable = new WritableStream<W>({
    write(msg) {
      port.postMessage(msg)
    },
    // The base Transport closes the writer on dispose — propagate to the port
    // and the readable so pending reads settle
    close() {
      shutdown()
    },
    abort() {
      shutdown()
    },
  })

  return { readable, writable }
}
```

- [ ] Run and confirm PASS (all existing tests still green — they close ports themselves, double-close is a no-op): `pnpm --filter @enkaku/message-transport run test:unit`
- [ ] Commit:

```sh
git add packages/message-transport/src/index.ts packages/message-transport/test/lib.test.ts
git commit -m "fix(message-transport): close port and readable on dispose so pending reads settle"
```

---

### Task 15: stream — default `onInvalidJSON` surfaces dropped lines

`fromJSONLines` (`packages/stream/src/json-lines.ts:91-93,116-119`) silently drops undecodable lines when no `onInvalidJSON` is supplied. Provide a default that logs a warning (`@enkaku/stream` only depends on `@enkaku/async`, so `console.warn` is the surfacing mechanism — callers wanting events keep passing their own `onInvalidJSON`).

**Files:**
- Modify: `packages/stream/src/json-lines.ts`
- Test: `packages/stream/test/json-lines.test.ts`

- [ ] Add the failing test to the `describe('fromJSONLines()', ...)` block:

```ts
  test('logs a warning by default when a line is invalid JSON', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const [source, controller] = createReadable()
      const [sink, result] = createArraySink()
      source.pipeThrough(fromJSONLines()).pipeTo(sink)

      controller.enqueue('{"invalid": json}\n')
      controller.close()

      await expect(result).resolves.toEqual([])
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON line dropped'))
    } finally {
      warnSpy.mockRestore()
    }
  })
```

- [ ] Run and confirm FAIL (`warnSpy` never called): `pnpm --filter @enkaku/stream run test:unit -- test/json-lines.test.ts`
- [ ] Implement in `packages/stream/src/json-lines.ts`:
  1. Add the default above `fromJSONLines`:

```ts
function defaultOnInvalidJSON(value: string): void {
  const preview = value.length > 200 ? `${value.slice(0, 200)}…` : value
  console.warn(`Invalid JSON line dropped: ${preview}`)
}
```

  2. Use it as the destructuring default and make the calls unconditional:

```ts
  const {
    decode = JSON.parse,
    maxBufferSize,
    maxMessageSize,
    onInvalidJSON = defaultOnInvalidJSON,
  } = options
```

and at both call sites (transform line ~92 and flush line ~118) replace `onInvalidJSON?.(output.join(''), controller)` with `onInvalidJSON(output.join(''), controller)`.
- [ ] Run and confirm PASS (existing `calls onInvalidJSON when JSON is invalid` test still green since explicit callbacks override the default): `pnpm --filter @enkaku/stream run test:unit`
- [ ] Commit:

```sh
git add packages/stream/src/json-lines.ts packages/stream/test/json-lines.test.ts
git commit -m "fix(stream): surface invalid JSON lines via default onInvalidJSON warning"
```

---

### Task 16: integration — zero-unhandled-rejection test for transport failure mid-call

Extend the `tests/integration/server-teardown-no-unhandled.test.ts` pattern to the hard-failure path: socket destroyed with an error while a request is in flight, client and server over real Unix sockets. Verifies Tasks 1-4 compose: no `uncaughtException`, no `unhandledRejection`, the request rejects, and both sides dispose cleanly.

**Files:**
- Create: `tests/integration/transport-failure-no-unhandled.test.ts`
- Note: integration tests import the built `lib/` output (`main: lib/index.js`) — run `pnpm run build` before running them.

- [ ] Build the workspace so integration tests pick up all task changes: `pnpm run build`
- [ ] Write `tests/integration/transport-failure-no-unhandled.test.ts`:

```ts
import { createServer, type Server as NetServer, type Socket as NetSocket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@enkaku/client'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
  ClientTransportOf,
  ProtocolDefinition,
  ServerTransportOf,
} from '@enkaku/protocol'
import { type ProcedureHandlers, serve } from '@enkaku/server'
import { connectSocket, SocketTransport } from '@enkaku/socket-transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const protocol = {
  wait: {
    type: 'request',
    result: { type: 'null' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('transport failure mid-call produces no unhandled errors', () => {
  const rejections: Array<unknown> = []
  const uncaught: Array<unknown> = []
  const onRejection = (reason: unknown) => {
    rejections.push(reason)
  }
  const onUncaught = (error: unknown) => {
    uncaught.push(error)
  }

  beforeEach(() => {
    rejections.length = 0
    uncaught.length = 0
    process.on('unhandledRejection', onRejection)
    process.on('uncaughtException', onUncaught)
  })

  afterEach(() => {
    process.off('unhandledRejection', onRejection)
    process.off('uncaughtException', onUncaught)
  })

  test('socket destroyed with error while a request is in flight', async () => {
    const socketPath = join(
      tmpdir(),
      `enkaku-it-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    )
    const netServer = await new Promise<NetServer>((resolve) => {
      const srv = createServer()
      srv.listen(socketPath, () => resolve(srv))
    })
    const serverSocketPromise = new Promise<NetSocket>((resolve) => {
      netServer.once('connection', resolve)
    })

    const handlers = {
      wait: async (ctx: { signal: AbortSignal }) => {
        await new Promise<void>((resolve) => {
          ctx.signal.addEventListener('abort', () => resolve(), { once: true })
        })
        return null
      },
    } as unknown as ProcedureHandlers<Protocol>

    const clientSocket = await connectSocket(socketPath)
    const clientTransport = new SocketTransport<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >({ socket: clientSocket })
    const client = new Client<Protocol>({
      transport: clientTransport as unknown as ClientTransportOf<Protocol>,
    })

    const serverSocket = await serverSocketPromise
    const serverTransport = new SocketTransport<
      AnyClientMessageOf<Protocol>,
      AnyServerMessageOf<Protocol>
    >({ socket: serverSocket })
    const server = serve<Protocol>({
      handlers,
      protocol,
      transport: serverTransport as unknown as ServerTransportOf<Protocol>,
    })

    const request = client.request('wait')
    // Let the request reach the server handler
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Hard failure on both ends mid-call
    clientSocket.destroy(new Error('connection reset'))
    serverSocket.destroy(new Error('connection reset'))

    // The in-flight call must reject instead of hanging
    await expect(request).rejects.toBeInstanceOf(Error)

    // Both sides must dispose cleanly (server read loop settled via Task 4)
    await client.dispose()
    await server.dispose()
    netServer.close()

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(
      uncaught,
      `unexpected uncaught exceptions: ${uncaught.map(String).join(', ')}`,
    ).toHaveLength(0)
    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)
  })
})
```

- [ ] Run and confirm PASS: `pnpm --filter @enkaku/integration-tests run test:unit -- transport-failure-no-unhandled.test.ts` (this is a regression test for the combined fixes; if it fails, debug with `superpowers:systematic-debugging` — do not weaken the assertions)
- [ ] Also re-run the existing teardown test to confirm it still passes: `pnpm --filter @enkaku/integration-tests run test:unit -- server-teardown-no-unhandled.test.ts`
- [ ] Commit:

```sh
git add tests/integration/transport-failure-no-unhandled.test.ts
git commit -m "test(integration): zero-unhandled assertions for socket failure mid-call"
```

---

### Task 17: final verification

- [ ] Full build: `pnpm run build`
- [ ] Full test run (type checks + unit tests across the workspace): `pnpm run test`
- [ ] Lint (project convention — must go through rtk): `rtk proxy pnpm run lint`
- [ ] If lint rewrote files, re-run `pnpm run test`, then commit any formatting changes:

```sh
git add -A
git commit -m "chore: lint fixes for transport-stability changes"
```

- [ ] Confirm none of the out-of-scope items crept in (no reconnect logic, no backpressure changes, no default client timeout).
