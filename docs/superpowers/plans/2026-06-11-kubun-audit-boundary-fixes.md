# Kubun-audit Enkaku Boundary Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four enkaku-side boundary gaps from the kubun full-repo audit (generator iterator cleanup, hub group roster persistence, Server silent auth-off) plus four advisories.

**Architecture:** Five independent code areas across `@enkaku/generator`, `@enkaku/server`, `@enkaku/hub-protocol` + `@enkaku/hub-server`, `@enkaku/schema`, `@enkaku/event`, and a final type-variance investigation in `@enkaku/protocol`/`@enkaku/transport`. Each task is self-contained; ordering follows risk: smallest-independent first, breaking changes mid, the type investigation last.

**Tech Stack:** TypeScript, pnpm workspace, vitest. Tests live in `packages/<pkg>/test/*.test.ts`, import implementation from `../src/index.js`. Lint via `rtk proxy pnpm run lint` (NOT bare `pnpm run lint`).

**Spec:** `docs/superpowers/specs/2026-06-11-kubun-audit-boundary-fixes-design.md`

**Conventions (from AGENTS.md — enforce in every task):** `type` not `interface`; `Array<T>` not `T[]`; no `any` (use `unknown`/`Record<string,unknown>`); names use `ID`/`HTTP`/`JWT` not `Id`/`Http`/`Jwt`; never edit generated files (`.gen.ts`, `lib/`, `__generated__/`).

---

## Task 1: `consume()` closes its source iterator (Item 1, HIGH)

**Files:**
- Modify: `packages/generator/src/index.ts:16-48` (`consume`)
- Test: `packages/generator/test/lib.test.ts` (existing `describe('consume()')` block)

**Context:** `consume()` drives an `AsyncIterator` via a recursive `pull()` loop, resolving a deferred on `done` and rejecting on abort/error. It never calls `iterator.return?.()`, so a source generator's `finally` block (listener cleanup in `fromEmitter`, `releaseLock` in `fromStream`) never runs. Kubun's `graph/subscribe` leaks an event listener + unbounded queue on every subscribe→disconnect. Fix: call `iterator.return?.()` (awaited, error-swallowed, once) on abort and on normal loop termination, without changing the existing resolve/reject value.

- [ ] **Step 1: Write the failing test — cleanup on abort**

Add to `packages/generator/test/lib.test.ts` inside `describe('consume()', ...)`:

```ts
  test('calls iterator.return() (runs finally) on abort', async () => {
    let cleanedUp = false
    async function* generate() {
      try {
        let i = 0
        while (true) {
          yield i++
        }
      } finally {
        cleanedUp = true
      }
    }

    const controller = new AbortController()
    const promise = consume(
      generate(),
      (value) => {
        if (value === 2) controller.abort(new Error('stop'))
      },
      controller.signal,
    )
    await expect(promise).rejects.toThrow('stop')
    // allow the swallowed return() microtask to settle
    await Promise.resolve()
    expect(cleanedUp).toBe(true)
  })

  test('calls iterator.return() (runs finally) on normal completion', async () => {
    let cleanedUp = false
    async function* generate() {
      try {
        yield 1
        yield 2
        return 'done'
      } finally {
        cleanedUp = true
      }
    }

    const result = await consume(generate(), () => {})
    expect(result).toBe('done')
    expect(cleanedUp).toBe(true)
  })

  test('does not call iterator.return() twice when abort races completion', async () => {
    let returnCalls = 0
    const iterator: AsyncIterator<number> = {
      next: async () => ({ done: true, value: undefined }),
      return: async () => {
        returnCalls++
        return { done: true, value: undefined }
      },
    }
    const controller = new AbortController()
    controller.abort(new Error('stop'))
    await expect(
      consume(iterator, () => {}, controller.signal),
    ).rejects.toThrow('stop')
    await Promise.resolve()
    expect(returnCalls).toBeLessThanOrEqual(1)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/generator run test:unit`
Expected: the two `cleanedUp` assertions FAIL (`cleanedUp` stays `false`); the double-return test may pass already but must keep passing.

