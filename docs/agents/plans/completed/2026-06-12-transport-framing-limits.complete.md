# Transport framing/size limits — completed

**Status:** complete
**Date:** 2026-06-12
**PR:** TairuFramework/enkaku#36 (`chore/mokei-next → main`)
**Origin:** mokei hang/crash-core audit, item 6.

## Goal

Give every Enkaku transport that ingests an untrusted byte/event stream a bounded-memory knob, and close a latent unbounded-memory gap in the JSON-lines framer. Expanded from the original node-streams-only backlog item to all affected transports.

## What was built

- **`@enkaku/stream`** — extracted a shared `FramingLimits` base type (`{ maxBufferSize?, maxMessageSize? }`); `FromJSONLinesOptions` now intersects it. `fromJSONLines`'s `maxBufferSize` now bounds **total framer memory** (`input.length + output.length`), checked on chunk entry and after each accumulated line.
- **`@enkaku/node-streams-transport`** — threads `FromJSONLinesOptions<R>` flat into `NodeStreamsTransportParams<R>` / `CreateTransportStreamOptions<R>`, passed into `fromJSONLines`. Additive.
- **`@enkaku/http-client-transport`** — `maxBufferSize` wired into `eventsource-parser`'s native cap; an `onError` handler errors the readable and aborts the session on `max-buffer-size-exceeded`. Additive.
- **`@enkaku/http-server-transport`** — new `maxRequestBodySize` (default 1 MiB) on `ServerBridgeOptions`/`ServerTransportOptions`, enforced in `handlePostRequest` via a `content-length` fast path + a byte-counting streamed reader; oversized → `413`.

## Key design decisions (rationale preserved)

- **JSON-lines is the fixed wire format** for the two byte-stream transports — no pluggable codec — so framing options are **core transport params, spread flat**, not nested under a sub-concern. `socket-transport` set this precedent; `node-streams-transport` was the odd one out.
- **`maxBufferSize` vs `maxMessageSize` cover different surfaces.** In json-lines, `maxBufferSize` bounds the raw per-line `input` (trimmed each newline) while a *logical* message accumulates in `output` across lines. The latent gap: setting `maxBufferSize` alone left `output` unbounded against a value streamed across many short lines. Fix folds `output` into the `maxBufferSize` check, matching `eventsource-parser`, which already bounds both its partial-line and multi-line-event surfaces with one cap. After the fix: `maxBufferSize` = complete memory-DoS defense on its own; `maxMessageSize` = optional tighter per-message cap.
- **SSE needs only `maxBufferSize`.** `eventsource-parser`'s single cap already covers the multi-line-accumulation surface that `maxMessageSize` guards in json-lines, so a separate SSE `maxMessageSize` would add no defense.
- **`message-transport` is out of scope** — in-process, no byte stream.
- **SSE units differ by mechanism:** json-lines limits are in characters (UTF-16 code units); `maxRequestBodySize` is in bytes. Documented on `FramingLimits`.

## Two behavior changes (hardening)

1. `@enkaku/stream` — `maxBufferSize` counts `input + output`; a multi-line stream that passed under the old input-only cap may now error. **Also affects `@enkaku/socket-transport`.**
2. `@enkaku/http-server-transport` — `maxRequestBodySize` defaults to 1 MiB; bodies over 1 MiB return `413` unless raised.

## Verification

TDD throughout (6 task commits, two-stage review per task). New attack-scenario tests: multi-line buffer accumulation, un-terminated SSE event, oversized body (content-length + streamed paths), malformed-JSON 400. Suites: stream 27, socket 13, node-streams 3, http-client 17, http-server 36. Build + lint clean.

## Follow-on work

- Changelog entry for the two behavior changes — see `backlog/changelog-framing-limits-behavior-changes.md`.
- Downstream (mokei repo, separate): wire `maxBufferSize`/`maxMessageSize` into `spawnHostedContext` so a poisoned/oversized stdio stream reaps the context instead of hanging. Tracked in mokei hang/crash-core plan, item 6.
