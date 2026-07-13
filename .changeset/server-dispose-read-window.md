---
'@enkaku/server': patch
---

Shutdown fixes.

**`Server` no longer reads and admits new messages while `dispose()` is draining.** `dispose()` aborts every registered handler controller, then waits for the in-flight ones to finish. But the read loop never checked whether disposal had started, so a message arriving *during* that wait was still read, authenticated, and could register its controller after the abort-all sweep had already passed — leaving a handler running on a signal nothing would ever abort, after `dispose()` had resolved. Such messages are now dropped with a warning log and the read loop stops. Clients receive no reply for them; they see the transport close, as they would anyway.

**`dispose()` no longer deadlocks when the replay cache throws.** On that path the server awaited its own disposer from inside a handler-tracking entry that the disposer itself waits on, so the graceful shutdown path could never complete and `dispose()` only returned once `cleanupTimeoutMs` (30 seconds by default) expired and force-disposed the transports. This only affects servers with a custom `ReplayCache` that can throw — a remote cache losing its connection, for example; the built-in in-memory cache never does.

**A handled transport is now disposed on every route, not just via `Server.dispose()`.** When message handling ended on its own — a peer hanging up, a transport read error, a replay-cache failure — the server detached the transport from its active list without ever closing it. The shutdown deadlock above had been masking this: it held the entry open long enough for the timeout path to clean up. In-flight handlers still flush their final replies before the transport closes.

**A transport whose `dispose()` never settles can no longer hang the server.** Every wait on `transport.dispose()` is now bounded by `cleanupTimeoutMs`: the per-transport close above, so it cannot hang `Server.handle()`, *and* `Server.dispose()`'s force-disposal backstop, so it cannot hang `Server.dispose()` either. That backstop also disposes the remaining transports concurrently, so one transport that will not close no longer delays closing the others.

**Shutdown no longer leaves its cleanup timers armed.** Both `cleanupTimeoutMs` races — the per-transport close and `Server.dispose()`'s graceful race — armed a timer that the winning side never cancelled. In the normal case the other side always wins, so every client disconnect left one live 30-second timer behind (while the server already reported zero active transports), and `Server.dispose()` held the event loop open for `cleanupTimeoutMs` after it had already resolved.

**The disposal drain now waits for an event's access check too.** In `requireAuth` mode, the access check for an `event` message was not tracked, so `dispose()` could resolve while one was still in flight and the handler then fired after shutdown had completed. Event handlers remain fire-and-forget and are still not abortable; only the drain changed.

**A `Server` constructed with an already-aborted `signal` now actually disposes.** Previously the teardown callback ran before the instance had finished initializing, threw internally, and was swallowed — so `dispose()` reported success while the server never disposed its transports, never aborted its handlers, and never cleared its cleanup interval.

**Forced disposal no longer skips transports.** The timeout path iterated the active-transport list while entries were being removed from it, so it could step over some of them.
