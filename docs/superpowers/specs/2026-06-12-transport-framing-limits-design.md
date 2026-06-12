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
  decode?: DecodeJSON<unknown>
  onInvalidJSON?: (value: string, controller: TransformStreamDefaultController<T>) => void
}
```

`FromJSONLinesOptions` keeps its current shape (additive split — `maxBufferSize` and
`maxMessageSize` simply move into `FramingLimits`; `decode` stays put), so existing
consumers are unaffected. `FramingLimits` is re-exported from the package index.

### 0.5. Fix `fromJSONLines` `maxBufferSize` to bound total framer memory

**Latent gap (closes here).** Today `maxBufferSize` bounds only `input` — the raw
bytes since the last `\n` — which is trimmed at every newline (json-lines.ts:108).
The accumulated *logical* message lives in `output`, which only flushes when
`nestingDepth === 0` (line 96) and is bounded **only** by `maxMessageSize`.

Consequence: a caller who sets `maxBufferSize` **alone** is not protected against a
huge / deeply-nested JSON value streamed across many short newline-terminated lines —
each line keeps `input` small, but `output` grows unbounded. This is the hang/crash
memory class the audit targets, and `socket-transport` ships it today.

**Fix.** `maxBufferSize` bounds total live framing memory — `input.length +
output.length` — matching `eventsource-parser`, whose single `maxBufferSize` already
covers both the partial-line and the multi-line-accumulation surfaces.

```ts
function checkBufferSize(): void {
  if (maxBufferSize != null && input.length + output.length > maxBufferSize) {
    throw new JSONLinesError(
      `Buffer size ${input.length + output.length} exceeds maximum buffer size of ${maxBufferSize}`,
    )
  }
}
```

Called both on chunk entry (replacing the current `input`-only check at line 86) and
after each line is accumulated inside the newline loop, so a single chunk packing many
short lines into one never-closing structure is caught within that chunk, not one
chunk late.

After this fix the knobs have clean, consistent meanings everywhere:

- **`maxBufferSize`** — complete memory-DoS defense on its own. Set it and the framer
  can never hold more than that many chars, regardless of line structure or nesting.
- **`maxMessageSize`** — optional, *tighter* per-message semantic cap (reject a single
  decoded message over X even when the buffer would allow more). No longer the sole
  defense against a memory attack.

**Behavior change:** a multi-line stream that previously passed under an `input`-only
cap may now error. This is hardening and affects `socket-transport` as well as the new
`node-streams-transport` wiring; called out in the changeset.

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

- **Only `maxBufferSize`** is exposed. `eventsource-parser`'s `maxBufferSize` already
  bounds *both* its unbounded surfaces — the partial un-terminated line **and** the
  multi-line event accumulating across `data:` fields. That second surface is the SSE
  analog of json-lines' `output` — i.e. exactly what `maxMessageSize` guards in
  json-lines (§0.5). Since the parser folds both into one cap, a separate SSE
  `maxMessageSize` (checked at `onEvent`, after the buffer already enforced the bound)
  would add **no defense**.
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
- SSE-client `maxMessageSize` — subsumed by `eventsource-parser`'s `maxBufferSize`
  (see §2).
- Replacing `eventsource-parser` — its native `maxBufferSize` is sufficient.

## Testing

Per transport, three cases:

0. **json-lines `maxBufferSize` regression (§0.5)** — in `@enkaku/stream`:
   - `maxBufferSize` set, `maxMessageSize` **unset**: a deeply-nested / huge value
     streamed across many short newline-terminated lines → errors (the gap this
     closes; would hang/grow unbounded before the fix).
   - single oversized un-terminated line still errors (existing behavior preserved).
   - valid multi-line message under the cap still decodes.
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
`@enkaku/http-client-transport`, `@enkaku/http-server-transport`. Two behavioral
changes for existing users, both hardening, both called out in the changeset:

- `@enkaku/stream` — `maxBufferSize` now bounds total framer memory (§0.5), so a
  multi-line stream that passed under the old `input`-only cap may now error. Affects
  any `maxBufferSize` caller, including `socket-transport`.
- `@enkaku/http-server-transport` — new `maxRequestBodySize` defaults to 1 MiB, so
  bodies over 1 MiB get `413` unless the cap is raised.

Everything else is additive.