- [ ] **Step 3: Implement cleanup in `consume()`**

Replace `packages/generator/src/index.ts:16-48` with:

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
    // Run the source's cleanup (finally blocks). Swallow errors so cleanup
    // failures never mask the resolve/reject reason already settled below.
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
        if (done) {
          ended.resolve(value)
        }
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/generator run test:unit`
Expected: all `consume()` tests PASS, including pre-existing ones.

- [ ] **Step 5: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/generator/src/index.ts packages/generator/test/lib.test.ts
git commit -m "fix(generator): consume() closes source iterator on abort and completion"
```

---

## Task 2: `Server` refuses silent auth-off (Item 3, MEDIUM, BREAKING)

**Files:**
- Modify: `packages/server/src/server.ts:731-733` (`ServerAccessOptions` union)
- Modify: `packages/server/src/server.ts:826-837` (constructor `serverID == null` branch)
- Test: `packages/server/test/access-control-config.test.ts`

**Context:** `ServerAccessOptions` lets a server be built with no `identity`; the constructor then silently sets `requireAuth: false` and never verifies tokens, making `payload.iss`/`sub` attacker-controlled. Kubun shipped an unauthenticated read path this way. Fix: require an explicit `requireAuth: false` opt-out — enforced at the type level (union) and at runtime (throw). `requireAuth` already exists as the internal access-control discriminant (`server.ts:76-77`); this surfaces it as the public opt-out.

**Note — existing test will break by design:** `access-control-config.test.ts` currently has `test('builds standalone server when no identity and no accessRules')` constructing `new Server<Protocol>({ handlers, protocol })` and asserting `.not.toThrow()`. That construction must now throw. Step 1 updates that test; do not leave it asserting the old behaviour.

- [ ] **Step 1: Update existing test + add new throw/opt-out tests**

In `packages/server/test/access-control-config.test.ts`, replace the `builds standalone server when no identity and no accessRules` test with:

```ts
  test('throws when neither identity nor requireAuth:false is provided', () => {
    expect(() => {
      // @ts-expect-error - a server without identity must opt out of auth explicitly
      new Server<Protocol>({ handlers, protocol })
    }).toThrow('must explicitly pass "requireAuth: false"')
  })

  test('builds standalone server when requireAuth:false is passed without identity', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol, requireAuth: false })
    }).not.toThrow()
  })
```

Leave the other tests (`throws when accessRules provided without identity`, `defaults to server-only access when identity provided`, `allows identity with accessRules record`) unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/server run test:unit -- access-control-config`
Expected: new `throws when neither identity nor requireAuth:false` FAILS (no throw yet); `builds standalone server when requireAuth:false` may fail to type-check (`requireAuth` not yet on the type).

- [ ] **Step 3: Update the `ServerAccessOptions` type union**

Replace `packages/server/src/server.ts:731-733`:

```ts
export type ServerAccessOptions =
  | { identity?: undefined; requireAuth: false; accessRules?: never }
  | { identity: Identity; accessRules?: AccessRules }
