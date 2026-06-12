# Transport Framing/Size Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Enkaku transport that ingests an untrusted byte/event stream a bounded-memory knob, and close a latent unbounded-memory gap in the JSON-lines framer.

**Architecture:** Extract a shared `FramingLimits` type in `@enkaku/stream`; make `fromJSONLines`'s `maxBufferSize` bound *total* framer memory (`input + output`, not just `input`); thread `FromJSONLinesOptions` flat through `node-streams-transport` (matching `socket-transport`); add an SSE buffer cap to `http-client-transport` via `eventsource-parser`'s native `maxBufferSize`; add a `maxRequestBodySize` cap (default 1 MiB) to `http-server-transport`.

**Tech Stack:** TypeScript, Web Streams API, `eventsource-parser@3.1.0`, Vitest, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-06-12-transport-framing-limits-design.md`

**Conventions (project guardrails — follow exactly):**
- `type` not `interface`; `Array<T>` not `T[]`; no `any` (use `unknown`); names use `ID`/`HTTP`/`JSON` casing, not `Id`/`Http`/`Json`.
- Run a single package's tests with `pnpm --filter <pkg-name> run test:unit` (vitest). Full lint per project rule: `rtk proxy pnpm run lint`.
- Commit frequently; one logical change per commit.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `packages/stream/src/json-lines.ts` | JSON-lines framer + option types | Modify: extract `FramingLimits`; `maxBufferSize` bounds `input + output` |
| `packages/stream/test/json-lines.test.ts` | Framer tests | Modify: add multi-line buffer-gap tests |
| `packages/node-streams-transport/src/index.ts` | Node streams transport | Modify: thread `FromJSONLinesOptions<R>` flat |
| `packages/node-streams-transport/test/lib.test.ts` | Transport tests | Modify: add option-threading test |
| `packages/http-client-transport/src/index.ts` | HTTP/SSE client transport | Modify: add `maxBufferSize` to SSE parser |
| `packages/http-client-transport/test/lib.test.ts` | Client tests | Modify: add SSE buffer-cap test |
| `packages/http-server-transport/src/index.ts` | HTTP server bridge/transport | Modify: add `maxRequestBodySize` (default 1 MiB) |
| `packages/http-server-transport/test/body-limits.test.ts` | Body-cap tests | Create |

Task order matters: Task 1 and 2 land the `@enkaku/stream` changes the transports depend on. Tasks 3–5 are independent of each other and can be done in any order after Task 2.

---

## Task 1: Extract `FramingLimits` base type in `@enkaku/stream`

Pure type refactor — no behavior change. Splits `maxBufferSize`/`maxMessageSize` into a reusable base so the SSE transport (and any future framer) shares one vocabulary. `FramingLimits` is exported automatically via the package's existing `export * from './json-lines.js'`.

**Files:**
- Modify: `packages/stream/src/json-lines.ts:9-14`

- [ ] **Step 1: Edit the option types**

In `packages/stream/src/json-lines.ts`, replace the current `FromJSONLinesOptions` type (lines 9-14):

```ts
export type DecodeJSON<T = unknown> = (value: string) => T

export type FramingLimits = {
  maxBufferSize?: number
  maxMessageSize?: number
}

