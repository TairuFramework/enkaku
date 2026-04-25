# Hub-server receive double-bind hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** executing

**Goal:** Make `HubClientRegistry.setReceiveWriter` throw on double-bind so a misbehaving client opening a second `hub/receive` for the same DID surfaces a loud error instead of silently overwriting the first writer.

**Architecture:** Add a defensive throw in the registry method when the slot is already bound. In the `hub/receive` handler, pre-check `isOnline` before allocating the channel writer/reader (avoids leaking stream locks if the throw fires) and rely on the existing `signal.aborted` cleanup path to free the slot on transport drop. Single-writer-per-DID invariant unchanged; only its enforcement becomes loud.

**Tech Stack:** TypeScript, Vitest, `@enkaku/hub-server`, `@enkaku/client`, `@enkaku/transport` (`DirectTransports`).

**Spec:** `docs/agents/plans/next/2026-04-26-hub-server-receive-double-bind.md`

---

## File structure

| File | Role | Change |
|------|------|--------|
| `packages/hub-server/src/registry.ts` | Client registry | Modify `setReceiveWriter` to throw when slot already bound |
| `packages/hub-server/src/handlers.ts` | RPC handlers | Pre-check `isOnline` in `hub/receive` before allocating writer/reader; let throw propagate as channel rejection |
| `packages/hub-server/test/registry.test.ts` | Registry unit tests | Add three cases: throw on double-bind, recover after `clearReceiveWriter`, no-op for unregistered DID |
| `packages/hub-server/test/hub.test.ts` | Hub integration tests | Add three cases: concurrent double `hub/receive` rejects second / first survives, abort + immediate reconnect, abort + delayed reconnect |

Out of scope: pre-existing `test:types` errors at `test/hub.test.ts:305,307` (unrelated `TransportType` assignability — separate cleanup).

---

## Task 1: Registry throws on double-bind

**Files:**
- Modify: `packages/hub-server/src/registry.ts:42-47`
- Test: `packages/hub-server/test/registry.test.ts`

- [ ] **Step 1: Add failing tests for double-bind throw, recovery, unregistered no-op**

Append to `packages/hub-server/test/registry.test.ts` inside the existing `describe('HubClientRegistry', ...)` block (before the closing `})`):

```ts
  test('setReceiveWriter throws on double-bind for same DID', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.setReceiveWriter('did:key:alice', vi.fn())
    expect(() => registry.setReceiveWriter('did:key:alice', vi.fn())).toThrow(
      /receive writer already bound/,
    )
  })

  test('setReceiveWriter succeeds again after clearReceiveWriter', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    const first = vi.fn()
    const second = vi.fn()
    registry.setReceiveWriter('did:key:alice', first)
    registry.clearReceiveWriter('did:key:alice')
    expect(() => registry.setReceiveWriter('did:key:alice', second)).not.toThrow()
    expect(registry.isOnline('did:key:alice')).toBe(true)
  })

  test('setReceiveWriter is a no-op for unregistered DID', () => {
    const registry = new HubClientRegistry()
    expect(() => registry.setReceiveWriter('did:key:ghost', vi.fn())).not.toThrow()
    expect(registry.isOnline('did:key:ghost')).toBe(false)
  })
```

- [ ] **Step 2: Run the new tests, confirm the double-bind test fails**

Run: `pnpm --filter @enkaku/hub-server test:unit -- registry`

Expected: the two `not.toThrow` tests pass; the `throws on double-bind` test fails because the current implementation overwrites silently (no throw).

- [ ] **Step 3: Modify `setReceiveWriter` to throw on double-bind**

Replace `packages/hub-server/src/registry.ts:42-47`:

```ts
  setReceiveWriter(did: string, writer: (message: StoredMessage) => void): void {
    const entry = this.#clients.get(did)
    if (entry == null) return
    if (entry.sendMessage != null) {
      throw new Error(`receive writer already bound for DID ${did}`)
    }
    entry.sendMessage = writer
  }
```

- [ ] **Step 4: Run registry tests, confirm all pass**

Run: `pnpm --filter @enkaku/hub-server test:unit -- registry`

