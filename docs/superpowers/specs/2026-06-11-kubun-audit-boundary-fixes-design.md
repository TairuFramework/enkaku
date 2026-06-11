# Kubun-audit enkaku boundary fixes — design

**Date:** 2026-06-11
**Branch:** `chore/fable-audit` (or a dedicated `fix/kubun-audit-boundary` branch)
**Origin:** `docs/agents/plans/next/2026-06-11-kubun-audit-boundary-items.md` — the enkaku-side half of four kubun full-repo-audit findings. Each kubun plan owns the user-visible outcome and depends on the change here.

## Goal

Close four enkaku-side boundary gaps surfaced by the kubun audit, plus four cheap advisories, in one spec/branch. Scope is fixes and small interface changes only; no new protocol requests.

## Scope

In scope: Items 1, 2, 3, and advisories 4.1, 4.3, 4.4, 4.5.

Out of scope (deferred, own specs/backlog):
- **2c** durable group-member expiry (ghost rosters) — tie to retention scheduler.
- **4.2** mid-session redeliver (nack / redeliver-now) — new protocol request.

## Sequencing

1. **Item 1** — independent, smallest. Do first.
2. **Item 3** — small code, breaking. Rides the audit breaking-change window.
3. **Item 2** — largest; store-interface change + handler rewrite.
4. **Item 4** advisories — fold into whichever files are already open.

---

## Item 1 — `consume()` closes its source iterator (HIGH)

**File:** `packages/generator/src/index.ts` (`consume`, lines 16-48).

### Problem

`consume()` sets an `aborted` flag and rejects on abort, and resolves on normal `done`, but never calls `iterator.return?.()`. The source generator's `finally` block (e.g. `fromEmitter`'s listener `unsubscribe`, `fromStream`'s `releaseLock`) never runs. Any resource-backed `AsyncGenerator` consumed via `consume()` leaks on every consume→stop cycle.

### Fix

Call `iterator.return?.()` — awaited, errors swallowed — on both termination paths:
- inside the `signal` abort listener, and
- when the pull loop stops normally (`done`, or `aborted` observed after `iterator.next()`).

Guard against double-invocation (abort racing loop-end) with a single `closed` flag; `return()` runs at most once. The existing `ended` resolve/reject semantics are unchanged — cleanup is additive and must not alter the resolved/rejected value.

### Sketch

```ts
export function consume<T, TReturn = unknown>(
  iterator: AsyncIterator<T, TReturn>,
  callback: (value: T) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<TReturn> {
  let aborted = false
  let closed = false
  const ended = defer<TReturn>()

  const close = () => {
    if (closed) return
    closed = true
    // swallow: cleanup failures must not mask the resolve/reject reason
    Promise.resolve(iterator.return?.()).catch(() => {})
  }

  signal?.addEventListener('abort', () => {
    aborted = true
    close()
    ended.reject(signal.reason)
  })

  async function pull() {
    try {
      const { done, value } = await iterator.next()
      if (aborted || done) {
        if (done) ended.resolve(value)
        close()
        return
      }
      await callback(value)
      void pull()
    } catch (reason) {
      close()
      ended.reject(reason)
    }
  }
  void pull()

  return ended.promise
}
```

### Done when

Unit test in `@enkaku/generator`:
- aborting `consume()` over a generator with a `finally` block runs the `finally` (listener-cleanup semantics);
- same on normal completion (`done`);
- `return()` is not invoked twice when abort races loop-end.

---

## Item 3 — `Server` refuses silent auth-off (MEDIUM, footgun)

**File:** `packages/server/src/server.ts`.

### Problem

`ServerAccessOptions` (lines 731-733) lets a server be constructed with no `identity`; the constructor (lines 826-837) silently sets `requireAuth: false`. The message pump then never verifies tokens and `payload.iss`/`sub` are attacker-controlled. Kubun shipped an unauthenticated network-reachable read path this way.

### Fix

Make the no-identity branch require an explicit, loud opt-out, enforced at both type and runtime levels.

Type union:

```ts
export type ServerAccessOptions =
  | { identity?: undefined; requireAuth: false; accessRules?: never }
  | { identity: Identity; accessRules?: AccessRules }
```

