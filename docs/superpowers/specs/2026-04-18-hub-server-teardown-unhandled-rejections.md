# Hub server teardown emits unhandled rejections

**Date:** 2026-04-18
**Reporter:** kubun integration tests (HubRelayManager Phase 7a)
**Affected packages:** `@enkaku/hub-server`, `@enkaku/server`, `@enkaku/transport-direct`
**Severity:** medium — non-functional (no data loss), but causes vitest `EXIT=1` with `Errors N` for any consumer that opens hub channels and disposes cleanly.

## Symptom

After a clean test that exercises `hub/receive` channels and disposes the hub + clients in any order, vitest reports unhandled rejections:

```
Errors 3
  - AbortError
  - AbortError
  - TypeError: Invalid state: WritableStream is closed
```

All assertions in the test pass. Process exits with code 1 because vitest treats unhandled rejections as errors.

## Reproduction

Minimal repro using `@enkaku/hub-server` + `@enkaku/transport-direct` only (no kubun deps):

```ts
import { describe, test } from 'vitest'
import { createHub, createMemoryStore } from '@enkaku/hub-server'
import { Client } from '@enkaku/client'
import { DirectTransports } from '@enkaku/transport-direct'
import { randomIdentity } from '@enkaku/identity'
import type { HubProtocol } from '@enkaku/hub-protocol'

test('hub channel teardown produces no unhandled rejections', async () => {
  const store = createMemoryStore()
  const hubTransports = new DirectTransports()
  const hub = createHub({ transport: hubTransports.server, store, accessControl: false })

  const clientTransports = new DirectTransports()
  hub.server.handle(clientTransports.server)
  const client = new Client<HubProtocol>({ transport: clientTransports.client, identity: randomIdentity() })

  // Open a hub/receive channel, then close cleanly
  const channel = client.createChannel('hub/receive', { param: { groupIDs: ['g1'] } })
  channel.close()
  await channel.catch(() => {}) // swallow expected abort

  await client.dispose()
  await hub.server.dispose?.()
})
```

Observed: 1–3 unhandled rejections after `client.dispose()`. Either `AbortError` or `TypeError: Invalid state: WritableStream is closed`.

## Root cause (hypothesis)

`channel.close()` aborts the client side via the request's `AbortController`. The server-side handler is still mid-write (or has a pending write) to its `WritableStream` when:

1. Abort propagates over the transport → server's writable closes.
2. Server attempts to send the next chunk → `WritableStream is closed`.
3. The promise from that write is unhandled.

Symmetric scenario when `client.dispose()` runs while the server still holds a reference to the client transport — the next server-initiated write throws `AbortError` from a transport already aborted.

## Suggested fix

Two complementary changes:

### 1. Server: drain pending writes before disposal

In `@enkaku/server` (or wherever `Server.handle` returns the per-handler context), wrap each outbound write in a try/catch that filters known-benign teardown errors (`AbortError`, `TypeError: Invalid state: WritableStream is closed`) and logs at debug level instead of letting the rejection escape.

```ts
async function safeWrite(writer: WritableStreamDefaultWriter<unknown>, value: unknown) {
  try {
    await writer.write(value)
  } catch (error) {
    if (isBenignTeardownError(error)) {
      // peer closed; safe to drop
      return
    }
    throw error
  }
}
```

`isBenignTeardownError` checks for `error?.name === 'AbortError'` or `/WritableStream is closed/.test(error?.message)`.

### 2. Channel: explicit signal of clean abort

`ChannelCall.close()` currently calls `request.abort('Close')`. Server side sees this as a generic abort indistinguishable from a transport failure. Consider sending a final marker frame on close (e.g. `{ done: true }`) so the server knows to stop writing without treating it as an error path.

If the protocol can't carry an extra frame: a server-side abort listener that flags the per-channel state as `closed` (instead of `errored`) would let downstream writes be skipped silently.

## Impact

- **Functional:** none. All messages already received are processed; close is otherwise clean.
- **Test ergonomics:** vitest exits 1 on every test that opens a hub channel + disposes. Workarounds (`dangerouslyIgnoreUnhandledErrors: true`) mask real bugs elsewhere. Currently consumers must accept the noise and the non-zero exit.
- **Production:** unhandled rejection handlers in long-running processes will see spurious `AbortError`/`WritableStream` errors at peer disconnect.

## Workaround (consumer-side, fragile)

`process.on('unhandledRejection', filter)` to swallow the specific error patterns. Not recommended — masks real bugs and doesn't help vitest exit codes.

## Cross-reference

Surfaced during kubun's `HubRelayManager` integration test (Phase 7a), 2026-04-18. Test passes 1206/1206 but exits 1. Pre-existing in baseline (10 unrelated kubun failures present at the time, also exiting 1 with `Errors 4`).

Files touched by repro investigation:
- `kubun/packages/plugin-p2p/test/relay-manager-integration.test.ts` — exercises real hub teardown
- `kubun/packages/plugin-p2p/src/hub/space-channel.ts` — already attempted close-order tweak, did not eliminate

## Open questions

- Do other channel-type procedures (non-hub) exhibit the same pattern? Likely yes — issue is in `@enkaku/server`, not hub-specific. Worth a synthetic test with a minimal protocol.
- Should `Server.dispose()` await all in-flight handler tasks before resolving? Currently unclear from the API.
