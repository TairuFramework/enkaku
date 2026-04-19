# Server/Client Teardown & Lifecycle Events

**Status:** complete
**Date:** 2026-04-18
**Branch:** `fix/hub-teardown`

## Goal

Eliminate unhandled `Promise` rejections during `@enkaku/server` + `@enkaku/client` teardown paths (hub channel close + dispose races originally surfaced in kubun `HubRelayManager` integration tests) and introduce a coherent lifecycle-events surface on `Transport`, `Server`, and `Client`.

## Key design decisions

- **Root cause was generic, not hub-specific.** Fire-and-forget writes on closed/closing transports plus a `void this.#write(...)` in the client abort path plus an inverted guard in `Client.#abortControllers` together produced the symptom. Fixed at the source rather than filtered at consumer boundaries.
- **`isBenignTeardownError` classifier lives in `@enkaku/async`** alongside `DisposeInterruption`. Avoids a new package, stays reachable from every layer that needs it. Matches `AbortError`, `DisposeInterruption`, WritableStream-closed / reader-closed / writer-closed patterns, and the string reasons `'Close'` / `'Transport'`.
- **Central `safeWrite` wrappers** in `@enkaku/server` and `@enkaku/client` own classification + teardown-error swallowing. Server version is generic over `Protocol`; client version uses a structural `WriteTarget = { write(v: unknown) => Promise<void> }` because TS2589 blocked the generic form (confirmed experimentally).
- **Behaviour change:** `ChannelCall.close()` / `StreamCall.close()` now settle the call promise with a `'Close'` rejection. Previously the promise hung until eventual `client.dispose()`, which created a race window where the server's result-write landed on a disposing client transport.
- **Lifecycle events, not callbacks.** `Transport.events`, `Server.events`, `Client.events` all expose an `EventEmitter` with symmetric disposal signals (`disposing` → work → `disposed`). Benign swallows surface as `writeDropped` rather than silent drops or unhandled rejections.
- **Auto-reconnect deliberately out of scope.** A future `ReconnectingTransport` wrapper consumes the new `TransportEvents` surface and lives in a later spec.
- **Spec's fire-and-forget emit risk hardened via `.catch(() => {})` at every unawaited emit site** rather than changing `EventEmitter.emit` semantics — avoids a cross-repo behaviour change while closing the listener-throws-become-unhandled-rejections hole.

## What was built

- **`@enkaku/async`** — exported `isBenignTeardownError` utility with 8-case truth-table test.
- **`@enkaku/transport`** — extended `TransportEvents` with `readFailed`, `disposing`, `disposed`; base `Transport` class emits them. Existing `writeFailed` preserved for transports with rid context (e.g. `http-server-transport`).
- **`@enkaku/server`** — new internal `safe-write.ts`; inline send closure replaced. Handler promise gains `.catch` routing to `handlerError`. Every fire-and-forget `context.send` now threads `rid` and has a `.catch(() => {})`. `ServerEvents` extended with `handlerStart`, `handlerEnd`, `handlerAbort` (previously dead type — wired at timeout, dispose, and client-abort sites), `writeDropped`, `writeFailed`, `disposing`, `disposed`, `transportAdded`, `transportRemoved`. `HandlerContext` augmented with `disposing: { value: boolean }` flag and two-arg `send`. Removed the old `transport.events.on('writeFailed', …)` subscription now that `safeWrite` handles the abort-on-failure internally.
- **`@enkaku/client`** — new `ClientEvents` emitter exposed via `Client.events`; new internal `safe-write.ts`; `#write` delegates to it; `#handleSignal` abort listener always settles the call (previously hung on `'Close'`) and deletes the controller. Fixed the inverted guard in `#abortControllers` so disposal actually propagates aborts to in-flight requests. Emits `requestStart`, `requestEnd`, `requestError`, `writeDropped`, `transportError`, `transportReplaced`, `disposing`, `disposed`.
- **Tests** — unit `safe-write.test.ts` + `lifecycle-events.test.ts` in both packages, regression tests `close-settles.test.ts`, `teardown-no-unhandled.test.ts`, `dispose-aborts-controllers.test.ts`, hub repro in `packages/hub-server/test/hub.test.ts`, cross-package `tests/integration/teardown.test.ts`.
- **Docs** — `docs/agents/architecture.md` gained a Lifecycle events section referencing the new surfaces and `isBenignTeardownError`.

## Scope notes

The original `docs/superpowers/specs/2026-04-18-hub-server-teardown-unhandled-rejections.md` bug report and a follow-up `2026-04-18-client-abort-controllers-guard-bug.md` spec are both subsumed by this effort. The abort-controllers guard fix landed as a one-commit follow-up after the main plan because the bug surfaced only in dispose-without-close scenarios not covered by the initial regression tests.

## Outcomes

- 18 commits on `fix/hub-teardown`, `pnpm run test` clean repo-wide except the pre-existing `@enkaku/node-streams-transport` timing test that fails on `main` too.
- Two independent code reviews (in-loop final reviewer + formal pre-merge reviewer) flagged seven follow-ups total — all addressed in-branch.
- Kubun `HubRelayManager` Phase 7a/7b regression test path is unblocked pending consumer QA.

## Follow-ups (out of scope, future work)

- `ReconnectingTransport` wrapper (separate spec) consuming the new transport lifecycle events.
- Source-availability abstraction (shape TBD with the reconnect spec).
- Per-transport retry policies in `http-client-transport`, `socket-transport`, etc.
