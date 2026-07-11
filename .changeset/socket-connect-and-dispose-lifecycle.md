---
'@enkaku/socket': minor
---

Socket connect and dispose lifecycle.

- `connectSocket(path, options?)` accepts `{ timeoutMs, signal }`. The connect attempt now times out after **10 seconds by default** — pass `timeoutMs: 0` for the previous unbounded behaviour. An abandoned attempt (timeout or abort) destroys its pending socket, and both the `connect` and `error` listeners are detached once the promise settles (the `error` one previously stayed attached for the socket's whole life).
- The transport stream's writable close callback now awaits `socket.end()`'s flush, bounded by a 2 second grace, so `writer.close()` no longer resolves with bytes still queued.
- **`SocketTransport.dispose()` now destroys the socket** rather than only `unref()`ing it, and does so for every source shape — including a function source, which previously registered no release hook at all. `unref()` left the socket open, so a peer server draining its connections before closing would wait forever. A transport built from a function source that was never read from or written to opens no socket, and therefore has none to release.
- `SocketTransportParams` accepts `connectTimeoutMs`, applied when `socket` is a path string. Such a path is now connected **lazily**, on first read/write, rather than eagerly in the constructor.