Expected: all tests in `registry.test.ts` pass, including the three new ones.

- [ ] **Step 5: Run type check for hub-server**

Run: `pnpm --filter @enkaku/hub-server test:types`

Expected: no new errors. Pre-existing errors in `test/hub.test.ts:305,307` remain (out of scope).

- [ ] **Step 6: Commit**

```bash
git add packages/hub-server/src/registry.ts packages/hub-server/test/registry.test.ts
git commit -m "feat(hub-server): throw on double-bind in setReceiveWriter

Surface protocol violations instead of silently overwriting an existing
receive writer for the same DID. Single-writer-per-DID invariant is
unchanged; only its enforcement becomes loud."
```

---

## Task 2: `hub/receive` handler propagates rejection cleanly

**Files:**
- Modify: `packages/hub-server/src/handlers.ts:67-150`
- Test: `packages/hub-server/test/hub.test.ts`

The handler currently allocates `writer` and `reader` (lines 73-74) **before** calling `setReceiveWriter` (line 77). With the throw added in Task 1, a double-bind throw at line 77 leaves the writer/reader locks held and skips the `signal.aborted` cleanup wired at line 138. Pre-check `isOnline` before allocating.

- [ ] **Step 1: Add failing integration test for concurrent double `hub/receive`**

Append to `packages/hub-server/test/hub.test.ts` inside `describe('hub handlers', ...)` before the closing `})` at line 283:

```ts
  test('hub/receive rejects second concurrent open for same DID; first stays alive', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    const bobIdentity = randomIdentity()
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bob = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    // First receive channel
    const channel1 = bob.createChannel('hub/receive', { param: {} })
    const reader1 = channel1.readable.getReader()
    await delay(50)

    // Second receive channel for same DID -- must reject
    const channel2 = bob.createChannel('hub/receive', { param: {} })
    await expect(channel2).rejects.toThrow(/receive writer already bound/)

    // First channel still works: Alice sends, channel1 receives
    const payload = btoa('still-alive')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader1.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel1.close()
    await expect(channel1).rejects.toEqual('Close')
    await delay(50)
    await bobTransports.dispose()
    await aliceTransports.dispose()
  })
```

- [ ] **Step 2: Run the new test, confirm it fails**

Run: `pnpm --filter @enkaku/hub-server test:unit -- hub.test`

Expected: the new test fails. Most likely failure: the second `hub/receive` throws inside the handler after `writer.getWriter()` and `reader.getReader()` lock the streams, leaving the channel in an inconsistent state, OR the first channel's writer is overwritten by the second before the throw (depending on exact ordering). Either way, the assertion that `channel1` still receives `still-alive` will not hold under the current handler code combined with Task 1's throw.

- [ ] **Step 3: Modify the `hub/receive` handler to pre-check `isOnline`**

Replace `packages/hub-server/src/handlers.ts:67-77` (from `'hub/receive': (async (ctx) => {` through the `registry.setReceiveWriter(clientDID, (message: StoredMessage) => {` line — leave the callback body and everything below untouched).

Old:

```ts
    'hub/receive': (async (ctx) => {
      const clientDID = getClientDID(ctx)
      const { after, groupIDs } = ctx.param ?? {}

      registry.register(clientDID)

      const writer = ctx.writable.getWriter()
      const reader = ctx.readable.getReader()

      // Set up message delivery callback with optional group filter
      registry.setReceiveWriter(clientDID, (message: StoredMessage) => {
```

New:

```ts
    'hub/receive': (async (ctx) => {
      const clientDID = getClientDID(ctx)
      const { after, groupIDs } = ctx.param ?? {}

      registry.register(clientDID)
      if (registry.isOnline(clientDID)) {
        throw new Error(`receive writer already bound for DID ${clientDID}`)
      }

      const writer = ctx.writable.getWriter()
      const reader = ctx.readable.getReader()

      // Set up message delivery callback with optional group filter
      registry.setReceiveWriter(clientDID, (message: StoredMessage) => {
```

