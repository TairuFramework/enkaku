# Transport Stability — Completed

**Status:** complete
**Completed:** 2026-06-11
**Spec:** `docs/agents/plans/next/2026-06-10-audit-remediation-design.md` (shared audit-remediation design; retained for sibling plans)
**Commits:** `c42481b`, `9fccf60`, `8882771`, `d5b06b3`, `1df3ef5`, `f4416d5`, `51637a4`, `9631b00`, `7ac4b7a`, `d919070`, `573e58f`, `c984866`, `d2aeb17`, `fe65f92`, `d341d10`, `b329c7c`, `3f090db` (branch `chore/fable-audit`)

## Goal

Eliminate the transport-edge stability bugs from the June 2026 audit (Plan 2 of the audit-remediation design): process crashes, UTF-8 corruption, silent read-loop death, inflight-slot leaks, swallowed disconnects, hanging disposers, floating writer promises, and the folded-in medium-severity client/transport fixes.

## What was built

Sixteen localized fixes, each gated by an attack- or failure-shaped regression test following the existing zero-unhandled-rejection pattern, plus one cross-task hardening fix found in final review:

- **socket-transport** — settled-state guard on the `ReadableStream` controller so a `close` event after an `error` no longer calls `controller.close()` on an errored controller (process crash); listeners detached on settle; raw `Buffer` passed through to the decoder instead of per-chunk `toString()`.
- **stream/json-lines** — per-instance streaming `TextDecoder` (`{ stream: true }` + flush) so multi-byte UTF-8 split across chunks no longer corrupts to U+FFFD, and concurrent streams no longer share decoder state; a default `onInvalidJSON` that `console.warn`s dropped lines instead of silently discarding them.
- **server** — `transport.read()` wrapped so a read rejection settles `handle()`, emits a new `transportError` event, and disposes cleanly instead of dying as an unhandled rejection; floating channel writer `write()`/`close()` promises caught; settled transports spliced out of the `#handling` list (with a public `activeTransportsCount` getter).
- **http-server-transport** — stream/channel rids released from the inflight map on terminal payloads and on session teardown, so the server no longer wedges into blanket 503s.
- **http-client-transport** — SSE disconnects now error/close the readable and reset session state (in-flight calls reject instead of hanging); a non-ok POST enqueues a per-rid error payload instead of erroring the shared session; all controller enqueues guarded against an already-errored readable.
- **client** — `#setupTransport` captures the transport and stale-guards its disposed handler so a replaced transport can't abort a healthy client; `request.abort()` handles a rejected `sent` promise without an unhandled rejection.
- **async/Disposer** — `disposed` always settles even when the dispose callback (or a user `onDisposeError`) rejects/throws, surfacing the error via a new optional `onDisposeError` (fallback `console.warn`).
- **node-streams-transport** — the floating `pipeTo` is caught and surfaced via `writeFailed`; `TransportEvents.writeFailed.rid` relaxed to optional.
- **message-transport** — dispose now closes the readable controller and the port (and detaches `onmessage`), so pending reads settle and the port stops keeping the process alive.
- **integration** — a new cross-package test destroys both sockets mid-request over real Unix sockets and asserts zero `uncaughtException` / `unhandledRejection`, request rejection, and clean disposal — exercising the socket-guard + decoder + server-read-error fixes composed.

## Key design decisions

- **Fail-closed guards over behavioral rewrites.** Every fix adds a guard/catch on a known crash or leak path rather than restructuring control flow, keeping each change local to one module and the repo green after every commit. Task ordering (socket guard → decoder → server/HTTP lifecycle → medium-severity → integration) preserved that invariant.
- **Errored readable is the transport-death signal.** An unexpected SSE disconnect permanently errors the per-transport readable; recovery is the Client layer's transport-replacement path, not in-transport reconnect. The `sessionState`-to-idle reset is retained but is effectively vestigial under this model.
- **Per-rid rejection vs. session kill.** A single failed POST rejects only its own rid (synthetic error payload, code `EK_HTTP_REQUEST_FAILED`); `controller.error` is reserved for genuine session-level failures, so one bad call no longer destroys every other in-flight call on the shared readable.
- **`disposed` must always settle.** Because Transport/Client/Server all extend Disposer, a hanging `disposed` cascades into every teardown chain; the rejection and throwing-handler paths both resolve the deferred.

## Cross-task hardening (final review)

The holistic composition review caught one real interaction the per-task reviews missed: the OK-response `res.json().then(enqueue, error)` path in http-client-transport could throw an unhandled rejection when a concurrent SSE disconnect (the new Task-6 behavior) had already errored the shared readable. Both callbacks are now guarded, matching the non-ok path (`3f090db`).

## Known limitations (deliberately out of scope)

- **In-transport SSE reconnect** is not implemented — an errored readable is recovered only via Client-layer transport replacement. Reconnect logic was backlogged by the design doc.
- **MessageTransport dispose-before-materialize** still skips port close when the lazy stream never initialized (rare orphan path). The correct fix lives in base `Transport.dispose()` gating, which is cross-cutting across all transports and belongs to its own task.

## Verification

Full workspace `pnpm run build` 39/39; `pnpm run test` 75/75 tasks; lint clean (`rtk proxy pnpm run lint`, 494 files). Per-package counts after the work: socket-transport 13, stream 26, server 127, http-server-transport 31, http-client-transport 16, async 103, client 43, node-streams-transport 2, message-transport 9, integration green. Each task passed spec + code-quality review; a final holistic composition review approved the whole change (after the `3f090db` fix).

## Follow-on

None blocking. The two known limitations above are candidates for the backlog. Sibling audit-remediation plans (hub-hardening, platform-fixes) remain in `next/`.
