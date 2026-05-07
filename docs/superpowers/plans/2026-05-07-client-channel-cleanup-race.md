# Client Channel/Stream Cleanup Race Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** executing

**Goal:** Make `createController`'s `onDone` callback fire at most once so channel/stream `writer.close()` cleanup never runs twice and never throws `Invalid state: WritableStream is closed`.

**Architecture:** Single-file change to `packages/client/src/client.ts` — gate the existing `onDone?.()` invocations behind a one-shot flag inside `createController`. Three regression tests in `packages/client/test/` exercising the channel + stream `ok→abort` and `error→abort` orderings against a `DirectTransports`-driven `Client` (matching the existing test style — no `@enkaku/server` involvement).

**Tech Stack:** TypeScript, Vitest, `@enkaku/transport` (`DirectTransports`), `@enkaku/token` (`createUnsignedToken`), WHATWG `WritableStream`.

**Spec:** `docs/superpowers/specs/2026-05-07-client-channel-cleanup-race.md`

---

## File Structure

- **Modify:** `packages/client/src/client.ts:145-165` — `createController` gains a `done` flag.
- **Create:** `packages/client/test/controller-on-done-once.test.ts` — three regression tests covering channel-result-then-dispose, stream-result-then-dispose, and `error→abort` ordering. Kept in its own file (mirrors `dispose-aborts-controllers.test.ts` style) to keep the targeted regression isolated and easy to delete if the contract ever changes.

No other files change. The fix is intentionally minimal per the spec's "Prefer the `createController`-level fix" recommendation.

---

## Task 1: Reproduction test — channel result then close throws

**Files:**
- Create: `packages/client/test/controller-on-done-once.test.ts`

> **Trigger correction (post-investigation):** The original spec proposed `client.dispose()` as the second trigger, but the message handler at `client.ts:420-429` deletes the controller from `#controllers` synchronously right after `controller.ok()`, so `dispose()`'s `#abortControllers` loop no longer reaches it. The reliable in-process trigger is `channel.close()` (and the stream equivalent), which calls `request.abort('Close')` → `controller.abort()` → fires the still-registered per-rid abort listener at `client.ts:498-513` → `controller.aborted(signal)` → `onDone()` → second `writer.close()`. The fix in Task 2 addresses every path that converges on `controller.aborted`, so Task 1's coverage of the `close()` path is sufficient.

- [ ] **Step 1: Write the failing test**

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken as unsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { Client } from '../src/client.js'

