# Bug: Client.createController Calls `onDone` Twice — Channel/Stream Writer Close Throws

**Date:** 2026-05-07
**Severity:** medium — non-fatal at the test/runtime level (the throw escapes as an unhandled rejection rather than rejecting any user-visible promise), but pollutes Vitest runs and may surface as `unhandledRejection` warnings in production.
**Surfaced by:** Kubun `plugin-p2p` Q3.3 (hub server DID mismatch hard-fail) — see
`kubun/docs/superpowers/plans/2026-05-05-hub-first-class-entity-plan.md` Q3.3 entry.

## Symptom

Vitest emits a single unhandled exception when a `Client<Protocol>` running a
**channel** (or **stream**) procedure both receives a non-final reply (or any
reply that triggers the `ok`/`error` path) AND is later aborted.

```
TypeError: Invalid state: WritableStream is closed
 ❯ writableStreamClose node:internal/webstreams/writablestream:724:7
 ❯ writableStreamDefaultWriterClose node:internal/webstreams/writablestream:1101:10
 ❯ WritableStreamDefaultWriter.close node:internal/webstreams/writablestream:426:12
 ❯ node_modules/@enkaku/client/lib/client.js:540:23      // (matches src line 729: `writer.close()`)
 ❯ AbortController.aborted node_modules/@enkaku/client/lib/client.js:25:21
 ❯ AbortSignal.signal.addEventListener.once node_modules/@enkaku/client/lib/client.js:320:24
```

Reads "channel-procedure controller's `onDone` ran twice — the second
`writer.close()` saw the writable already closed."

## Root cause

`createController(params, onDone)` invokes `onDone` from **all three** terminal
paths (`packages/client/src/client.ts:145-165`):

```ts
function createController<T>(
  params: CreateControllerParams,
  onDone?: () => void,
): RequestController<T> {
  const deferred = defer<T>()
  return Object.assign(new AbortController(), params, {
    result: deferred.promise,
    ok: (value: T) => {
      deferred.resolve(value)
      onDone?.()       // <-- first call
    },
    error: (error: RequestError) => {
      deferred.reject(error)
      onDone?.()       // <-- first call
    },
    aborted: (signal: AbortSignal) => {
      deferred.reject(signal.reason)
      onDone?.()       // <-- second call after ok/error
    },
  })
}
```

For request-type RPCs `onDone` is `undefined`, so the issue is invisible. For
**channel** and **stream**, the caller passes `() => writer.close()` (lines
647-648 and 728-729):

```ts
createController<T['Result']>(
  { type: 'channel', procedure, header: config.header },
  () => writer.close(),
)
```

`writer.close()` is **not idempotent** under the WHATWG WritableStream spec —
the second call rejects with `TypeError: Invalid state: WritableStream is closed`.

The race is hit whenever the channel/stream finishes via `ok`/`error` AND then
the Client's per-rid abort signal also fires for any reason — for example
because the surrounding `Client` is being disposed, or because the transport
read loop fails and triggers `this.abort(error)` (`client.ts:367-369`). The
abort handler at `client.ts:498-512` calls `controller.aborted(signal)`,
re-running `onDone`.

## Reproduction (Kubun)

The cleanest live reproduction is in the kubun repo at the
`feat/hub-management` branch. Steps:

```bash
git -C /Users/paul/dev/yulsi/kubun checkout feat/hub-management
cd /Users/paul/dev/yulsi/kubun
pnpm install
pnpm test
```

The full suite finishes with `Tests 1548 passed (1548)` AND `Errors 1 error`.
The unhandled error is the stack quoted above. Vitest attributes it to
`packages/plugin-p2p/test/forwarding-integration.test.ts` because that test
file happens to be running when the deferred rejection fires; the actual
trigger is **somewhere else** in the parallel plugin-p2p suite that runs
sync-channel RPCs (those use `Client.channel` / `Client.stream`) and disposes
clients.

To bisect the trigger:

