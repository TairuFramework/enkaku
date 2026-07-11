# `@enkaku/socket`: connect timeout and socket release on dispose

**Date:** 2026-07-11
**Status:** approved

## Problem

Two independent gaps in `packages/socket/src/index.ts`, either side of the same socket lifecycle. Both were found downstream while hardening `@tejika/process`'s daemon lifecycle, and both forced local mitigations there. Neither is a regression.

### 1. `connectSocket` cannot be bounded, and leaks its listeners

```ts
const socket = createConnection(path)
return new Promise<Socket>((resolve, reject) => {
  socket.on('connect', () => resolve(socket))
  socket.on('error', (err) => reject(err))
})
```

`createConnection` against a socket path that exists but has nothing accepting hangs indefinitely, and there is no `timeoutMs` or `signal` to bound it — a caller that must not hang has to race it itself. Both listeners are `on`, not `once`, and neither is removed once the promise settles: the `error` listener stays attached for the socket's whole life, so every post-connect error calls `reject` on an already-settled promise (a silent no-op that also pins the promise's closure).

Tejika works around this with a `connectWithTimeout` that races `connectSocket` against a timer and destroys the late socket when the timer wins. The listener leak it cannot work around at all.

### 2. `SocketTransport` dispose only `unref()`s, and skips function sources

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

`unref()` is not a release: it only stops the socket holding the event loop open. The socket stays *open* and the peer's server still sees a live connection, so a server draining its connections before closing waits forever. And the `typeof source !== 'function'` guard means a lazily-connecting or reconnecting transport — the shape a reconnect-with-backoff client needs — never registers the hook at all, so disposing it releases nothing.

Compounding it: `Transport.dispose()` only closes the writer if a stream was ever lazily created, and the writer's close callback (`socket.end()` + `unref()`) is the only other path that touches the socket. A transport constructed but never read from or written to therefore leaves its socket fully open on dispose by every available route.

This bit tejika directly: a reconnecting `SocketTransport` used bare, without a `Client` on top, leaked a live socket on `dispose()`, keeping the peer daemon's server alive and hanging its shutdown. Tejika now tracks the current socket across reconnects and does `transport.dispose().then(() => socket.destroy())` by hand. That bookkeeping belongs in the transport.

## Key constraint

`Transport._getStream()` memoizes the stream, so a function `source` is invoked **at most once per transport instance**. Reconnection means a new transport per attempt, not a source called repeatedly. "Track the current socket across reconnects" therefore reduces to "capture the one socket this transport ever resolved" — no bookkeeping across attempts is needed.

## Design

### 1. `connectSocket(path, options?)`

```ts
export type ConnectSocketOptions = {
  /** Milliseconds before the connect attempt is abandoned. Defaults to 10_000. `0` disables. */
  timeoutMs?: number
  signal?: AbortSignal
}

export function connectSocket(path: string, options?: ConnectSocketOptions): Promise<Socket>
```

- `once` for both `connect` and `error`; the loser is detached on settle, so a settled promise leaves zero listeners attached to the socket.
- A timer (`unref()`ed, so it never holds the event loop open) rejects with `Error('Socket connect timed out after <n>ms')`. Default 10s; `timeoutMs: 0` disables it.
- `signal`: a pre-aborted signal rejects with `signal.reason` before `createConnection` is called; a mid-flight abort rejects with `signal.reason`. The abort listener is removed on settle.
- On either abandon path (timeout or abort) the pending socket is `destroy()`ed immediately, cancelling the attempt. No late socket to leak, which removes the need for tejika's `connectWithTimeout` entirely.
- The existing `withSpan` wrapper is unchanged and records the rejection as before.

The default timeout is a deliberate behaviour change: every connect is now bounded unless the caller opts out.

### 2. `createTransportStream` writable close callback

The close callback becomes async and flushes before releasing:

```ts
async () => {
  await new Promise<void>((resolve) => {
    if (socket.destroyed || socket.writableEnded || socketError != null) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, END_GRACE_MS)
    timer.unref()
    socket.end(() => {
      clearTimeout(timer)
      resolve()
    })
  })
  socket.unref()
}
```

`writeTo`'s close callback is an `UnderlyingSinkCloseCallback`, so it may return a promise and `writer.close()` awaits it. This makes `writer.close()` resolve only once buffered writes have actually flushed — today it resolves while bytes are still queued, so a `destroy()` on dispose could drop a message written just before it.

