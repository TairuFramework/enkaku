# Server shutdown follow-ups from the abort-signal/release-lifecycle branch

**Origin:** Minor findings from the task and whole-branch reviews of `abort-signal-and-release-lifecycle` (2026-07-13). None block merge; all were triaged as follow-ups. Grouped because they are all in the same shutdown path and would share a branch.

## 1. Two independent rid generators for one event message

`packages/server/src/server.ts`. An event carries no `rid`, so the server mints synthetic ones — **twice**, independently, in two namespaces:

- `~:916` — `track(runtime.getRandomID(), ...)`, crypto-strength, keys the `pending` map (the dispose barrier).
- `~:385` — `Math.random().toString(36).slice(2)`, keys `running` / `controllers` / the limiter's bookkeeping.

They never interact, so this is not a bug. But "why are there two rid generators for one event" is a real trap for the next reader, and the weaker of the two (`Math.random()`) is the one keying the limiter. Thread a single generated ID through both.

## 2. Wall-clock timing in the drain-window tests

`packages/server/test/dispose-read-window.test.ts`. Tests 1 and 2 use bare `setTimeout(10/20/50)` to land a message inside the dispose drain window. They are mutation-proven and green, and the timings are inherent to the code shape — but they are a real flake surface on loaded CI. If they go intermittent, this is why.

## 3. `handleEvent` remains un-abortable by design — but check the comment stays true

Events deliberately register no controller and are never aborted on dispose (fire-and-forget, explicit product decision — they have no reply, so "let it finish" is coherent, and `cleanupTimeoutMs` bounds the cost). The branch *did* add `track()` so an event's in-flight **access check** now enters the `pending` barrier, which makes the disposer's comment at `~:268-273` true for events for the first time.

If anyone later revisits whether event handlers should be abortable, that is an API addition (`signal` on `EventHandlerContext`) and wants its own spec — see the out-of-scope section of `docs/superpowers/specs/2026-07-13-abort-signal-and-release-lifecycle-design.md` for the argument.

## 4. `http-serve` guard test discriminates via an uncaught exception

`packages/http-serve/test/disconnect-abort.test.ts`. The throwing-`onRequestAborted` test reds by taking the process down (exit 1) rather than via a scoped `expect`. This is **correct** — WHATWG event dispatch reports listener exceptions through the global mechanism, so `abort.abort()` cannot throw to the caller and a scoped assertion is genuinely unavailable — and it is arguably a stronger proof of the hazard the guard defends against.

Optional hardening: an in-test `process.once('uncaughtException', ...)` asserted directly would make the signal scoped rather than a process-level side effect that some CI wrappers surface less clearly. Tidier, not more correct.

## 5. Isolation proof is weaker than its sibling

Same file. The new test's isolation check is a **sequential** second request after the throw; `sse-buffer-limits.test.ts:113` proves cross-session isolation **concurrently**. Reasonable as-is — this call path has no shared writable or session concept, and `entry.resolve`/`inflight.delete` both run before the throwing call — but it does not rule out corruption of a request that is concurrently in flight at the moment of the throw. A stronger variant keeps `r2` pending when `r1` is aborted.
