# `Server.dispose()` still reads and admits messages while draining

**Origin:** final whole-branch review of `transport-lifecycle-hardening` (2026-07-11), remaining Low finding 1. Not a regression from that branch — the same shape predated it — but the branch's `pending` map makes it both visible and cheap to close.

## The gap

`Server.dispose()` aborts every registered controller, drains `pending` (auth in flight), then drains `running` (handlers in flight), then disposes the transport. But `handleNext()` (`packages/server/src/server.ts`) never checks `signal`, and the transport is only disposed *after* `handling.done` resolves.

So a message **arriving during** the drain is still read, auth-checked, and can register a controller after the abort-all loop has already run. The handler then runs to completion on a signal that is never aborted — `handleRequest` gives it a fresh `AbortController` unlinked from `ctx.signal` (`packages/server/src/handlers/request.ts`), so nothing later catches it either.

The lifecycle-hardening branch closed the "already in flight when `dispose()` was called" case, which was the one it was scoped to. This is the "arrives while `dispose()` is running" case — same shape, one step further out.

## Sketch

Either bail early in `handleNext()` when `signal.aborted`, or make the disposer drain-then-recheck: abort-all, drain, and if new controllers appeared, loop. The first is simpler and is probably right — once `dispose()` has started there is no reason to admit new work.

Bounded either way by the existing `cleanupTimeoutMs` race in `Server.dispose`, so it cannot hang shutdown.

## Also worth folding in

`packages/http-serve/src/index.ts`: the guarded `reportRequestAborted` helper has a throwing-callback test only on the `dropSession` path. The sweep interval and the SSE `request.signal` listener are guarded by construction (they route through `clearSessionInflight`), but the request-`signal` listener calls `reportRequestAborted` **directly**, with no test of its own — a future edit there could reintroduce a raw unguarded call undetected. One mirrored isolation test closes it.