export type FromJSONLinesOptions<T = unknown> = FramingLimits & {
  decode?: DecodeJSON<unknown>
  onInvalidJSON?: (value: string, controller: TransformStreamDefaultController<T>) => void
}
```

(The `DecodeJSON` type alias already exists at line 7 — leave that line as-is; the block above shows context. Only the `FromJSONLinesOptions` declaration changes, plus the new `FramingLimits` type.)

- [ ] **Step 2: Type-check the package**

Run: `pnpm --filter @enkaku/stream run test:types`
Expected: PASS (no errors — the type shape is identical, just reorganized).

- [ ] **Step 3: Run existing unit tests (no behavior change expected)**

Run: `pnpm --filter @enkaku/stream run test:unit`
Expected: PASS — all existing `json-lines.test.ts` tests still green.

- [ ] **Step 4: Commit**

```bash
git add packages/stream/src/json-lines.ts
git commit -m "refactor(stream): extract FramingLimits base type from FromJSONLinesOptions"
```

---

## Task 2: `maxBufferSize` bounds total framer memory (close the multi-line gap)

Today `maxBufferSize` checks only `input` (raw bytes since the last `\n`, trimmed at every newline). The accumulated logical message lives in `output` and is bounded only by `maxMessageSize`. A huge/deeply-nested value streamed across many short newline-terminated lines keeps `input` small but grows `output` unbounded. Fix: `maxBufferSize` bounds `input.length + output.length`, checked on chunk entry **and** after each line is accumulated.

**Files:**
- Modify: `packages/stream/src/json-lines.ts` (the `fromJSONLines` transform body, ~lines 74-117)
- Test: `packages/stream/test/json-lines.test.ts`

- [ ] **Step 1: Write the failing test — multi-line attack under `maxBufferSize` alone**

Add to `packages/stream/test/json-lines.test.ts` inside the `describe('fromJSONLines()', ...)` block:

```ts
test('bounds multi-line accumulation under maxBufferSize alone', async () => {
  const [source, controller] = createReadable()
  const [sink, result] = createArraySink()
  const pipe = source
    .pipeThrough(fromJSONLines({ maxBufferSize: 50 }))
    .pipeTo(sink)
    .catch(() => {})

  // Each chunk is a single '[' on its own line: input stays tiny (trimmed at the
  // newline) but `output` accumulates an ever-deeper, never-closing structure.
  // maxMessageSize is intentionally unset — maxBufferSize alone must catch this.
  for (let i = 0; i < 60; i++) {
    controller.enqueue('[\n')
  }
  controller.close()

  await expect(result).rejects.toThrow('exceeds maximum buffer size')
  await pipe
})
```

- [ ] **Step 2: Run it to confirm it fails (current behavior leaks)**

Run: `pnpm --filter @enkaku/stream run test:unit -- -t "bounds multi-line accumulation"`
Expected: FAIL — the promise resolves instead of rejecting (the gap: `output` grows unbounded, no error).

- [ ] **Step 3: Implement the fix**

In `packages/stream/src/json-lines.ts`, replace the `checkOutputSize` helper (lines 74-80) — keep it and add a `checkBufferSize` helper beside it:

```ts
  function checkOutputSize(): void {
    if (maxMessageSize != null && output.length > maxMessageSize) {
      throw new JSONLinesError(
        `Message size ${output.length} exceeds maximum message size of ${maxMessageSize}`,
      )
    }
  }

  function checkBufferSize(): void {
    if (maxBufferSize != null && input.length + output.length > maxBufferSize) {
      throw new JSONLinesError(
        `Buffer size ${input.length + output.length} exceeds maximum buffer size of ${maxBufferSize}`,
      )
    }
  }
```

Then, in the transform callback, replace the inline `maxBufferSize` check (current lines 85-90) and add a per-line check inside the newline loop. The transform callback body becomes:

```ts
    (chunk, controller) => {
      try {
        input += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
        checkBufferSize()
        let newLineIndex = input.indexOf(SEPARATOR)
        while (newLineIndex !== -1) {
          for (const char of input.slice(0, newLineIndex)) {
            processChar(char)
          }
          checkBufferSize()
          if (nestingDepth === 0 && !isInString && output.length > 0) {
            checkOutputSize()
            try {
              controller.enqueue(decode(output.join('')))
            } catch {
              onInvalidJSON(output.join(''), controller)
            }
            output = []
          } else if (isInString) {
            // If we're in a string, we need to keep the newline in the output
            output.push('\\n')
          }
          input = input.slice(newLineIndex + SEPARATOR.length)
          newLineIndex = input.indexOf(SEPARATOR)
        }
      } catch (cause) {
        if (cause instanceof JSONLinesError) {
          throw cause
        }
        controller.error(new JSONLinesError('Error processing chunk', { cause }))
      }
    },