```bash
# Q3.2 commit (pre-Q3.3) — clean run, 0 errors
git checkout 8a2cd23e
pnpm test    # 147 files, 1541 tests, 0 errors

# Q3.3 commit — 1 unhandled error reliably
git checkout 4ed09801
pnpm test    # 148 files, 1548 tests, 1 error
```

The Q3.3 source change in kubun does not touch any stream/channel code; it
only adds a transport-wrapper (`DIDObservingTransport`) that throws from
`read()` on hub server DID mismatch. That throw causes the Enkaku Client's
read-loop to call `this.abort(error)` (`client.ts:369`), which is what kicks
off the per-rid abort listeners — including any that have already had `ok`
fire on a still-running channel.

So Q3.3 doesn't *introduce* the race — it shifts timing so it lands
deterministically. The race itself is independent of the wrapper.

## Minimal repro outside kubun (proposed)

```ts
import { Client } from '@enkaku/client'
import { DirectTransports } from '@enkaku/transport'
import { Server } from '@enkaku/server'

// Channel that emits a result then waits.
const protocol = {
  'p/c': { type: 'channel', send: { type: 'object' }, receive: { type: 'object' }, result: { type: 'object' } },
} as const

const transports = new DirectTransports()
const server = new Server({ accessRules: false, handlers: { 'p/c': async ({ end }) => end({ ok: true }) }, transports: [transports.server] })
const client = new Client({ transport: transports.client })

const stream = await client.channel('p/c', {})
await stream.result    // server `end` → controller.ok → onDone → writer.close (1st)
await client.dispose() // abort fires → controller.aborted → onDone → writer.close (2nd) → THROW
```

(Untested — should be turned into a proper test in
`packages/client/test/`.)

## Proposed fix

Make `createController`'s `onDone` invocation **at-most-once**:

```diff
 function createController<T>(
   params: CreateControllerParams,
   onDone?: () => void,
 ): RequestController<T> {
   const deferred = defer<T>()
+  let done = false
+  const finish = () => {
+    if (done) return
+    done = true
+    onDone?.()
+  }
   return Object.assign(new AbortController(), params, {
     result: deferred.promise,
     ok: (value: T) => {
       deferred.resolve(value)
-      onDone?.()
+      finish()
     },
     error: (error: RequestError) => {
       deferred.reject(error)
-      onDone?.()
+      finish()
     },
     aborted: (signal: AbortSignal) => {
       deferred.reject(signal.reason)
-      onDone?.()
+      finish()
     },
   })
 }
```

`deferred.{resolve,reject}` are already idempotent at the `defer` level, so
the `done` flag matches their semantics — once any terminal path has fired,
later transitions are silent. The `aborted` path still runs (it logs and
deletes the per-rid controller in the surrounding event handler at lines
500-510), it just doesn't re-close an already-closed pipe.

### Alternative (narrower)

Make the channel/stream-specific cleanup idempotent at the call site:

```ts
const closeOnce = (() => {
  let closed = false
  return () => {
    if (closed) return
    closed = true
    void writer.close().catch(() => {})
  }
})()
createController({ type: 'channel', procedure, header: config.header }, closeOnce)
```

Less invasive but solves only this one symptom — `createController`'s
double-call would still bite any future `onDone` consumer.

Prefer the `createController`-level fix.

## Tests to add

`packages/client/test/`:

1. Channel completes via `result`, then client disposed → no unhandled error,
   no throw.
2. Stream completes via `end`, then client disposed → no unhandled error.
3. Channel where `ok` fires AND the per-rid signal aborts in the same tick →
   no double `writer.close()` (assert via spy: `writer.close` called exactly
   once).
4. Existing happy-path tests still green.

## Cross-repo notes

- Kubun's `feat/hub-management` branch documents this in its plan log
  (Q3.3 decision-log entry, "Flag (upstream)").
- Until fixed in Enkaku, kubun's `pnpm test` exits non-zero with `Errors  1
  error` on every full run. Functionally everything passes (1548/1548
  assertions); only the unhandled rejection trips the exit code.
- Once the fix lands and Kubun bumps its `@enkaku/client` dep, the Q3.3
  log entry should be updated to note the upstream resolution.