```

- [ ] **Step 4: Add the runtime throw in the constructor**

In `packages/server/src/server.ts`, the `serverID == null` branch currently starts at line 826:

```ts
    if (serverID == null) {
      if (accessRules != null) {
        throw new Error('Invalid server parameters: "accessRules" requires "identity"')
      }
```

Insert, immediately after the `accessRules != null` throw and before `this.#accessControl = {`:

```ts
      if ((params as { requireAuth?: boolean }).requireAuth !== false) {
        throw new Error(
          'Invalid server parameters: a server without "identity" must explicitly pass "requireAuth: false" to disable authentication',
        )
      }
```

(The `requireAuth: false` assignment in the `this.#accessControl` object below stays as-is.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/server run test:unit -- access-control-config`
Expected: all tests in the file PASS.

- [ ] **Step 6: Sweep for other server constructions broken by the change**

Run: `rtk grep "new Server" packages/server/test` and `rtk grep "serve\\(" packages --glob '*.test.ts'`
For any test that constructs a server / calls `serve()` with no `identity` and no `requireAuth: false` and expects success, add `requireAuth: false`. Run the full server suite:

Run: `pnpm --filter @enkaku/server run test:unit`
Expected: PASS. Fix any newly-failing construction sites the same way.

- [ ] **Step 7: Add changelog entry**

If `packages/server/` uses changesets or a CHANGELOG, add an entry noting the breaking change: "A `Server`/`serve()` without `identity` now throws unless `requireAuth: false` is passed explicitly." Match the repo's existing changelog mechanism (check for `.changeset/` at repo root or `CHANGELOG.md` in the package). If neither exists, skip this step.

- [ ] **Step 8: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/server.ts packages/server/test
git commit -m "feat(server)!: require explicit requireAuth:false when no identity given"
```

---

## Task 3: Hub group roster — store interface primitives (Item 2 part A)

**Files:**
- Modify: `packages/hub-protocol/src/types.ts:44-54` (`HubStore` type)
- Modify: `packages/hub-server/src/memoryStore.ts` (`createMemoryStore`)
- Test: `packages/hub-server/test/memoryStore.test.ts`

**Context:** `HubStore` exposes only `setGroupMembers` (whole-roster replace) + `getGroupMembers`. Join/leave use the replace form, which clobbers peers after a hub restart (empty registry → first re-joiner overwrites the roster with `[self]`). Replace the whole-roster method with idempotent single-member primitives so the clobber is unrepresentable. Single-member matches every call site (join adds self, leave removes self); no batch method (YAGNI).

- [ ] **Step 1: Write failing tests for the new store primitives**

Check the existing `setGroupMembers` test in `packages/hub-server/test/memoryStore.test.ts` first (`rtk grep "GroupMembers" packages/hub-server/test/memoryStore.test.ts`) and replace any `setGroupMembers` test with:

```ts
  test('addGroupMember adds members idempotently', async () => {
    const store = createMemoryStore()
    await store.addGroupMember('g1', 'did:key:alice')
    await store.addGroupMember('g1', 'did:key:bob')
    await store.addGroupMember('g1', 'did:key:alice') // duplicate
    const members = await store.getGroupMembers('g1')
    expect([...members].sort()).toEqual(['did:key:alice', 'did:key:bob'])
  })

  test('removeGroupMember removes a single member without touching others', async () => {
    const store = createMemoryStore()
    await store.addGroupMember('g1', 'did:key:alice')
    await store.addGroupMember('g1', 'did:key:bob')
    await store.removeGroupMember('g1', 'did:key:alice')
    expect(await store.getGroupMembers('g1')).toEqual(['did:key:bob'])
  })

  test('getGroupMembers returns empty array for unknown group', async () => {
    const store = createMemoryStore()
    expect(await store.getGroupMembers('nope')).toEqual([])
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/hub-server run test:unit -- memoryStore`
Expected: FAIL — `addGroupMember`/`removeGroupMember` not a function / type errors.

- [ ] **Step 3: Update the `HubStore` type**

In `packages/hub-protocol/src/types.ts`, replace line 52 (`setGroupMembers(...)`) so the `HubStore` member block reads:

```ts
  storeKeyPackage(ownerDID: string, keyPackage: string): Promise<void>
  fetchKeyPackages(ownerDID: string, count?: number): Promise<Array<string>>
  addGroupMember(groupID: string, did: string): Promise<void>
  removeGroupMember(groupID: string, did: string): Promise<void>
  getGroupMembers(groupID: string): Promise<Array<string>>
```

- [ ] **Step 4: Update `createMemoryStore`**

In `packages/hub-server/src/memoryStore.ts`:

Change the `groupMembers` declaration (line 34) from:

```ts
  const groupMembers = new Map<string, Array<string>>()
```
to:
```ts
  const groupMembers = new Map<string, Set<string>>()
```

Replace the `setGroupMembers`/`getGroupMembers` methods (lines 191-197) with:

```ts
    async addGroupMember(groupID: string, did: string): Promise<void> {
      let members = groupMembers.get(groupID)
      if (members == null) {
        members = new Set()
        groupMembers.set(groupID, members)
      }
      members.add(did)
    },

    async removeGroupMember(groupID: string, did: string): Promise<void> {
      const members = groupMembers.get(groupID)
      if (members == null) return
      members.delete(did)
      if (members.size === 0) {
        groupMembers.delete(groupID)
      }
    },

    async getGroupMembers(groupID: string): Promise<Array<string>> {
      const members = groupMembers.get(groupID)
      return members == null ? [] : [...members]
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/hub-server run test:unit -- memoryStore`
Expected: PASS.

- [ ] **Step 6: Build types to confirm no other `setGroupMembers` callers remain (besides handlers, fixed in Task 4)**

Run: `rtk grep "setGroupMembers" packages`
Expected: only `packages/hub-server/src/handlers.ts` still references it (fixed next task). Any other non-generated reference must be updated now.

- [ ] **Step 7: Commit**

```bash
git add packages/hub-protocol/src/types.ts packages/hub-server/src/memoryStore.ts packages/hub-server/test/memoryStore.test.ts
git commit -m "feat(hub-protocol)!: replace setGroupMembers with add/removeGroupMember"
```

---

## Task 4: Hub group roster — handler join/leave/send (Item 2 part B)

**Files:**
- Modify: `packages/hub-server/src/handlers.ts:87-113` (`hub/group/send`)
- Modify: `packages/hub-server/src/handlers.ts:233-263` (`hub/group/join`, `hub/group/leave`)
- Test: `packages/hub-server/test/hub.test.ts`

**Context:** Builds on Task 3's store primitives. Join must add (not replace) the durable roster; leave must remove a single member; send must resolve recipients from the durable roster ∪ live registry so offline and post-restart members are reached. `store.store(...)` already queues for every recipient and the push loop only delivers to online clients, so offline members fetch on reconnect — no extra queueing code needed.

- [ ] **Step 1: Write the failing cross-restart integration test**

Read the existing helpers in `packages/hub-server/test/hub.test.ts` (the `createMemoryStore`/`HubClientRegistry`/`createHandlers` harness around lines 47-124, and the existing `hub/group/send fans out to group members` test around line 176) to match the connection/credential helpers. Add a new test that reuses one `store` across two `createHandlers` instances to simulate a restart:

```ts
  test('group roster survives hub restart; re-join does not clobber peers', async () => {
    const store = createMemoryStore()

    // --- first hub lifetime: alice and bob join group 'chat' ---
    {
      const registry = new HubClientRegistry()
      const handlers = createHandlers({ registry, store })
      // (use the file's existing connect/credential helpers to drive these)
      // alice.request('hub/group/join', { param: { groupID: 'chat', credential: credentialAlice, ... } })
      // bob.request('hub/group/join',   { param: { groupID: 'chat', credential: credentialBob,   ... } })
    }
    expect((await store.getGroupMembers('chat')).sort()).toEqual(
      [aliceDID, bobDID].sort(),
    )

    // --- restart: fresh registry, SAME store; bob stays offline ---
    const registry2 = new HubClientRegistry()
    const handlers2 = createHandlers({ registry: registry2, store })
    // alice reconnects and re-joins
    // alice2.request('hub/group/join', { param: { groupID: 'chat', credential: credentialAlice, ... } })

    // alice's re-join must NOT have removed bob
    expect((await store.getGroupMembers('chat')).sort()).toEqual(
      [aliceDID, bobDID].sort(),
    )

    // alice sends; bob (offline) must have a queued message to fetch on reconnect
    // await alice2.request('hub/group/send', { param: { groupID: 'chat', payload: encodePayload('after-restart') } })
    const queued = await store.fetch({ recipientDID: bobDID })
    expect(queued.messages.length).toBeGreaterThan(0)
  })
```

Fill the commented lines using the file's existing client/credential helpers (the same ones the `fans out to group members` test uses). `aliceDID`/`bobDID` are the DIDs of those identities.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/hub-server run test:unit -- hub`
Expected: FAIL — currently join calls `setGroupMembers` (now removed → type/runtime error) and/or the roster gets clobbered.

- [ ] **Step 3: Update `hub/group/join`**

In `packages/hub-server/src/handlers.ts`, replace the persistence block in `hub/group/join` (lines 244-249):

```ts
      registry.register(clientDID)
      registry.joinGroup(clientDID, groupID)
      if (store != null) {
        const members = registry.getGroupMembers(groupID)
        await store.setGroupMembers(groupID, members)
      }
      return { joined: true }
```
with:
```ts
      registry.register(clientDID)
      registry.joinGroup(clientDID, groupID)
      if (store != null) {
        await store.addGroupMember(groupID, clientDID)
      }
      return { joined: true }
```

- [ ] **Step 4: Update `hub/group/leave`**

Replace the persistence block in `hub/group/leave` (lines 256-261):

```ts
      registry.leaveGroup(clientDID, groupID)
      if (store != null) {
        const members = registry.getGroupMembers(groupID)
        await store.setGroupMembers(groupID, members)
      }
      registry.unregisterIfIdle(clientDID)
      return { left: true }
```
with:
```ts
      registry.leaveGroup(clientDID, groupID)
      if (store != null) {
        await store.removeGroupMember(groupID, clientDID)
      }
      registry.unregisterIfIdle(clientDID)
      return { left: true }
```

- [ ] **Step 5: Update `hub/group/send` recipient resolution**

Replace the member-resolution + send block in `hub/group/send` (lines 87-113). Current:

```ts
    'hub/group/send': (async (ctx) => {
      const { groupID, payload } = ctx.param
      const senderDID = getClientDID(ctx)
      const members = registry.getGroupMembers(groupID)
      if (!members.includes(senderDID)) {
        throw new Error(`Sender is not a member of group: ${groupID}`)
      }

      const recipients = members.filter((did) => did !== senderDID)
```
becomes:
```ts
    'hub/group/send': (async (ctx) => {
      const { groupID, payload } = ctx.param
      const senderDID = getClientDID(ctx)
      // Durable roster ∪ live registry: the store carries membership across
      // restarts (registry is empty after a restart); the registry covers
      // members joined this lifetime not yet observed in a fresh store read.
      const durable = store != null ? await store.getGroupMembers(groupID) : []
      const members = [...new Set([...durable, ...registry.getGroupMembers(groupID)])]
      if (!members.includes(senderDID)) {
        throw new Error(`Sender is not a member of group: ${groupID}`)
      }

      const recipients = members.filter((did) => did !== senderDID)
```

(The rest of the handler — `store.store(...)` and the online-delivery loop — is unchanged.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/hub-server run test:unit -- hub`
Expected: PASS, including the existing `fans out to group members` and `fails on unknown group` tests and the new restart test.

- [ ] **Step 7: Run the full hub-server suite + lint**

Run: `pnpm --filter @enkaku/hub-server run test:unit`
Run: `rtk proxy pnpm run lint`
Expected: PASS, no lint errors.

- [ ] **Step 8: Add changelog entry**

If `@enkaku/hub-protocol` / `@enkaku/hub-server` use changesets/CHANGELOG, note: "Hub group membership is now persisted per-member; rosters survive hub restart and a re-join no longer clobbers other members. `HubStore.setGroupMembers` replaced by `addGroupMember`/`removeGroupMember`." Skip if no changelog mechanism exists.

- [ ] **Step 9: Commit**

```bash
git add packages/hub-server/src/handlers.ts packages/hub-server/test/hub.test.ts
git commit -m "fix(hub-server): persist group roster per-member; resolve send via store∪registry"
```

---

## Task 5: `ValidationError` message carries the first issue (Item 4.4)

**Files:**
- Modify: `packages/schema/src/errors.ts:35-43` (`ValidationError` constructor)
- Test: `packages/schema/test/lib.test.ts`

**Context:** `ValidationError.message` is `Validation failed for schema <id>`; per-field detail lives only in `.issues`, which transports serializing only `message` drop. Append the first issue's locator (`instancePath` + `keyword`) to the message so field detail survives serialization. `.issues`/`.errors` are unchanged.

- [ ] **Step 1: Write the failing test**

Add to `packages/schema/test/lib.test.ts` (a `describe('ValidationError', ...)` block — create it if absent):

```ts
describe('ValidationError message', () => {
  test('includes the first issue locator in the message', () => {
    const validate = createValidator({
      $id: 'test-schema',
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    } as const)
    let error: unknown
    try {
      assertType(validate, {})
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(ValidationError)
    const message = (error as ValidationError).message
    expect(message).toContain('test-schema')
    // first issue locator: required-property keyword surfaces in the message
    expect(message).toMatch(/required/)
  })
})
```

If `assertType`/`createValidator` usage differs in the file, match the existing pattern at the top of `lib.test.ts` (it imports `assertType`, `createValidator`, `ValidationError` from `../src/index.js`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/schema run test:unit -- lib`
Expected: FAIL — message contains only `Validation failed for schema test-schema`, not `required`.

- [ ] **Step 3: Update the `ValidationError` constructor**

In `packages/schema/src/errors.ts`, replace the constructor (lines 35-43):

```ts
  constructor(schema: Schema, value: unknown, errorObjects?: Array<ErrorObject> | null) {
    const schemaInfo = schema.$id ?? schema.type
    super(
      (errorObjects ?? []).map((err) => new ValidationErrorObject(err)),
      schemaInfo ? `Validation failed for schema ${schemaInfo}` : 'Schema validation failed',
    )
    this.#schema = schema
    this.#value = value
  }
```
with:
```ts
  constructor(schema: Schema, value: unknown, errorObjects?: Array<ErrorObject> | null) {
    const schemaInfo = schema.$id ?? schema.type
    const base = schemaInfo
      ? `Validation failed for schema ${schemaInfo}`
      : 'Schema validation failed'
    // Surface the first issue's locator in the message so transports that
    // serialize only `message` (dropping `.issues`) keep field-level detail.
    const first = errorObjects?.[0]
    const detail =
      first != null
        ? ` (${first.instancePath || '/'} ${first.keyword})`
        : ''
    super(
      (errorObjects ?? []).map((err) => new ValidationErrorObject(err)),
      `${base}${detail}`,
    )
    this.#schema = schema
    this.#value = value
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/schema run test:unit -- lib`
Expected: PASS. Also run the full schema suite (`pnpm --filter @enkaku/schema run test:unit`) — fix any existing test that asserted the exact old message string by loosening it to `toContain('Validation failed for schema ...')`.

- [ ] **Step 5: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/errors.ts packages/schema/test/lib.test.ts
git commit -m "feat(schema): include first issue locator in ValidationError message"
```

---

## Task 6: Documentation advisories (Items 4.1, 4.3)

**Files:**
- Modify: `packages/event/src/index.ts` (`EventEmitter.emit` JSDoc, ~lines 100-118)
- Modify: server access-rules doc — locate via `rtk grep "AccessRules" packages/server/src` and check `packages/server/README.md`

**Context:** Two doc-only advisories, no behaviour change.
- **4.1:** `payload.sub` is caller-asserted, not verified, unless the delegation branch of `checkClientToken` runs. Consumers (kubun) wrongly trusted it. Document on `AccessRules` / server README.
- **4.3:** `EventEmitter.emit` awaits listeners and rethrows failures, so a fire-and-forget `void emit(...)` becomes an unhandled rejection. Recommend `.catch` on fire-and-forget.

- [ ] **Step 1: Add the `emit` JSDoc warning (4.3)**

In `packages/event/src/index.ts`, find the `emit` overloads/implementation (~line 100). Add a JSDoc block immediately above the first `emit` overload:

```ts
  /**
   * Emits an event to all listeners.
   *
   * Listeners are awaited and their failures are rethrown (a single error as-is,
   * multiple as an `AggregateError`). A fire-and-forget call — `void emit(...)`
   * — therefore turns a listener failure into an unhandled promise rejection.
   * For fire-and-forget emits, attach a handler: `emit(...).catch(...)`.
   */
```

(Place it above the `emit<Name extends DatalessEventNames<Events>>(name: Name): Promise<void>` overload line so it documents the public method.)

- [ ] **Step 2: Document `payload.sub` semantics (4.1)**

Find where `AccessRules` is defined/documented: `rtk grep "type AccessRules" packages/server/src`. Add a JSDoc note on the `AccessRules` type (and, if `packages/server/README.md` documents access rules, a short paragraph there):

```ts
/**
 * ...existing description...
 *
 * Security note: access checks admit on the verified issuer (`payload.iss`).
 * `payload.sub` is caller-asserted and is NOT validated as a delegation unless
 * a delegation rule explicitly triggers that branch. Do not treat `sub` as a
 * verified identity in handlers.
 */
```

Match the existing JSDoc style on the type. If `AccessRules` already has a JSDoc block, extend it rather than adding a second.

- [ ] **Step 3: Verify docs build / types still compile**

Run: `pnpm --filter @enkaku/event run build:types` and `pnpm --filter @enkaku/server run build:types`
Expected: succeed (doc-only change; no behaviour).

- [ ] **Step 4: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/event/src/index.ts packages/server
git commit -m "docs(event,server): warn on fire-and-forget emit; document payload.sub trust"
```

---

## Task 7: Transport double-cast type-variance investigation (Item 4.5) — GATED → WONTFIX

**Outcome (2026-06-11): investigation complete, NO enkaku change.** The gated investigation (Steps 1-3) reproduced and compiled every cast site and found the advisory's premise wrong — there is no type-variance defect in enkaku, so there is nothing to export or relax.

**Findings:**
- `kubun/apps/local-todo/src/worker.ts:37` and `sakui/apps/desktop/src/renderer/runtime.ts:47` — consumer constructs `new MessageTransport({...})` / `new Transport({...})` **without type arguments**, collapsing read/write generics to `unknown`; `unknown` is then correctly rejected on the covariant read position. Fix is consumer-side (supply the protocol message type args). Zero enkaku change.
- `kubun/packages/plugin-p2p/src/hub/http-client.ts:43` — **stale** cast; `DIDObservingTransport` already matches `ClientTransportOf` structurally. Delete it.
- `enkaku/packages/server/test/transport-read-failure.test.ts:20` — deliberately-partial vi.fn mock; `as unknown as` is the sanctioned idiom. Leave.

A structural `AnyServerTransport` / relaxed `TransportType` bound / `asServerTransport` guard would be a **net regression** (re-admits `unknown` on the read side, weakening the safety the casts bypass). Decision (human, 2026-06-11): record the finding, make no enkaku change.

**Follow-ups filed for OTHER repos (not this plan):**
- kubun `apps/local-todo/src/worker.ts:37` — parameterize `MessageTransport<AnyClientMessageOf<P>, AnyServerMessageOf<P>>`, drop cast.
- kubun `packages/plugin-p2p/src/hub/http-client.ts:43` — delete stale cast.
- sakui `apps/desktop/src/renderer/runtime.ts:47` — parameterize `Transport<AnyServerMessageOf<P>, AnyClientMessageOf<P>>`, drop cast.
- Optional DX ticket (enkaku, additive/non-breaking): protocol-typed constructor helpers `serverMessageTransport<P>`/`clientMessageTransport<P>` in `@enkaku/message-transport`/`@enkaku/transport` to prevent the dropped-type-args footgun. Not required.

---

## Final review

After all tasks: dispatch a final code review over the full diff (`git diff main...HEAD`) covering all four items, then use superpowers:finishing-a-development-branch.

Deferred (NOT in this plan, file as follow-ups): **2c** durable group-member expiry (ghost rosters → retention scheduler); **4.2** mid-session redeliver (nack / redeliver-now → new protocol request).
```
