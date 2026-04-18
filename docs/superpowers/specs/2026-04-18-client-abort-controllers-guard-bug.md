# `Client.#abortControllers` guard skips active request aborts on dispose

**Date:** 2026-04-18
**Reporter:** kubun `HubRelayManager` Phase 7b T3 (reconnect test)
**Affected package:** `@enkaku/client`
**File:** `packages/client/src/client.ts` (around the `#abortControllers` method)
**Severity:** high — active channel handlers hang forever when the client disposes, breaking any reconnect/teardown path that relies on `client.dispose()` propagating to open channels.
**Not covered by:** `fix/hub-teardown` branch (as of db1c8d8). That branch adds `safeWrite` / `isBenignTeardownError` / lifecycle events, but the guard in `#abortControllers` is unchanged.

## Summary

`Client.#abortControllers` checks `if (!this.signal.aborted)` before aborting per-request controllers. `Client.dispose()` goes through the base `Disposer`, which calls `abort()` FIRST — setting `this.signal.aborted = true` — and THEN runs the `dispose` callback that invokes `#abortControllers`. The guard therefore evaluates to `false` and the loop body never executes. Outstanding request/channel controllers are never aborted.

## The code

```ts
// client.ts, constructor
constructor(params: ClientParams<Protocol>) {
  super({
    dispose: async (reason?: unknown) => {
      this.#abortControllers(reason)
      await this.#transport.dispose(reason)
      // ...
    },
  })
  // ...
}

// client.ts, #abortControllers
#abortControllers(reason?: unknown): void {
  if (!this.signal.aborted) {       // <-- wrong guard
    for (const controller of Object.values(this.#controllers)) {
      controller.abort(reason)
    }
  }
  this.#controllers = {}
}
```

### Execution order during `dispose()`

From `packages/async/src/disposer.ts`:

```ts
this.signal.addEventListener('abort', () => {
  if (!disposing) {
    disposing = true
    if (params.dispose == null) {
      this.#deferred.resolve()
    } else {
      params.dispose(this.signal.reason).then(() => this.#deferred.resolve())
    }
  }
}, { once: true })
```

So `dispose(reason)` → `this.abort(reason)` → abort event fires → `params.dispose` runs → calls `#abortControllers` → guard `!this.signal.aborted` is already `false` → skip.

## Observed symptom

Open a channel (e.g. `hub/receive`) then dispose the client while the channel's reader is awaiting `reader.read()`. The reader hangs forever — no abort delivered to its controller, no stream close. In long-running code a reconnect loop never fires because it's waiting for the reader to return.

## Reproduction (synthetic)

```ts
import { Client } from '@enkaku/client'
import { DirectTransports } from '@enkaku/transport-direct'
import { randomIdentity } from '@enkaku/identity'
import { createHub, createMemoryStore } from '@enkaku/hub-server'
import type { HubProtocol } from '@enkaku/hub-protocol'

const store = createMemoryStore()
const hubTransports = new DirectTransports()
const hub = createHub({ transport: hubTransports.server, store, accessControl: false })

const clientTransports = new DirectTransports()
hub.server.handle(clientTransports.server)
const client = new Client<HubProtocol>({ transport: clientTransports.client, identity: randomIdentity() })

const channel = client.createChannel('hub/receive', { param: { groupIDs: ['g1'] } })
const reader = channel.readable.getReader()

const readPromise = reader.read()

await client.dispose()

// Observed: readPromise hangs. No resolution, no rejection.
await Promise.race([
  readPromise,
  new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 500)),
]) // throws 'timeout'
```

## Suggested fix

### Option A — invert the guard (simplest)

`#abortControllers` should run the loop BECAUSE the signal is aborted (that's the point of dispose). Remove the `if` guard:

```ts
#abortControllers(reason?: unknown): void {
  for (const controller of Object.values(this.#controllers)) {
    controller.abort(reason)
  }
  this.#controllers = {}
}
```

The guard's intent may have been "don't re-abort during an already-aborting dispose"; a simple `#aborting` boolean would handle re-entrancy if needed without fighting the dispose path.

### Option B — abort controllers BEFORE the Disposer's abort fires

Dispatch per-request aborts explicitly before the Disposer's abort:

```ts
constructor(params: ClientParams<Protocol>) {
  const abortAll = (reason?: unknown) => {
    for (const controller of Object.values(this.#controllers)) {
      controller.abort(reason)
    }
    this.#controllers = {}
  }
  super({
    dispose: async (reason?: unknown) => {
      abortAll(reason)
      await this.#transport.dispose(reason)
      // ...
    },
  })
  // ...
}
```

Option A is one-line and preserves intent.

## Impact

- Breaks graceful client shutdown whenever a channel/stream is in-flight. The `readable` stream never closes; any `for await` loop on a channel hangs until the process exits.
- Breaks reconnect patterns where a consumer monitors `client.disposed` to recreate a client. `disposed` resolves, but outstanding `reader.read()` calls remain pending, so background work (ack flushing, broadcast retries) stays blocked on those reads.
- Consumers work around by racing `reader.read()` against `client.disposed` externally — which is the kubun workaround in `HubRelayManager` Phase 7b (see `kubun/packages/plugin-p2p/src/hub/space-channel.ts` `#runReceiveLoop`).

## Relation to `fix/hub-teardown`

`fix/hub-teardown` (branch commits through db1c8d8, 2026-04-18) addresses the `safeWrite` / `isBenignTeardownError` side of the teardown story — that is, the **separate bug** where floating `void this.#write(...)` rejections surface at teardown. That work does NOT touch `#abortControllers`, so the guard issue remains open even on that branch.

After `fix/hub-teardown` merges, kubun's `HubRelayManager` will still need its `reader.read()` vs `client.disposed` race to avoid hung channel readers — until this guard is also fixed.

## Validation

After the fix:

```ts
await client.dispose()
const result = await readPromise          // rejects with abort reason
// OR
const { done } = await readPromise        // done === true with stream closed
```

Either resolution is fine; current behavior of "hang forever" is not.