```

(The `checkBufferSize()` after the `for` loop catches a single chunk that packs many short lines into one never-closing structure, within that chunk rather than one chunk late.)

- [ ] **Step 4: Run the new test — confirm it passes**

Run: `pnpm --filter @enkaku/stream run test:unit -- -t "bounds multi-line accumulation"`
Expected: PASS — rejects with `exceeds maximum buffer size`.

- [ ] **Step 5: Run the full stream suite — confirm no regression**

Run: `pnpm --filter @enkaku/stream run test:unit`
Expected: PASS. In particular the existing `rejects accumulated input exceeding maxBufferSize` test (single 60-char un-terminated chunk, cap 50) still throws — `input` alone (60) already exceeds 50, and the existing `parses formatted JSON` test sets no cap so is unaffected.

- [ ] **Step 6: Commit**

```bash
git add packages/stream/src/json-lines.ts packages/stream/test/json-lines.test.ts
git commit -m "fix(stream): maxBufferSize bounds total framer memory (input + output)

Closes a latent gap: a value streamed across many short newline-terminated
lines kept the per-line input buffer small while output grew unbounded when
maxMessageSize was unset. maxBufferSize now bounds input.length +
output.length, matching eventsource-parser. Affects socket-transport too."
```

---

## Task 3: Thread `FromJSONLinesOptions<R>` flat through `node-streams-transport`

Bring `node-streams-transport` in line with `socket-transport`: framing options spread flat into params, passed into `fromJSONLines`. `onWriteError` (transport-internal) stays separate on `CreateTransportStreamOptions`.

**Files:**
- Modify: `packages/node-streams-transport/src/index.ts`
- Test: `packages/node-streams-transport/test/lib.test.ts`

- [ ] **Step 1: Write the failing test — framing option threads through `createTransportStream`**

Add to `packages/node-streams-transport/test/lib.test.ts` inside `describe('createTransportStream()', ...)`:

```ts
  test('threads maxMessageSize into the inbound framer', async () => {
    const source = new Readable({ read() {} })
    const sink = new Writable({
      write(_chunk, _encoding, cb) {
        cb()
      },
    })
    const stream = await createTransportStream<unknown, unknown>(
      { readable: source, writable: sink },
      { maxMessageSize: 50 },
    )

    const reader = stream.readable.getReader()
    const read = reader.read()
    // One oversized line — the framer must error the readable rather than emit it.
    source.push(`${JSON.stringify({ data: 'x'.repeat(100) })}\n`)

    await expect(read).rejects.toThrow('exceeds maximum message size')
  })
```

Add the import for `FromJSONLinesOptions` is **not** needed in the test. Ensure `Readable`/`Writable` are already imported at the top of the file (they are).

- [ ] **Step 2: Run it to confirm it fails (option not accepted / not threaded)**

Run: `pnpm --filter @enkaku/node-streams-transport run test:unit -- -t "threads maxMessageSize"`
Expected: FAIL — `createTransportStream`'s second argument has no `maxMessageSize`, so the framer is unbounded and `read` resolves with the oversized value instead of rejecting. (May fail at type-check / compile first — that's fine.)

- [ ] **Step 3: Implement the threading**

Replace `packages/node-streams-transport/src/index.ts` lines 14-62 with:

```ts
import { createPipe, type FromJSONLinesOptions, fromJSONLines, toJSONLines } from '@enkaku/stream'
import { Transport } from '@enkaku/transport'

export type Streams = { readable: Readable; writable: Writable }
export type StreamsOrPromise = Streams | Promise<Streams>
export type StreamsSource = StreamsOrPromise | (() => StreamsOrPromise)

