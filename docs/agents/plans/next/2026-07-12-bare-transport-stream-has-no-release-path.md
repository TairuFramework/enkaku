# A bare `createTransportStream` consumer has no way to release its socket

**Origin:** found by the final whole-branch review of `socket-connect-and-dispose-lifecycle` (2026-07-12). Pre-existing — the branch bounded the wait in front of it but did not change the outcome.

`createTransportStream` is exported and used **directly**, without a `Transport` on top — mokei's `host-monitor` does `createTransportStream(connectSocket(path))`. Those consumers get no release path for their socket at all:

- The only code that touches the socket on teardown is the writable's close callback, which does `socket.end()` + `socket.unref()`.
- `end()` half-closes. If the peer is draining, it will see the FIN and close — fine.
- If the peer has **stalled**, the flush times out after `END_GRACE_MS` (2s) and the callback just resolves and `unref()`s a socket that is still **half-open**. Nothing destroys it.

For a `SocketTransport` this is covered: the `disposed` hook destroys the socket after the flush. A bare consumer has no `disposed` event to hook, so the socket lingers until the process exits.

This is not a leak the connect-and-dispose-lifecycle branch introduced — the pre-branch callback was `socket.end(); socket.unref()`, which leaves *exactly* the same half-open socket when the peer stalls. The branch only added a bounded wait in front of it. But that branch established the principle that releasing a socket means `destroy()`, and the bare path is the one place in the package that still doesn't.

**Sketch:** give `createTransportStream` a way to release — either destroy the socket when the flush grace expires (the peer is stalled; a half-open socket it will never read is worth nothing), or return a disposer alongside the stream pair so a bare consumer has something to call. Prefer the first if no consumer needs the handle: it makes the guarantee unconditional rather than opt-in.

Check mokei's `host-monitor` before changing the contract — it is the known bare consumer.