`END_GRACE_MS` is a hardcoded 2s bound so a stalled peer cannot hang dispose. No option is exposed until something needs one.

`unref()` stays. `createTransportStream` is exported and used bare, without a `Transport` on top; such a caller has no `disposed` hook, and `unref()` at least keeps the half-closed socket off the event loop.

### 3. `SocketTransport`

```ts
export type SocketTransportParams<R> = CreateTransportStreamOptions<R> & {
  socket: SocketSource | string
  signal?: AbortSignal
  /** Connect timeout when `socket` is a path. Defaults to 10_000; `0` disables. */
  connectTimeoutMs?: number
}
```

```ts
const source = typeof socket === 'string'
  ? () => connectSocket(socket, { timeoutMs: connectTimeoutMs, signal })
  : socket

// Memoized: a function source is invoked at most once per transport.
let socketPromise: Promise<Socket> | undefined
if (typeof source !== 'function') {
  socketPromise = Promise.resolve(source)
}
const getSocket = () => (socketPromise ??= Promise.resolve((source as () => SocketOrPromise)()))

super({ stream: () => createTransportStream(getSocket, options), signal })

this.events.on('disposed', async () => {
  if (socketPromise == null) {
    // Function source never invoked — no socket was ever created
    return
  }
  try {
    const sock = await socketPromise
    sock.destroy()
  } catch {
    // Socket failed to connect or is already gone; nothing to release
  }
})
```

Behaviour by source shape:

| Source | Before | After |
|--------|--------|-------|
| `Socket` / `Promise<Socket>` | `unref()` on dispose, socket stays open | `destroy()` on dispose, even if the transport was never used |
| Function | no hook at all, nothing released | `destroy()` on dispose of whichever socket the transport opened |
| Function, never invoked | nothing released | nothing to release — no socket was created, and none is conjured at dispose time |
| `string` path | connected eagerly in the constructor | connected lazily on first read/write, with `connectTimeoutMs` and `signal` applied |

The string case becoming lazy means a transport that is constructed but never used no longer opens a socket, and the params' `signal` now also aborts a pending connect. Connect errors still surface at first read/write, exactly as they do today (an eagerly-rejected promise only surfaces when awaited).

### Ordering

`Transport.dispose()` closes the writer — flushing and `end()`ing the socket — **before** emitting `disposed`, so `destroy()` is strictly last. `ERR_STREAM_DESTROYED` from `end()`ing an already-destroyed socket is unreachable by construction, not merely absorbed by the `socketError` listener added in the transport-lifecycle-hardening branch.

The writable sink's `socket.destroyed || socket.writableEnded` guard (which throws `Error('Socket is closed')`) becomes the normal post-dispose path for any in-flight write, rather than an edge case. That is intended: a write racing a dispose fails loudly instead of writing into a socket that is about to vanish.

## Testing

- **`connectSocket`** — rejects on timeout against a socket path with nothing accepting, and the pending socket ends up `destroyed`; the success path leaves `listenerCount('connect') === 0` and `listenerCount('error') === 0`; a pre-aborted signal rejects with `signal.reason` without connecting; a mid-flight abort rejects and destroys; `timeoutMs: 0` disables the timer.
- **Flush on close** — write a large payload, `writer.close()`, assert the server received it in full.
- **Dispose release**, one case per source shape — plain `Socket`, `Promise<Socket>`, function source, and a function-source transport never read from or written to (asserts no socket is created). After `dispose()`, the socket is `destroyed` and the server's connection count drops to zero.
- **End-to-end regression** — a server that awaits its connections draining actually closes once the client transport disposes. This is the tejika hang.

`tests/integration/transport-failure-no-unhandled.test.ts` passes a live `Socket` and is unaffected, except that its sockets are now destroyed on dispose, which is what it wants.

## Breaking changes (changeset)

- `transport.dispose()` now **closes** the socket rather than leaving it open. Anything relying on the socket surviving dispose breaks. Tejika's manual `.destroy()` becomes redundant; double-destroy is a no-op, so it is harmless to leave in place.
- `connectSocket` now times out after 10s by default. Callers needing an unbounded connect must pass `timeoutMs: 0`.
- `SocketTransport` with a `string` path connects lazily rather than in the constructor.