export type CreateTransportStreamOptions<R = unknown> = FromJSONLinesOptions<R> & {
  onWriteError?: (error: Error) => void
}

export async function createTransportStream<R, W>(
  source: StreamsSource,
  options: CreateTransportStreamOptions<R> = {},
): Promise<ReadableWritablePair<R, W>> {
  const { onWriteError, ...streamOptions } = options
  const streams = await Promise.resolve(typeof source === 'function' ? source() : source)

  const input = Readable.toWeb(streams.readable) as ReadableStream<Uint8Array | string>
  const readable = input.pipeThrough(fromJSONLines<R>(streamOptions))

  const pipe = createPipe<W>()
  pipe.readable
    .pipeThrough(toJSONLines())
    .pipeTo(Writable.toWeb(streams.writable))
    .catch((cause) => {
      onWriteError?.(cause instanceof Error ? cause : new Error(String(cause)))
    })

  return { readable, writable: pipe.writable }
}

export type NodeStreamsTransportParams<R = unknown> = FromJSONLinesOptions<R> & {
  streams: StreamsSource
  signal?: AbortSignal
}

export class NodeStreamsTransport<R, W> extends Transport<R, W> {
  constructor(params: NodeStreamsTransportParams<R>) {
    const { streams, signal, ...streamOptions } = params
    super({
      stream: () =>
        createTransportStream<R, W>(streams, {
          ...streamOptions,
          onWriteError: (error) => {
            this.events.emit('writeFailed', { error })
          },
        }),
      signal,
    })
  }
}
```

(Keep the existing `import { Readable, Writable } from 'node:stream'` line 13 above this block.)

- [ ] **Step 4: Run the new test — confirm it passes**

Run: `pnpm --filter @enkaku/node-streams-transport run test:unit -- -t "threads maxMessageSize"`
Expected: PASS.

- [ ] **Step 5: Run the full package suite + types**

Run: `pnpm --filter @enkaku/node-streams-transport run test`
Expected: PASS — existing `write pipeline failures` and `converts from Node streams` tests still green (the `onWriteError` destructure preserves the write-error behavior).

- [ ] **Step 6: Commit**

```bash
git add packages/node-streams-transport/src/index.ts packages/node-streams-transport/test/lib.test.ts
git commit -m "feat(node-streams-transport): thread FromJSONLinesOptions framing limits