Constructor: when `serverID == null` **and** `params.requireAuth !== false`, throw:

```
Invalid server parameters: a server without "identity" must explicitly pass "requireAuth: false" to disable authentication
```

The existing `accessRules`-requires-`identity` throw (line 828) stays. `requireAuth` already exists as the internal access-control discriminant (lines 76-77, 831, 840); this only surfaces it as the public opt-out signal. Runtime throw covers JS / type-erased consumers; the union covers TS at compile time.

### Done when

- `new Server({...})` with neither `identity` nor `requireAuth: false` throws.
- Existing tests that construct auth-less servers updated to pass `requireAuth: false`.
- `@enkaku/server` changelog flags the migration (stack-internal consumers, per audit decision record).

---

## Item 2 — hub group roster survives restart; join stops clobbering (CRITICAL with kubun)

**Files:** `packages/hub-protocol/src/types.ts`, `packages/hub-server/src/handlers.ts`, `packages/hub-server/src/memoryStore.ts`.

### Problem

`hub/group/send` resolves recipients from the in-memory `HubClientRegistry` only. The persisted store roster is written but never read at send time. `hub/group/join` overwrites the persisted set with current registry contents (`getGroupMembers` → `setGroupMembers`, handlers lines 244-249). After a hub restart the registry is empty; the first member to re-join writes `setGroupMembers(groupID, [self])`, deleting every other member's persisted row. Offline members silently receive nothing — including MLS commits, stranding them at an old epoch.

(The 2026-06-10 audit-remediation already made the registry keep offline group members registered via `unregisterIfIdle`, so within a single process lifetime offline members route correctly. This item closes the **cross-restart** gap and the **join clobber**, which that work did not.)

### Fix

**`HubStore` interface** (`packages/hub-protocol/src/types.ts`):
- **add** `addGroupMember(groupID: string, did: string): Promise<void>` — idempotent.
- **add** `removeGroupMember(groupID: string, did: string): Promise<void>`.
- **keep** `getGroupMembers(groupID: string): Promise<Array<string>>`.
- **remove** `setGroupMembers`. Its only callers were the clobbering join/leave; deleting it makes whole-roster replacement unrepresentable, so the clobber cannot regress.

Single-member primitives match every call site (join adds self, leave removes self). No batch method — YAGNI; add `addGroupMembers` later if an admin/import path appears.

**Handlers** (`packages/hub-server/src/handlers.ts`):
- `hub/group/join` → `await store.addGroupMember(groupID, clientDID)` (replaces the `getGroupMembers`→`setGroupMembers` block). Still calls `registry.register` + `registry.joinGroup` for live routing.
- `hub/group/leave` → `await store.removeGroupMember(groupID, clientDID)` before `registry.leaveGroup` / `unregisterIfIdle`. Explicit leave is the only durable removal.
- `hub/group/send` → resolve members from the union of durable roster and live registry:
  ```ts
  const durable = await store.getGroupMembers(groupID)
  const live = registry.getGroupMembers(groupID)
  const members = [...new Set([...durable, ...live])]
  if (!members.includes(senderDID)) {
    throw new Error(`Sender is not a member of group: ${groupID}`)
  }
  const recipients = members.filter((did) => did !== senderDID)
  ```
  `store.store(...)` already queues for every recipient and the push loop only delivers to online clients, so offline / post-restart members fetch on reconnect. No extra queueing code.

**Memory store** (`packages/hub-server/src/memoryStore.ts`): change `groupMembers` to `Map<string, Set<string>>`; `addGroupMember` adds, `removeGroupMember` deletes (drop the group key when the set empties), `getGroupMembers` returns `[...set]`. Remove `setGroupMembers`.

### Post-restart correctness

Registry is empty after restart → `store.getGroupMembers` carries the roster → a re-joined sender passes its own membership check and reaches offline peers. Re-join is now `addGroupMember` (additive), so it cannot delete peers' rows.

### Done when

Owned by kubun `next/04-hub-group-membership-persistence.md`; asserted here with an in-repo memory-store integration test:
- A and B join group G;
- simulate restart (fresh registry, same store);
- A re-joins and sends to G;
- offline B receives the message on a later connect;
- A's re-join did **not** remove B's row.