The `registry.setReceiveWriter` call below still throws as defense-in-depth — both checks should agree, but the pre-check is what keeps the writer/reader unallocated on the rejection path.

- [ ] **Step 4: Run hub tests, confirm new test passes and existing tests still pass**

Run: `pnpm --filter @enkaku/hub-server test:unit -- hub.test`

Expected: all tests in `hub.test.ts` pass, including the new concurrent-double-receive case.

- [ ] **Step 5: Run full hub-server test suite (unit + types)**

Run: `pnpm --filter @enkaku/hub-server test`

Expected: unit tests pass. `test:types` shows only the pre-existing `test/hub.test.ts:305,307` errors documented as out of scope.

- [ ] **Step 6: Commit**

```bash
git add packages/hub-server/src/handlers.ts packages/hub-server/test/hub.test.ts
git commit -m "fix(hub-server): pre-check isOnline in hub/receive before allocating streams

Reject a second concurrent hub/receive for the same DID before locking
the channel writable/readable streams, so the first subscriber's
delivery is preserved and the rejection surfaces cleanly to the
offending client."
```

---

## Task 3: Reconnect race tolerance tests

**Files:**
- Test: `packages/hub-server/test/hub.test.ts`

These cases verify that the existing `signal.aborted` cleanup path (handlers.ts:138-148) frees the slot in time for a reconnect. They should pass without further code changes; they document the behavior so future regressions are caught.

- [ ] **Step 1: Add reconnect race tests**

Append to `packages/hub-server/test/hub.test.ts` inside `describe('hub handlers', ...)` (just after the test added in Task 2):

```ts
  test('hub/receive: close + immediate reopen on same DID succeeds', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    const bobIdentity = randomIdentity()
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bob = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    const channel1 = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    channel1.close()
    await expect(channel1).rejects.toEqual('Close')

    // Immediate reopen -- no extra delay
    const channel2 = bob.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()
    await delay(50)

    const payload = btoa('reconnect-ok')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader2.read()
    expect(msg.value?.payload).toBe(payload)

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await bobTransports.dispose()
    await aliceTransports.dispose()
  })

  test('hub/receive: close + delayed reopen on same DID succeeds', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    const bobIdentity = randomIdentity()
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bob = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    const channel1 = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    channel1.close()
    await expect(channel1).rejects.toEqual('Close')
    await delay(100)

    const channel2 = bob.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()
    await delay(50)

    const payload = btoa('delayed-ok')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader2.read()
    expect(msg.value?.payload).toBe(payload)

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await bobTransports.dispose()
    await aliceTransports.dispose()
  })
```

- [ ] **Step 2: Run hub tests, confirm both new tests pass**

Run: `pnpm --filter @enkaku/hub-server test:unit -- hub.test`

Expected: both new reconnect tests pass without further code changes. If the immediate-reopen test fails, the abort-cleanup path is not running before the new `hub/receive` invocation — investigate `signal.aborted` listener firing in `handlers.ts:138-148`.

- [ ] **Step 3: Run full repo build + test to catch downstream regressions**

Run: `pnpm run build && pnpm run test`

Expected: full build succeeds; test suite passes (modulo the documented pre-existing `test:types` errors in `test/hub.test.ts:305,307`).

- [ ] **Step 4: Commit**

```bash
git add packages/hub-server/test/hub.test.ts
git commit -m "test(hub-server): cover hub/receive reconnect race after abort cleanup

Document via tests that closing a hub/receive channel and reopening on
the same DID succeeds both immediately and after a delay, exercising
the signal.aborted cleanup path in handlers.ts."
```

---

## Verification checklist

Before declaring the plan complete:

- [ ] `pnpm --filter @enkaku/hub-server test:unit` — all green
- [ ] `pnpm --filter @enkaku/hub-server test:types` — no new errors (pre-existing 305/307 ok)
- [ ] `pnpm run build` — full repo build clean
- [ ] `pnpm run lint` — no new lint errors
- [ ] Three commits on the branch, one per task
- [ ] Spec file `docs/agents/plans/next/2026-04-26-hub-server-receive-double-bind.md` updated or removed during the completing stage (out of scope here)