Spread FromJSONLinesOptions<R> flat into NodeStreamsTransportParams and
CreateTransportStreamOptions, passed into fromJSONLines — matching
socket-transport. Additive; omitted options keep current behavior."
```

---

## Task 4: SSE buffer cap in `http-client-transport`

`eventsource-parser@3.1.0` natively supports `maxBufferSize` in `ParserConfig` and fires a `ParseError` of type `max-buffer-size-exceeded` to `onError` when the buffered (partial-line or multi-line) event exceeds the cap. Wire `maxBufferSize` through and add an `onError` handler that errors the readable and aborts the session.

**Files:**
- Modify: `packages/http-client-transport/src/index.ts`
- Test: `packages/http-client-transport/test/lib.test.ts`

- [ ] **Step 1: Write the failing test — oversized un-terminated SSE event aborts the session**

Add to `packages/http-client-transport/test/lib.test.ts` inside `describe('createTransportStream()', ...)`. It opens an SSE session with a `stream` message, then the server emits an un-terminated `data:` line larger than the cap:

```ts
  test('errors the readable when an SSE event exceeds maxBufferSize', async () => {
    globalThis.fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(':\n\n')) // header flush
          // Un-terminated data line (no trailing \n\n) far larger than the cap.
          controller.enqueue(encoder.encode(`data: ${'x'.repeat(500)}`))
        },
      })
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'enkaku-session-id': 'sess-1' },
      })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({
      url: 'http://localhost/rpc',
      maxBufferSize: 100,
    })
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()

    // A stream message opens the SSE session and starts consuming the response.
    await writer.write({ payload: { typ: 'stream', rid: 's1', prc: 'test/stream' } } as ClientMessage)

    await expect(reader.read()).rejects.toThrow(/buffer/i)
  })
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @enkaku/http-client-transport run test:unit -- -t "exceeds maxBufferSize"`
Expected: FAIL — `maxBufferSize` is not a known param and the parser is unbounded, so the read hangs/never rejects (test times out or resolves). (May fail at type-check first.)

- [ ] **Step 3: Add `maxBufferSize` to the param types**

In `packages/http-client-transport/src/index.ts`, add `maxBufferSize?: number` to both param types. Replace `TransportStreamParams` (lines 58-62) and `ClientTransportParams` (lines 315-319):

```ts
export type TransportStreamParams = {
  url: string
  fetch?: FetchFunction
  runtime?: Runtime
  maxBufferSize?: number
}
```

```ts
export type ClientTransportParams = {
  url: string
  fetch?: FetchFunction
  runtime?: Runtime
  maxBufferSize?: number
}
```

`ClientTransport`'s constructor already passes `params` straight into `createTransportStream(params)` (line 326), so no change there.

- [ ] **Step 4: Wire the cap + `onError` into the parser**

In `consumeSSEStream` (lines 143-153), replace the `createParser({ ... })` call:

```ts
    const parser = createParser({
      maxBufferSize: params.maxBufferSize,
      onEvent: (event) => {
        try {
          const message = JSON.parse(event.data) as AnyServerMessageOf<Protocol>
          controller.enqueue(message)
        } catch (cause) {
          controller.error(new Error('Failed to parse SSE event data', { cause }))
        }
      },
      onError: (error) => {
        if (error.type === 'max-buffer-size-exceeded') {
          // Reap the session instead of buffering an unbounded stream forever.
          try {
            controller.error(new Error('SSE buffer size exceeded', { cause: error }))
          } catch {
            // Readable already closed or errored
          }
          abortController.abort()
        }
        // Other ParseError types (unknown-field, invalid-retry) are non-fatal and ignored.
      },
    })
```

`createParser` is already imported from `eventsource-parser` (line 31); `ParseError` is the type passed to `onError` and needs no import (the `error.type` field is used directly).

- [ ] **Step 5: Run the new test — confirm it passes**

Run: `pnpm --filter @enkaku/http-client-transport run test:unit -- -t "exceeds maxBufferSize"`
Expected: PASS — `reader.read()` rejects with a buffer error.

- [ ] **Step 6: Run the full package suite + types**

Run: `pnpm --filter @enkaku/http-client-transport run test`
Expected: PASS — existing SSE tests (which always terminate events with `\n\n` and set no cap) are unaffected.

- [ ] **Step 7: Commit**

```bash
git add packages/http-client-transport/src/index.ts packages/http-client-transport/test/lib.test.ts
git commit -m "feat(http-client-transport): cap SSE parser buffer via maxBufferSize

