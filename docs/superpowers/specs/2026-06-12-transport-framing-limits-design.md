# Transport framing/size limits — design

**Date:** 2026-06-12
**Origin:** mokei hang/crash-core audit (item 6). Backlog seed:
`docs/agents/plans/backlog/node-streams-framing-limits.md`.

## Problem

Every Enkaku transport that ingests an untrusted byte or event stream has at least
one unbounded-memory surface. A misbehaving or malicious peer can grow a buffer
without limit (OOM) or, in the JSON-lines case, wedge the parser so every later
frame is silently swallowed and all requests hang.

Audit of the five transport packages:

| Package | Framing mechanism | Unbounded surface | Has a limit knob today? |
|---|---|---|---|
| `socket-transport` | `fromJSONLines` | framing buffer / message size | **yes** — threads `FromJSONLinesOptions<R>` |
| `node-streams-transport` | `fromJSONLines` | framing buffer / message size | **no** — bare `fromJSONLines()` |
| `http-client-transport` | SSE via `eventsource-parser` | un-terminated event buffer | **no** |
| `http-server-transport` | `await request.json()` | full POST body in memory | **no** |
| `message-transport` | in-process, no byte framing | — | N/A |

`socket-transport` is the precedent: framing options are spread flat into its
params (`SocketTransportParams<R> = FromJSONLinesOptions<R> & {...}`). The other
three byte/event-stream transports are brought in line, each with the limit knob
appropriate to its mechanism. `message-transport` is out of scope (no byte stream).

## Goal

Give every untrusted-stream transport a bounded-memory knob, using a **consistent
vocabulary** (`maxBufferSize` / `maxMessageSize`) wherever the mechanism allows.
JSON-lines is the fixed wire format for the two byte-stream transports — there is no
pluggable codec — so the framing options are **core transport params**, spread flat,
not nested under a sub-concern.

## Design

### 0. Shared base type in `@enkaku/stream`

Extract a base limits type so the JSON-lines and SSE surfaces share one vocabulary
at the type level:

```ts
// packages/stream/src/json-lines.ts
export type FramingLimits = {
  maxBufferSize?: number
  maxMessageSize?: number
}

export type FromJSONLinesOptions<T = unknown> = FramingLimits & {
  onInvalidJSON?: (value: string, controller: TransformStreamDefaultController<T>) => void
}
```

`FromJSONLinesOptions` keeps its current shape (additive split — `maxBufferSize` and
`maxMessageSize` simply move into `FramingLimits`), so existing consumers are
unaffected. `FramingLimits` is re-exported from the package index.

### 1. `node-streams-transport` — flat-spread `FromJSONLinesOptions<R>`

Mirror `socket-transport` exactly.

```ts
export type CreateTransportStreamOptions<R = unknown> =
  FromJSONLinesOptions<R> & { onWriteError?: (error: Error) => void }

export async function createTransportStream<R, W>(
  source: StreamsSource,
  options: CreateTransportStreamOptions<R> = {},
): Promise<ReadableWritablePair<R, W>> {
  const { onWriteError, ...streamOptions } = options
  // ...
  const readable = input.pipeThrough(fromJSONLines<R>(streamOptions))
  // ... writer path unchanged, uses onWriteError
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
          onWriteError: (error) => this.events.emit('writeFailed', { error }),
        }),
      signal,
    })
  }
}
```

- **Non-breaking:** omitted options → current behavior. `NodeStreamsTransportParams`
  gains a `<R>` type parameter (defaulted to `unknown`); existing
  `new NodeStreamsTransport({ streams })` callers keep working via inference.

### 2. `http-client-transport` — SSE consumer buffer cap

`eventsource-parser@3.1.0` already supports `maxBufferSize` in `ParserConfig` and an
`onError` callback that fires a `ParseError` of type `max-buffer-size-exceeded` once
the buffered (un-terminated / multi-line) event exceeds the cap. Wire it through.

```ts
export type TransportStreamParams = {
  url: string
  fetch?: FetchFunction
  runtime?: Runtime
  maxBufferSize?: number
}

export type ClientTransportParams = {
  url: string
  fetch?: FetchFunction
  runtime?: Runtime
  maxBufferSize?: number
}
```

In `consumeSSEStream`:

```ts
const parser = createParser({
  maxBufferSize: params.maxBufferSize,
  onEvent: (event) => { /* unchanged: JSON.parse + enqueue */ },
  onError: (error) => {
    if (error.type === 'max-buffer-size-exceeded') {
      controller.error(error)
      abortController.abort() // reap the session instead of buffering forever
    }
    // other ParseError types remain non-fatal (logged via existing paths)
  },
})
```

- **Only `maxBufferSize`** is exposed. A completed event's `data` is already bounded
  by the buffer, so a separate per-event `maxMessageSize` would be redundant.
- **Non-breaking:** `maxBufferSize` undefined → parser unbounded as today.

### 3. `http-server-transport` — request body size cap

Add `maxRequestBodySize` to the existing limits family
(`maxSessions` / `maxInflightRequests` / `sessionTimeoutMs` / `requestTimeoutMs`).

```ts
export type ServerBridgeOptions = {
  // ...existing fields...
  maxRequestBodySize?: number
}
export type ServerTransportOptions = {
  // ...existing fields...
  maxRequestBodySize?: number
}
```

- **Default: `1_048_576` (1 MiB)** — secure-by-default, matching this module's habit
  of defaulting its other limits. This is a **mild breaking change**: callers that
  legitimately POST bodies larger than 1 MiB must raise the cap. Called out in the
  changeset/release notes.

Enforcement in `handlePostRequest`, before parsing:

1. **Fast path** — if the `content-length` header is present and exceeds the cap,
   return `413` immediately without reading the body.
2. **Robust path** — for chunked / absent / spoofed `content-length`, read
   `request.body` through a byte-counting reader that aborts once the cumulative
   size exceeds the cap, returning `413`. Then `JSON.parse` the bounded buffer
   (replacing the bare `await request.json()`).

A small helper `readBodyWithLimit(request, maxBytes): Promise<string | null>`
(returns `null` when the cap is exceeded) keeps `handlePostRequest` readable. The
`413` response carries the same CORS headers as the other early returns.

## Out of scope

- `message-transport` — no byte stream, nothing to bound.
- SSE-client `maxMessageSize` — subsumed by `maxBufferSize` (see §2).
- Replacing `eventsource-parser` — its native `maxBufferSize` is sufficient.

## Testing

Per transport, three cases:

1. **Oversized input** → bounded error / `413`, not OOM or hang.
   - node-streams: oversized line / oversized framing buffer → stream errors
     (mirror socket-transport's existing framing tests).
   - http-client: server emits an un-terminated event past `maxBufferSize` →
     `controller` errors and the session aborts.
   - http-server: POST body over the cap, via both `content-length` header and
     chunked/no-length → `413`.
2. **Limit omitted / default** → behavior unchanged for traffic within bounds
   (http-server: assert the 1 MiB default is applied when unset).
3. **Valid traffic under the limit** → unaffected.

## Downstream follow-up (mokei)

Once released, mokei wires `maxBufferSize` / `maxMessageSize` / `onInvalidJSON` into
`spawnHostedContext` (`packages/host/src/host.ts`) so a poisoned or oversized stdio
stream surfaces an error and reaps the context instead of hanging.

## Rollout

Single coordinated changeset across `@enkaku/stream`, `@enkaku/node-streams-transport`,
`@enkaku/http-client-transport`, `@enkaku/http-server-transport`. The
`http-server-transport` default cap is the only behavioral change for existing users;
everything else is additive.
