# `@enkaku/socket`: connect has no timeout, and dispose never releases the socket

**Origin:** found downstream while hardening `@tejika/process`'s daemon lifecycle (2026-07-09..11). Both gaps forced local mitigations in tejika's `packages/process/src/client.ts`; the second one caused a real socket leak there that only surfaced under review. Neither is a regression — both predate that work.

Two independent gaps in `packages/socket/src/index.ts`. They are separate bugs but sit either side of the same socket lifecycle, so they're likely one fix pass.

## 1. `connectSocket` has no connect timeout, and leaks both listeners

```ts
const socket = createConnection(path)
return new Promise<Socket>((resolve, reject) => {
  socket.on('connect', () => resolve(socket))
  socket.on('error', (err) => reject(err))
})
```

- **No timeout.** `createConnection` against a socket path that exists but has nothing accepting can hang indefinitely. There is no way for a caller to bound the attempt — no `timeoutMs`, no `signal`. Any caller that must not hang has to race it themselves.
- **Both listeners are `on`, not `once`,** and neither is removed once the promise settles. They stay attached to a socket that may live for hours. The `error` listener in particular remains attached forever, so every post-connect socket error calls a `reject` on an already-settled promise — a silent no-op that also keeps the promise's closure alive for the socket's whole lifetime.

**Downstream mitigation (tejika):** `connectWithTimeout` races `connectSocket(path)` against a timer and, when the timer wins, destroys the socket once the pending connect eventually settles — so the late socket doesn't leak. That mitigation only exists because the timeout isn't available upstream; the listener leak it cannot fix at all.

**Sketch:** accept `{ timeoutMs?, signal? }`; use `once` for both listeners and detach the loser on settle; destroy the socket if the attempt is abandoned.

## 2. `SocketTransport` dispose only `unref()`s — and skips function sources entirely

```ts
if (typeof source !== 'function') {
  this.events.on('disposed', async () => {
    try {
      const sock = await source
      sock.unref()
    } catch {}
  })
}
```

Two problems, and the second is the sharp one:

- **`unref()` is not a release.** It only stops the socket holding the event loop open. The socket stays *open*, and the peer's server still sees a live connection — so a server waiting to drain its connections before closing will wait forever. Releasing a socket means `destroy()` (or at least `end()`), not `unref()`.
- **A function `source` gets no release hook at all.** The `typeof source !== 'function'` guard means any lazily-connecting or *reconnecting* transport — exactly the shape a reconnect-with-backoff client needs, since the socket must be re-created per attempt — never registers the `disposed` handler. Disposing that transport releases nothing.

Compounding it: `Transport.dispose()` only closes the writer if a stream was ever lazily created (`@enkaku/transport`), and the writer's close callback (`socket.end()` + `unref()`) is the *only* other path that touches the socket. So a transport that was constructed but never read from or written to leaves its socket fully open on dispose, by every available route.

**How it bit tejika:** a reconnecting `SocketTransport` (function source) used *bare*, without a `Client` on top, leaked a live socket on `dispose()` — keeping the peer daemon's server alive and hanging its shutdown. Tejika now explicitly does `transport.dispose().then(() => socket.destroy())` and tracks the current socket across reconnects to do it. That bookkeeping belongs in the transport.

Note the ordering constraint if you fix this upstream: destroy the socket *after* the transport settles, because dispose closes the writer, whose close callback `end()`s the socket (and then `unref()`s it) — and `end()`ing an already-destroyed socket raises `ERR_STREAM_DESTROYED`.

**Update (2026-07-11, after the transport-lifecycle-hardening branch):** that hazard is now much less sharp. `createTransportStream` attaches an `'error'` listener at stream creation that is *never* removed, and records the last error in a `socketError` cell (previously the only `'error'` listener was removed by `detach()` once the readable settled, so a late error escalated to an uncaught exception). A late `ERR_STREAM_DESTROYED` is therefore absorbed rather than crashing the process. The ordering is still worth getting right, but it is no longer a crash if you get it wrong.

Two other things that branch changed, which this fix must now coordinate with:

- The writable sink guards on `socket.destroyed || socket.writableEnded` and throws `Error('Socket is closed')`. A `destroy()`-on-dispose hook makes that guard the normal post-dispose path for any in-flight write, rather than an edge case.
- The writable's close callback still does `socket.end()` + `socket.unref()`. If the dispose hook starts calling `destroy()`, decide deliberately whether that callback should keep `end()`ing or defer entirely to the hook — having both paths touch the socket is what makes the ordering delicate in the first place.

**Sketch:** register the release hook for function sources too (resolve whichever socket is current at dispose time), and make the hook `destroy()` rather than `unref()`.

## Why it's worth doing

Both gaps are invisible until you build a reconnecting client on top, at which point they're load-bearing: one can hang a connect forever, the other silently keeps the remote server alive after you thought you disconnected. Every consumer that hits them has to write the same two workarounds tejika did.