---

## Item 4 — advisories

### 4.1 — `payload.sub` is caller-asserted (doc)

Document on `AccessRules` / the server README: under array/`true` access rules, `checkClientToken` admits on `iss` and never validates `sub` as a delegation. `sub` is caller-asserted unless the delegation branch runs — do not trust it as a verified delegation. (Kubun stopped trusting it in `next/01`.)

### 4.3 — `EventEmitter.emit` rethrow (JSDoc)

**File:** `packages/event/src/index.ts` (`emit`, ~lines 100-116). Add a JSDoc warning: `emit` awaits listeners and rethrows failures, so a fire-and-forget `void emit(...)` becomes an unhandled rejection. Recommend `.catch(...)` on fire-and-forget emits. Behaviour unchanged.

### 4.4 — `ValidationError` message carries the first issue (small code)

**File:** `packages/schema/src/errors.ts` (`ValidationError` constructor, lines 35-43). The message is `Validation failed for schema <id>`; per-field detail lives only in `.issues`, which transports serializing only `message` drop. Append the first issue's locator to the message, e.g. `Validation failed for schema <id> (<instancePath> <keyword>)`, when `errorObjects` is non-empty. `.issues` / `.errors` unchanged. Unit test asserts the first issue's `instancePath` + `keyword` appear in `.message`.

### 4.5 — export structural transport shape — WONTFIX (premise wrong)

**Original ask:** export a structural transport shape so adapters cross the client/server boundary without `as unknown as` double-casts.

**Investigation verdict (2026-06-11, Task 7):** the premise is wrong — there is no type-variance defect in enkaku, so there is nothing to export. Each cast site was reproduced and compiled:

- `kubun/apps/local-todo/src/worker.ts:37` and `sakui/apps/desktop/src/renderer/runtime.ts:47` — the consumer constructs `new MessageTransport({...})` / `new Transport({...})` **without type arguments**, collapsing `R`/`W` to `unknown`. `unknown` is then (correctly) rejected on the covariant read position. Fix is in the consumer: supply the protocol message type args at construction. Zero enkaku change.
- `kubun/packages/plugin-p2p/src/hub/http-client.ts:43` — **stale** cast; `DIDObservingTransport` already matches `ClientTransportOf` structurally. Delete the cast.
- `enkaku/packages/server/test/transport-read-failure.test.ts:20` — deliberately-partial vi.fn mock; `as unknown as` is the sanctioned idiom. Leave.

A structural `AnyServerTransport` / relaxed `TransportType` message bound / `asServerTransport` guard would be a **net regression**: it re-admits `unknown` on the read side and weakens exactly the safety the casts currently bypass. No enkaku public-type change is warranted.

**Outcome:** no enkaku code change. Consumer-side fixes (kubun ×2, sakui ×1) filed as a follow-up for those repos. Optional, separate DX ticket: additive protocol-typed constructor helpers (`serverMessageTransport<P>`/`clientMessageTransport<P>`) to prevent the dropped-type-args footgun — not required to remove the casts.

---

## Testing & breaking-change handling

- **Unit:** item 1 (generator cleanup, no double-`return`), item 3 (throw paths), item 4.4 (message includes first issue).
- **Integration:** item 2 cross-restart over the memory store (kubun owns the persistent-store run in `next/04`).
- **Changelogs:**
  - `@enkaku/server` — item 3 break (must pass `requireAuth: false` without `identity`).
  - `@enkaku/hub-protocol` + `@enkaku/hub-server` — item 2 store-interface break (`setGroupMembers` removed; `addGroupMember` / `removeGroupMember` added).
  - Both stack-internal per the audit decision record.
- **Store impls:** in-repo `createMemoryStore` updated to the new interface during item 2; kubun's persistent store updated on the kubun side.
- **Lint:** run `rtk proxy pnpm run lint` (not bare `pnpm run lint`) in enkaku.

## Open questions

- **2c (deferred):** expiry policy for durable members that never send explicit leave (crash / uninstall) — ghost rosters grow unboundedly. Cost leak, not a correctness break. Resolve with the retention scheduler.