const protocol = {
  'test/channel': {
    type: 'channel',
    send: { type: 'object' },
    receive: { type: 'object' },
    result: { type: 'string' },
  },
  'test/stream': {
    type: 'stream',
    receive: { type: 'object' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('createController onDone fires at most once', () => {
  test('channel: result then close() does not throw a second writer.close()', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const transports = new DirectTransports<
        AnyServerMessageOf<Protocol>,
        AnyClientMessageOf<Protocol>
      >()
      const client = new Client<Protocol>({ transport: transports.client })

      const channel = client.createChannel('test/channel')
      const sentRead = await transports.server.read()
      const rid = sentRead.value?.payload.rid as string

      // Server replies with a final result — fires controller.ok → onDone (1st writer.close).
      await transports.server.write(unsignedToken({ typ: 'result', rid, val: 'OK' }))
      await expect(channel).resolves.toBe('OK')

      // close() on an already-resolved channel fires controller.abort() → still-registered
      // per-rid abort listener → controller.aborted() → onDone (2nd writer.close) → throws.
      channel.close()
      // Allow any unhandled rejection to surface.
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(unhandled).not.toHaveBeenCalled()

      await client.dispose()
      await transports.server.dispose()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails on `main`**

Run: `pnpm --filter @enkaku/client test:unit -- controller-on-done-once`
Expected: FAIL — the assertion `expect(unhandled).not.toHaveBeenCalled()` fires because `writer.close()` runs a second time and rejects with `TypeError: Invalid state: WritableStream is closed`. (If Vitest reports the rejection as a test-level error rather than a spy hit, that is also a failure — either signal proves the regression.)

- [ ] **Step 3: Commit the failing test**

```bash
git add packages/client/test/controller-on-done-once.test.ts
git commit -m "test(client): reproduce channel onDone double-close race"
```

---

## Task 2: Fix — gate `onDone` behind a one-shot flag in `createController`

**Files:**
- Modify: `packages/client/src/client.ts:145-165`

- [ ] **Step 1: Apply the fix**

Replace the existing `createController` function (currently at `packages/client/src/client.ts:145-165`):

```ts
function createController<T>(
  params: CreateControllerParams,
  onDone?: () => void,
): RequestController<T> {
  const deferred = defer<T>()
  let done = false
  const finish = () => {
    if (done) return
    done = true
    onDone?.()
  }
  return Object.assign(new AbortController(), params, {
    result: deferred.promise,
    ok: (value: T) => {
      deferred.resolve(value)
      finish()
    },
    error: (error: RequestError) => {
      deferred.reject(error)
      finish()
    },
    aborted: (signal: AbortSignal) => {
      deferred.reject(signal.reason)
      finish()
    },
  })
}
```

The semantics: `deferred.{resolve,reject}` are already idempotent inside `defer`, so the `done` flag matches their contract — once any terminal path (`ok` / `error` / `aborted`) has fired, later transitions still run their `deferred.*` line (harmless no-op) but no longer re-invoke `onDone`. The surrounding abort handler at `client.ts:498-513` continues to log and `delete this.#controllers[rid]` because that work lives outside `controller.aborted`.

- [ ] **Step 2: Run the Task 1 test and confirm it passes**

Run: `pnpm --filter @enkaku/client test:unit -- controller-on-done-once`
Expected: PASS — no unhandled rejection.

- [ ] **Step 3: Run the full client unit suite to confirm no regressions**

Run: `pnpm --filter @enkaku/client test:unit`
Expected: all client tests PASS, including `dispose-aborts-controllers.test.ts` and `lib.test.ts` (channel/stream happy paths still resolve `result`, abort tests still reject as before — the `aborted` callback's `deferred.reject(signal.reason)` is unaffected by the flag).

- [ ] **Step 4: Commit the fix**

```bash
git add packages/client/src/client.ts
git commit -m "fix(client): make createController onDone fire at most once

Channel and stream procedures pass writer.close as onDone. The previous
implementation fired onDone from all three terminal paths (ok / error /
aborted), so a result-then-dispose sequence ran writer.close twice and
threw 'Invalid state: WritableStream is closed' as an unhandled
rejection. Gate onDone behind a one-shot flag so subsequent terminal
transitions are silent."
```

---

## Task 3: Additional regression tests — stream and `error→abort` ordering

**Files:**
- Modify: `packages/client/test/controller-on-done-once.test.ts`

- [ ] **Step 1: Append the stream-result-then-close test**

Inside the existing `describe('createController onDone fires at most once', ...)` block, add. The trigger is the same as Task 1 — `result` then a manual abort on the resolved request — adapted for the stream API. (`createStream` returns a `StreamCall` whose `abort` method calls `controller.abort()`; if a `close()` helper exists analogous to channel's, prefer it. Otherwise call `stream.abort('Close')` directly.) Pick whichever method the existing `StreamCall` exposes; do not invent one.

```ts
test('stream: result then abort does not throw a second writer.close()', async () => {
  const unhandled = vi.fn()
  process.on('unhandledRejection', unhandled)
  try {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    const stream = client.createStream('test/stream')
    const sentRead = await transports.server.read()
    const rid = sentRead.value?.payload.rid as string

    await transports.server.write(unsignedToken({ typ: 'result', rid, val: 'OK' }))
    await expect(stream).resolves.toBe('OK')

    // Fire the per-rid abort after the stream already resolved.
    stream.abort('Close')
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(unhandled).not.toHaveBeenCalled()

    await client.dispose()
    await transports.server.dispose()
  } finally {
    process.off('unhandledRejection', unhandled)
  }
})
```

- [ ] **Step 2: Append the channel-error-then-close test**

Same `describe` block, add:

```ts
test('channel: error reply then close() does not throw a second writer.close()', async () => {
  const unhandled = vi.fn()
  process.on('unhandledRejection', unhandled)
  try {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    const channel = client.createChannel('test/channel')
    // Channel rejects on error reply; swallow so the rejection isn't unhandled.
    void channel.catch(() => {})

    const sentRead = await transports.server.read()
    const rid = sentRead.value?.payload.rid as string

    // Server replies with an error — fires controller.error → onDone (1st writer.close).
    await transports.server.write(
      unsignedToken({ typ: 'error', rid, code: 500, msg: 'boom' }),
    )
    await expect(channel).rejects.toBeDefined()

    // close() fires the per-rid abort → controller.aborted → onDone (would be 2nd writer.close).
    channel.close()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(unhandled).not.toHaveBeenCalled()

    await client.dispose()
    await transports.server.dispose()
  } finally {
    process.off('unhandledRejection', unhandled)
  }
})
```

- [ ] **Step 3: Run the new tests and confirm all three pass**

Run: `pnpm --filter @enkaku/client test:unit -- controller-on-done-once`
Expected: 3 PASS, 0 FAIL, 0 unhandled rejections.

If the `error` payload shape (`{ typ: 'error', rid, code, msg }`) does not match the protocol, grep for the canonical shape with `grep -n "typ: 'error'" packages/client/test/lib.test.ts packages/protocol/src/*.ts` and adjust the literal — the test's only purpose at that boundary is to land on `controller.error`, so any well-formed error payload that reaches the client read loop is acceptable.

- [ ] **Step 4: Commit the additional tests**

```bash
git add packages/client/test/controller-on-done-once.test.ts
git commit -m "test(client): cover stream and error onDone double-close paths"
```

---

## Task 4: Whole-repo verification

- [ ] **Step 1: Run lint**

Run: `pnpm run lint`
Expected: clean.

- [ ] **Step 2: Run the full test matrix**

Run: `pnpm run test`
Expected: all packages green, including type checks.

- [ ] **Step 3: Cross-check against the kubun reproduction (manual, optional)**

Per spec: with the fix linked into `kubun/feat/hub-management` (e.g. via `pnpm` workspace overrides or a published prerelease), `pnpm test` in kubun should drop from `Errors 1 error` to `Errors 0`. This is documented for the kubun-side follow-up; do **not** block this plan on it. If a local link is trivial, run it; otherwise leave a note in the PR description so the kubun Q3.3 plan entry can be updated once a release ships.

- [ ] **Step 4: No changeset / version bump in this commit**

This repo does not use changesets (verified: no `.changeset/` directory). Version bumps land in their own dedicated commit (see `git log` — `d42488f Bump versions`, `6201f7e Bump packages version`). Do not bump `packages/client/package.json` here.

---

## Self-Review Notes

- **Spec coverage:** Spec §"Proposed fix" → Task 2. Spec §"Tests to add" items 1, 2, 3 → Tasks 1 + 3 (channel-result-dispose, stream-result-dispose, channel-error-dispose covers the same `terminal-then-abort` race as item 3's "same-tick" framing). Item 4 ("existing happy-path tests still green") → Task 2 step 3 + Task 4 step 2. Spec §"Alternative (narrower)" rejected per spec's own recommendation; not implemented.
- **Placeholder scan:** None. Every step has either exact code, an exact command, or an exact expected outcome.
- **Type consistency:** `done` flag scoped inside `createController`; no exported surface change. `RequestController<T>` signature unchanged. Test file uses the same `Protocol` type across all three tests.
- **Out of scope (intentional):** The kubun Q3.3 plan-log update; any refactor of `#handleSignal` (the abort handler still needs to run for logging and `#controllers` cleanup); idempotency of `writer.close()` itself (we fix the caller, not the WHATWG contract).