Thread maxBufferSize into eventsource-parser and add an onError handler
that errors the readable and aborts the session on
max-buffer-size-exceeded, instead of buffering a malicious/un-terminated
SSE stream unbounded. Additive; omitted = unbounded as before."
```

---

## Task 5: `maxRequestBodySize` cap in `http-server-transport`

Add a request-body size cap (default **1 MiB**) to the existing limits family. Enforce in `handlePostRequest` before parsing: fast-reject on an oversized `content-length` header, and otherwise read the body through a byte-counting reader that aborts past the cap. Both paths return `413`.

**Files:**
- Modify: `packages/http-server-transport/src/index.ts`
- Test: `packages/http-server-transport/test/body-limits.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `packages/http-server-transport/test/body-limits.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { createServerBridge } from '../src/index.js'

describe('request body size limits', () => {
  test('rejects a body over maxRequestBodySize with 413 (content-length fast path)', async () => {
    const bridge = createServerBridge({ maxRequestBodySize: 100 })
    const body = JSON.stringify({ payload: { typ: 'event', prc: 'test', data: 'x'.repeat(500) } })
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }),
    )
    expect(res.status).toBe(413)
    const json = await res.json()
    expect(json.error).toMatch(/too large/i)
  })

  test('rejects an oversized streamed body with no content-length (robust path)', async () => {
    const bridge = createServerBridge({ maxRequestBodySize: 100 })
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(500)))
        controller.close()
      },
    })
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: stream,
        // undici requires duplex: 'half' for a streaming request body; the field
        // is not in every TS lib.dom version, so widen the init type locally.
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
    )
    expect(res.status).toBe(413)
  })

  test('accepts a body under the cap', async () => {
    const bridge = createServerBridge({ maxRequestBodySize: 10_000 })
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload: { typ: 'event', prc: 'test' } }),
      }),
    )
    expect(res.status).toBe(204)
  })

  test('applies a 1 MiB default when maxRequestBodySize is unset', async () => {
    const bridge = createServerBridge()
    const body = JSON.stringify({ payload: { typ: 'event', prc: 'test', data: 'x'.repeat(2_000_000) } })
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }),
    )
    expect(res.status).toBe(413)
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `pnpm --filter @enkaku/http-server-transport run test:unit -- body-limits`
Expected: FAIL — `maxRequestBodySize` is not honored; oversized bodies currently parse and return 204/400, not 413.

- [ ] **Step 3: Add the option to both option types + a default**

In `packages/http-server-transport/src/index.ts`, add `maxRequestBodySize?: number` to `ServerBridgeOptions` (lines 46-55) and `ServerTransportOptions` (lines 386-394). For `ServerBridgeOptions`:

```ts
export type ServerBridgeOptions = {
  allowedOrigin?: string | Array<string>
  getRandomID?: () => string
  onWriteError?: (event: TransportEvents['writeFailed']) => void
  maxSessions?: number
  runtime?: Runtime
  sessionTimeoutMs?: number
  maxInflightRequests?: number
  requestTimeoutMs?: number
  maxRequestBodySize?: number
}
```

For `ServerTransportOptions`:

```ts
export type ServerTransportOptions = {
  allowedOrigin?: string | Array<string>
  getRandomID?: () => string
  maxSessions?: number
  runtime?: Runtime
  sessionTimeoutMs?: number
  maxInflightRequests?: number
  requestTimeoutMs?: number
  maxRequestBodySize?: number
}
```

In `createServerBridge`, alongside the other defaults (after line 85 `const requestTimeoutMs = ...`):

```ts
  const maxRequestBodySize = options.maxRequestBodySize ?? 1_048_576 // 1 MiB
```

In the `ServerTransport` constructor's `createServerBridge({ ... })` call (lines 403-414), pass it through — add the line:

```ts
      maxRequestBodySize: options.maxRequestBodySize,
