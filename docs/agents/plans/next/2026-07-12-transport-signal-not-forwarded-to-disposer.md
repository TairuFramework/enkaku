# `Transport` never forwards `params.signal` to `Disposer`, so an external abort disposes nothing

**Origin:** found by the final whole-branch review of `socket-connect-and-dispose-lifecycle` (2026-07-12). Pre-existing on `main` — not a regression from that branch, but squarely in the same lifecycle territory, and the branch's work makes the gap sharper.

`packages/transport/src/index.ts:64-81` — the constructor takes `params.signal` and calls `super({ dispose })`, but **never passes `signal` through to `Disposer`**:

```ts
constructor(params: TransportParams<R, W>) {
  super({
    dispose: async (reason?: unknown) => { /* ... */ },
  })   // <- params.signal is not forwarded
  this.#events = new EventEmitter<TransportEvents>()
  this.#params = params
}
```

So for every transport in the repo:

```ts
const controller = new AbortController()
const transport = new SocketTransport({ socket, signal: controller.signal })
controller.abort()
// transport.signal.aborted === false
// 'disposed' never fires
// the socket is never destroyed -- it leaks
```

Confirmed empirically by the reviewer against the built lib.

`SocketTransportParams.signal` is documented as the transport's abort signal, and after the connect-and-dispose-lifecycle branch it *does* reach `connectSocket` (cancelling a **pending connect**) and the drain wait. But it does not dispose the transport, so the socket-release hook — which that branch made the sole owner of the socket's lifetime — never runs. A caller who wires up a signal expecting "abort tears this down" gets a cancelled connect and a leaked socket.

**Sketch:** forward the signal — `super({ dispose, signal: params.signal })` — and check `@sozai/async`'s `Disposer` for how it wires an external signal to `dispose()`. Then assert the property directly: abort the controller, expect `disposed` to fire and the socket to end up `destroyed`.

**Blast radius:** `Transport` is the base class for every transport (http-fetch, http-serve, message, node-streams, socket), so this changes what `signal` means for all of them — from "cancels the connect" to "disposes the transport". That is what the type already promises, but it is a real behavior change and wants its own changeset. Check each subclass for a signal path that would now fire twice.
