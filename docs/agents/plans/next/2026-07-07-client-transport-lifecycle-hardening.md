# Client / transport lifecycle hardening

**Origin:** 2026-07-03 repo audit (`completed/2026-07-03-repo-audit.complete.md`), priorities 2–3. All findings verified in source.

## High severity

- **Client read loop dies permanently on a malformed server message** (`packages/client/src/client.ts:262, 328, 396`). `#controllers` is a plain `{}` — a message with `rid: "__proto__"` returns `Object.prototype`, passes the null check, and `controller.error()` throws → unhandled rejection in the floating `#read()` promise → every current and future request hangs silently. The server already uses `Object.create(null)` (`packages/server/src/server.ts:102`); the client should match, plus a try/catch around message dispatch.
- **Graceful remote close hangs the client** (`packages/client/src/client.ts:369-371`). `read()` returning `done` just exits the loop — controllers are never aborted and `handleTransportDisposed` never fires (nothing disposes the transport when its readable ends). A clean socket close leaves in-flight requests hanging and never invokes the reconnect callback. Treat `done` as transport-disposed.
- **Socket write-after-close can crash the process** (`packages/socket/src/index.ts:78-98`). `detach()` removes the socket's only `'error'` listener once the readable settles; a later `socket.write()` on the destroyed socket emits `'error'` with zero listeners → uncaught exception.
- **Active SSE streams killed at `sessionTimeoutMs` despite live traffic** (`packages/http-serve/src/index.ts:133-149`). `session.lastAccess` is refreshed only by inbound POSTs, never by outbound SSE writes, so passive stream consumers are cut off at the 5-minute default. Refresh `lastAccess` on writes.

## Medium severity

- Client disconnect never aborts http-serve handlers — they keep computing until `controllerTimeoutMs` (`packages/http-serve/src/index.ts:155-204, 335-341`).
- http-serve `inflight.set(rid)` is unconditional — rid reuse within the window hijacks or hangs responses (`packages/http-serve/src/index.ts:279-300`).
- Auth-mode ordering race can drop a channel `send` arriving right behind its channel open (`packages/server/src/server.ts:686` vs `742`) — async `process()` is not awaited, so `send` verification can win the race against channel registration.
- No backpressure on socket reads/writes or SSE enqueue (`packages/socket/src/index.ts:52-56, 89-92`; `packages/http-serve/src/index.ts:192`) — fast producer + slow consumer grows memory unboundedly.
- Event write failures resolve as success; over http-fetch a non-2xx response for a rid-less message produces no `writeFailed` signal at all (`packages/client/src/safe-write.ts:31-48`; `packages/http-fetch/src/index.ts:244-266`).