```

- [ ] **Step 4: Add the bounded-read helper**

Add this module-level helper to `packages/http-server-transport/src/index.ts` (place it near the other top-level helpers, e.g. after `isValidOrigin`, around line 68). Returns `null` when the cap is exceeded:

```ts
async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string | null> {
  const contentLength = request.headers.get('content-length')
  if (contentLength != null) {
    const declared = Number(contentLength)
    if (Number.isFinite(declared) && declared > maxBytes) {
      return null
    }
  }
  const body = request.body
  if (body == null) {
    const text = await request.text()
    return text.length > maxBytes ? null : text
  }
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel()
      return null
    }
    result += decoder.decode(value, { stream: true })
  }
  result += decoder.decode()
  return result
}
```

- [ ] **Step 5: Enforce the cap in `handlePostRequest`**

In `handlePostRequest`, replace the body-parsing line (currently line 222 `const message = (await request.json()) as Incoming`) with a bounded read + parse. The `try` block opening at line 221 stays; change its first statements to:

```ts
    try {
      const raw = await readBodyWithLimit(request, maxRequestBodySize)
      if (raw == null) {
        return Response.json({ error: 'Request body too large' }, { headers, status: 413 })
      }
      const message = JSON.parse(raw) as Incoming
      if (!VALID_PAYLOAD_TYPES.has(message?.payload?.typ)) {
        return Response.json({ error: 'Invalid message type' }, { headers, status: 400 })
      }
      // ...rest of the switch unchanged...
```

(The existing outer `catch { return Response.json({ error: 'Invalid request' }, { headers, status: 400 }) }` at lines 321-323 still catches a `JSON.parse` failure → 400, preserving current malformed-body behavior.)

- [ ] **Step 6: Run the new tests — confirm they pass**

Run: `pnpm --filter @enkaku/http-server-transport run test:unit -- body-limits`
Expected: PASS — 413 for both oversized paths and the default, 204 for the under-cap body.

- [ ] **Step 7: Run the full package suite + types**

Run: `pnpm --filter @enkaku/http-server-transport run test`
Expected: PASS — existing `lib`, `inflight-limits`, `session-limits`, `origin-validation` suites still green (their bodies are far under 1 MiB).

- [ ] **Step 8: Commit**

```bash
git add packages/http-server-transport/src/index.ts packages/http-server-transport/test/body-limits.test.ts
git commit -m "feat(http-server-transport): cap request body size (default 1 MiB)

Add maxRequestBodySize to ServerBridgeOptions/ServerTransportOptions,
enforced before parsing via a content-length fast path and a
byte-counting reader for chunked/unlabelled bodies. Oversized bodies get
413. Default 1 MiB is a mild, security-by-default behavior change."
```

---

## Task 6: Cross-package verification + changeset

- [ ] **Step 1: Build all packages (types then JS)**

Run: `pnpm run build`
Expected: PASS — no type errors across the workspace (the `node-streams-transport` `<R>` param change and `@enkaku/stream` type split compile cleanly for all consumers).

- [ ] **Step 2: Run the full test suite**

Run: `pnpm run test:unit`
Expected: PASS — all packages green.

- [ ] **Step 3: Lint**

Run: `rtk proxy pnpm run lint`
Expected: clean (formatting + lint applied with no outstanding errors).

- [ ] **Step 4: Add a changeset**

Check whether the repo uses changesets: `ls .changeset/ 2>/dev/null`. If it does, add one documenting the four package changes and the **two behavior changes** for release notes:
- `@enkaku/stream` — `maxBufferSize` now bounds total framer memory (`input + output`); a multi-line stream that passed under the old `input`-only cap may now error (affects `@enkaku/socket-transport`).
- `@enkaku/http-server-transport` — new `maxRequestBodySize` defaults to 1 MiB; bodies over 1 MiB return `413` unless the cap is raised.
- `@enkaku/node-streams-transport` — additive `FromJSONLinesOptions` framing limits.
- `@enkaku/http-client-transport` — additive SSE `maxBufferSize`.

If `.changeset/` does not exist, skip this step and note it in the final report.

- [ ] **Step 5: Remove the consumed backlog item**

The backlog seed is now superseded by the shipped work. Delete it:

```bash
git rm docs/agents/plans/backlog/node-streams-framing-limits.md
git commit -m "chore: drop node-streams-framing-limits backlog item (shipped)"
```

---

## Downstream follow-up (out of scope for this plan)

Once these packages are released, mokei wires `maxBufferSize` / `maxMessageSize` into `spawnHostedContext` (`packages/host/src/host.ts`) so a poisoned or oversized stdio stream surfaces an error and reaps the context instead of hanging. Tracked separately in the mokei repo (hang/crash-core plan, item 6).
