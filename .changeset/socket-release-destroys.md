---
'@enkaku/socket': patch
---

`createTransportStream` now destroys its socket when the writable reaches any terminal state, instead of half-closing it with `end()` and dropping the event-loop reference with `unref()`.

Neither `end()` nor `unref()` closes a socket: the read side stays open and the peer keeps seeing a live connection. `SocketTransport` was unaffected — its `disposed` hook already destroyed the socket — but a consumer using `createTransportStream` **bare**, with no `Transport` on top and so no `disposed` event to hook, had no release path at all and leaked the socket until the process exited.

The socket is now released on every exit from the writable sink: a clean close (after the flush), an explicit `writer.abort()`, and a rejected write — which errors the stream and runs neither the `close` nor the `abort` callback, and is the path a stalled peer takes. The flush still runs before the destroy, so a clean close does not truncate.

**Behaviour change for bare `createTransportStream` consumers:** closing the `writable` used to half-close the socket, leaving the `readable` side alive to drain the peer's remaining responses. It now destroys the socket, so the read side ends with it. If you relied on that half-close, keep the `writable` open until you are done reading.
