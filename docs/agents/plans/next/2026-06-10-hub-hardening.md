# Hub Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the hub authorization gaps (DID impersonation, unvalidated group join, non-member group send, key-package exhaustion), bound protocol message sizes, fix hub lifecycle leaks (receive lockout, registry growth, never-purged mail), and make long-lived `hub/receive` channels survive the server's 5-minute controller timeout and 100-concurrent-handler cap.

**Architecture:** `createHub` (packages/hub-server) wires `createHandlers` + `HubClientRegistry` into `serve()` from `@enkaku/server`. The server verifies signed tokens when an `identity` is provided, so every handler can trust `payload.iss` — all authorization checks build on that. Server-side resource limits live in `packages/server/src/limits.ts` (`ResourceLimiter`) and are enforced in `processHandler` in `packages/server/src/server.ts`; a new `longLivedProcedures` limit exempts hub receive channels from timeout and the handler cap.

**Tech Stack:** TypeScript, vitest, @enkaku/server, @enkaku/group capabilities

---

## Verified-source notes (read before executing)

- **Mechanism choice for server limits (item 7 of the design doc):** `ResourceLimits` gains `longLivedProcedures: Array<string>` (default `[]`). `processHandler` (`packages/server/src/server.ts:179`) computes `longLived` from `message.payload.prc` once and closes over it. The limiter stores a `longLived` flag per controller: `getExpiredControllers()` skips long-lived entries (timeout exemption), and `acquireHandler(longLived)` counts long-lived handlers in a **separate counter** (`activeLongLivedHandlers`) that bypasses `maxConcurrentHandlers` and is bounded only by `maxControllers` (default 10000). The timeout-cleanup interval (`server.ts:113-137`) calls `releaseHandler()` only for expired rids, and long-lived rids never expire, so it never needs the flag. This is the smallest change that satisfies both "exempt from controllerTimeoutMs" and "count separately from maxConcurrentHandlers".
- **Mismatch found:** `createHub` (`packages/hub-server/src/hub.ts:24-40`) never passes `protocol` to `serve()`, so the server logs "No protocol provided: message validation is disabled" and the schema quotas of the design doc would be dead code. Task 5 wires `protocol: hubProtocol` into `serve()`.
- **Mismatch found:** with `identity` set and no `accessRules`, `checkClientToken` → `checkProcedureAccess` (`packages/server/src/access-control.ts:66-118`) denies **every** procedure (no pattern matches → `Access denied`). `createHub` must default `accessRules` to `{ 'hub/*': { allow: true } }` (the hub is an open relay for any authenticated DID). Clients must also pass `serverID` so signed tokens carry `aud` = hub DID (`checkClientToken`, `access-control.ts:152` throws `Invalid audience` otherwise).
- **Mismatch found:** unconditional `registry.unregister` on channel abort (design doc lifecycle bullet) would break offline group routing: `hub/group/send` reads membership from `registry.getGroupMembers` (`handlers.ts:41`), not from the store, so unregistering a disconnected member would drop them from group fan-out. Task 6 adds `unregisterIfIdle` (unregister only when the entry has no bound writer **and** no group memberships), which still fixes the unbounded growth of one-shot receive clients.
- **Mismatch found:** `validateGroupCapability` (`packages/group/src/capability.ts:81-110`) requires a `delegationChain` for capabilities where `iss !== sub`. A single `credential` string is sufficient for the group creator (`createGroupCapability`: iss === sub === aud) and for members directly delegated by the creator (`delegateGroupMembership` signed by the creator: iss === sub, aud = member). Deeper chains need the chain on the wire, so Task 2 adds an optional `delegationChain` array to the `hub/group/join` param.
- vitest resolves workspace deps through built `lib/` output (no src aliases). Any task that changes `@enkaku/hub-protocol` or `@enkaku/server` must rebuild that package (`pnpm --filter <pkg> run build`) before running `@enkaku/hub-server` / `@enkaku/hub-client` tests.
- Handler errors thrown inside hub handlers reach the client wrapped by `HandlerError.from` with a generic message (see comment in `packages/hub-server/test/hub.test.ts:314-317`), so rejection tests assert `rejects.toThrow()` without a message unless the error is produced by the server auth layer before the handler runs (those messages, e.g. `Message is not signed`, are preserved).
- Lint command in this repo: `rtk proxy pnpm run lint` (never bare `pnpm run lint`).

---

### Task 1: Require `identity` in `createHub` and derive client DID from verified `iss` only

**Files:**
- `packages/hub-server/src/hub.ts` (whole file, currently 41 lines)
- `packages/hub-server/src/handlers.ts:12-15` (`getClientDID`)
- `packages/hub-server/test/hub.test.ts` (whole file — authenticated fixtures)
- `packages/hub-client/test/client.test.ts:25-47` (fixtures)

- [ ] **Step 1.1 — Write failing tests.** Replace the entire content of `packages/hub-server/test/hub.test.ts` with:

```ts
import { Client } from '@enkaku/client'
import { fromUTF, toB64 } from '@enkaku/codec'
import type { HubProtocol, HubStore } from '@enkaku/hub-protocol'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { type OwnIdentity, randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { createHandlers } from '../src/handlers.js'
import { type CreateHubParams, createHub, type HubInstance } from '../src/hub.js'
import { createMemoryStore } from '../src/memoryStore.js'
import { HubClientRegistry } from '../src/registry.js'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function encodePayload(value: string): string {
  return toB64(fromUTF(value))
}

export type TestHubOptions = Omit<CreateHubParams, 'identity' | 'store' | 'transport'> & {
  store?: HubStore
}

type TestConnection = {
  client: Client<HubProtocol>
  identity: OwnIdentity
}

type TestHub = {
  hub: HubInstance
  hubID: string
  store: HubStore
  connect: (identity?: OwnIdentity) => TestConnection
  dispose: () => Promise<void>
}

function createTestHub(options: TestHubOptions = {}): TestHub {
  const { store: providedStore, ...hubOptions } = options
  const store = providedStore ?? createMemoryStore()
  const hubIdentity = randomIdentity()
  const firstTransports: HubTransports = new DirectTransports()
  const allTransports: Array<HubTransports> = [firstTransports]
  const hub = createHub({
    ...hubOptions,
    identity: hubIdentity,
    store,
    transport: firstTransports.server,
  })
  let firstUsed = false

  function connect(identity: OwnIdentity = randomIdentity()): TestConnection {
    let transports: HubTransports
    if (firstUsed) {
      transports = new DirectTransports()
      allTransports.push(transports)
      hub.server.handle(transports.server)
    } else {
      transports = firstTransports
      firstUsed = true
    }
    const client = new Client<HubProtocol>({
      transport: transports.client,
      identity,
      serverID: hubIdentity.id,
    })
    return { client, identity }
  }

  async function dispose(): Promise<void> {
    await hub.server.dispose()
    await Promise.all(allTransports.map((transports) => transports.dispose()))
  }

  return { hub, hubID: hubIdentity.id, store, connect, dispose }
}

describe('hub authentication', () => {
  test('rejects unsigned client messages', async () => {
    const ctx = createTestHub()
    const transports: HubTransports = new DirectTransports()
    ctx.hub.server.handle(transports.server)
    // No identity: the client sends unsigned tokens
    const anonymous = new Client<HubProtocol>({ transport: transports.client })

    await expect(
      anonymous.request('hub/send', {
        param: { recipients: ['did:test:recipient'], payload: encodePayload('nope') },
      }),
    ).rejects.toThrow('Message is not signed')

    await transports.dispose()
    await ctx.dispose()
  })

  test('handlers reject messages without a verified issuer DID', async () => {
    const registry = new HubClientRegistry()
    const store = createMemoryStore()
    const handlers = createHandlers({ registry, store })
    await expect(
      handlers['hub/send']({
        message: { header: {}, payload: { typ: 'request', prc: 'hub/send', rid: '1' } },
        param: { recipients: ['did:test:recipient'], payload: encodePayload('x') },
        signal: new AbortController().signal,
      } as never),
    ).rejects.toThrow('missing verified issuer')
  })
})

describe('hub handlers', () => {
  test('hub/send delivers to explicit recipient via channel', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    // Bob opens receive channel
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    await delay(50)

    // Alice sends to Bob
    const payload = encodePayload('hello-bob')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)
    expect(msg.value?.senderDID).toBe(aliceIdentity.id)

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/group/send fails on unknown group', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()

    await expect(
      alice.request('hub/group/send', {
        param: { groupID: 'nonexistent', payload: encodePayload('hello') },
      }),
    ).rejects.toThrow()

    await ctx.dispose()
  })

  test('hub/group/send fans out to group members', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const { client: bob } = ctx.connect()

    // Both join group
    await alice.request('hub/group/join', {
      param: { groupID: 'chat', credential: 'test' },
    })
    await bob.request('hub/group/join', {
      param: { groupID: 'chat', credential: 'test' },
    })

    // Bob opens receive channel
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    await delay(50)

    // Alice sends to group
    await alice.request('hub/group/send', {
      param: { groupID: 'chat', payload: encodePayload('group-message') },
    })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(encodePayload('group-message'))
    expect(msg.value?.groupID).toBe('chat')

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/receive delivers queued messages on connect', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()

    // Alice sends to Bob while Bob is offline
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('offline-msg') },
    })
    await delay(50)

    // Bob connects and opens receive channel
    const { client: bob } = ctx.connect(bobIdentity)
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(encodePayload('offline-msg'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/receive ack flow', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()

    // Send messages while Bob is offline
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('msg-1') },
    })
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('msg-2') },
    })
    await delay(50)

    // Bob connects, receives messages
    const { client: bob } = ctx.connect(bobIdentity)
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg1 = await reader.read()
    const msg2 = await reader.read()

    // Ack both messages
    const ack = [msg1.value?.sequenceID, msg2.value?.sequenceID].filter(
      (id): id is string => id != null,
    )
    await channel.send({ ack })
    await delay(50)

    // Close and reconnect -- should get no old messages
    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)

    const { client: bob2 } = ctx.connect(bobIdentity)
    const channel2 = bob2.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()

    // Send a new message to verify channel works
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('msg-3') },
    })
    const msg3 = await reader2.read()
    expect(msg3.value?.payload).toBe(encodePayload('msg-3'))

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('key package upload and fetch', async () => {
    const ctx = createTestHub()
    const { client, identity } = ctx.connect()

    const result = await client.request('hub/keypackage/upload', {
      param: { keyPackages: ['kp-1', 'kp-2'] },
    })
    expect(result.stored).toBe(2)

    const fetched = await client.request('hub/keypackage/fetch', {
      param: { did: identity.id, count: 1 },
    })
    expect(fetched.keyPackages).toHaveLength(1)

    await ctx.dispose()
  })

  test('group join and leave', async () => {
    const ctx = createTestHub()
    const { client } = ctx.connect()

    const joinResult = await client.request('hub/group/join', {
      param: { groupID: 'test-group', credential: 'test' },
    })
    expect(joinResult.joined).toBe(true)

    const leaveResult = await client.request('hub/group/leave', {
      param: { groupID: 'test-group' },
    })
    expect(leaveResult.left).toBe(true)

    await ctx.dispose()
  })

  test('hub/receive rejects second concurrent open for same DID; first stays alive', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    // First receive channel
    const channel1 = bob.createChannel('hub/receive', { param: {} })
    const reader1 = channel1.readable.getReader()
    await delay(50)

    // Second receive channel for same DID -- must reject
    const channel2 = bob.createChannel('hub/receive', { param: {} })
    // Server wraps handler errors as a generic "Handler execution failed"
    // payload (HandlerError.from in packages/server overwrites cause.message).
    // The signal we care about is that channel2 rejects; channel1 staying
    // alive is the substantive correctness check below.
    await expect(channel2).rejects.toThrow()

    // First channel still works: Alice sends, channel1 receives
    const payload = encodePayload('still-alive')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader1.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel1.close()
    await expect(channel1).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/receive: close + immediate reopen on same DID succeeds', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const channel1 = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    channel1.close()
    await expect(channel1).rejects.toEqual('Close')

    // Immediate reopen -- no extra delay. The abort listener in handlers.ts
    // calls clearReceiveWriter synchronously, and `await expect(channel1)
    // .rejects...` yields enough microtasks for it to run before channel2
    // reaches the server.
    const channel2 = bob.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()
    await delay(50)

    const payload = encodePayload('reconnect-ok')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader2.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/receive: close + delayed reopen on same DID succeeds', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const channel1 = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    channel1.close()
    await expect(channel1).rejects.toEqual('Close')
    await delay(100)

    const channel2 = bob.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()
    await delay(50)

    const payload = encodePayload('delayed-ok')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader2.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })
})

describe('Hub teardown produces no unhandled rejections', () => {
  const rejections: Array<unknown> = []
  const onRejection = (reason: unknown) => rejections.push(reason)

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  test('hub/receive channel teardown (original bug repro)', async () => {
    const ctx = createTestHub()
    const { client } = ctx.connect()

    const channel = client.createChannel('hub/receive', { param: { groupIDs: ['g1'] } })
    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await client.dispose()
    await ctx.dispose()

    await new Promise((r) => setTimeout(r, 20))
    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)
  })
})
```

- [ ] **Step 1.2 — Run, expect FAIL.** `pnpm --filter @enkaku/hub-server run test:unit` — expected failures: every test using `connect()` fails with `Access denied` (the current `createHub` passes `accessRules: undefined` to `serve()`, and `checkProcedureAccess` with empty rules denies all procedures); `handlers reject messages without a verified issuer DID` fails because `getClientDID` currently returns `'anonymous'` instead of throwing.

- [ ] **Step 1.3 — Implement.** Replace the entire content of `packages/hub-server/src/hub.ts` with:

```ts
import type { HubProtocol, HubStore } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type { AccessRules, Server } from '@enkaku/server'
import { serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'

import { createHandlers } from './handlers.js'
import { HubClientRegistry } from './registry.js'

/**
 * Default access rules: any authenticated DID may call hub procedures.
 * The hub is a blind relay — per-procedure authorization (group membership,
 * capability validation) happens in the handlers.
 */
export const DEFAULT_HUB_ACCESS_RULES: AccessRules = {
  'hub/*': { allow: true },
}

export type CreateHubParams = {
  transport: ServerTransportOf<HubProtocol>
  store: HubStore
  /**
   * Hub server identity. Required: all hub procedures derive the client DID
   * from the verified `iss` of signed messages.
   */
  identity: Identity
  /** Access rules enforced by the server. Defaults to {@link DEFAULT_HUB_ACCESS_RULES}. */
  accessRules?: AccessRules
}

export type HubInstance = {
  registry: HubClientRegistry
  server: Server<HubProtocol>
}

export function createHub(params: CreateHubParams): HubInstance {
  const registry = new HubClientRegistry()
  const handlers = createHandlers({ registry, store: params.store })
  const server = serve<HubProtocol>({
    handlers,
    transport: params.transport,
    identity: params.identity,
    accessRules: params.accessRules ?? DEFAULT_HUB_ACCESS_RULES,
  })
  return { registry, server }
}
```

In `packages/hub-server/src/handlers.ts`, replace:

```ts
function getClientDID(ctx: { message: { payload: Record<string, unknown> } }): string {
  const payload = ctx.message.payload
  return typeof payload.iss === 'string' ? payload.iss : 'anonymous'
}
```

with:

```ts
function getClientDID(ctx: { message: { payload: Record<string, unknown> } }): string {
  const iss = ctx.message.payload.iss
  if (typeof iss !== 'string' || iss.length === 0) {
    throw new Error('Unauthenticated message: missing verified issuer DID')
  }
  return iss
}
```

Add the `DEFAULT_HUB_ACCESS_RULES` export to `packages/hub-server/src/index.ts` — replace:

```ts
export type { CreateHubParams, HubInstance } from './hub.js'
export { createHub } from './hub.js'
```

with:

```ts
export type { CreateHubParams, HubInstance } from './hub.js'
export { createHub, DEFAULT_HUB_ACCESS_RULES } from './hub.js'
```

- [ ] **Step 1.4 — Update hub-client fixtures.** In `packages/hub-client/test/client.test.ts`, replace lines 25-47 (`createTestHub` and `createTestClient`) with:

```ts
function createTestHub() {
  const store = createMemoryStore()
  const hubIdentity = randomIdentity()
  const transports: HubTransports = new DirectTransports()
  const hub = createHub({
    transport: transports.server,
    store,
    identity: hubIdentity,
  })
  return { hub, hubID: hubIdentity.id, store, transports }
}

function createTestClient(
  testHub: ReturnType<typeof createTestHub>,
  identity = randomIdentity(),
) {
  const transports: HubTransports = new DirectTransports()
  testHub.hub.server.handle(transports.server)
  const rawClient = new Client<HubProtocol>({
    transport: transports.client,
    identity,
    serverID: testHub.hubID,
  })
  const client = new HubClient({ client: rawClient })
  return { client, identity, transports }
}
```

Then update every call site in the same file: each test currently destructures `const { hub } = createTestHub()` and calls `createTestClient(hub)` — change to `const testHub = createTestHub()` and `createTestClient(testHub)` (5 tests: `send to explicit recipients and receive`, `groupSend and receive with group`, `receive with groupIDs filter`, `joinGroup and leaveGroup`, `uploadKeyPackages and fetchKeyPackages`). The `exposes rawClient` test does not use the fixtures and stays unchanged.

- [ ] **Step 1.5 — Build and run, expect PASS.** `pnpm --filter @enkaku/hub-server run build && pnpm --filter @enkaku/hub-server run test && pnpm --filter @enkaku/hub-client run test` — all green. (hub-server must be rebuilt before hub-client tests because hub-client resolves it from `lib/`.)

- [ ] **Step 1.6 — Commit.**
```sh
git add packages/hub-server/src packages/hub-server/test packages/hub-client/test
git commit -m "feat(hub-server)!: require identity in createHub, trust only verified iss" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `hub/group/join` validates `credential` via `validateGroupCapability`

**Files:**
- `packages/hub-protocol/src/protocol.ts:123-143` (`hub/group/join` param)
- `packages/hub-server/src/handlers.ts:174-184` (`hub/group/join` handler) and imports at top
- `packages/hub-server/package.json` (add `@enkaku/group` dependency)
- `packages/hub-client/src/client.ts:68-72` (`joinGroup`)
- `packages/hub-client/package.json` (add `@enkaku/group` devDependency)
- `packages/hub-server/test/hub.test.ts`, `packages/hub-client/test/client.test.ts`

- [ ] **Step 2.1 — Add dependencies.**
```sh
pnpm --filter @enkaku/hub-server add '@enkaku/group@workspace:^'
pnpm --filter @enkaku/hub-client add -D '@enkaku/group@workspace:^'
```

- [ ] **Step 2.2 — Write failing tests.** In `packages/hub-server/test/hub.test.ts`, add to the imports at the top:

```ts
import { createGroupCapability, delegateGroupMembership } from '@enkaku/group'
import { stringifyToken } from '@enkaku/token'
```

(merge `stringifyToken` into the existing `@enkaku/token` import: `import { type OwnIdentity, randomIdentity, stringifyToken } from '@enkaku/token'`). Add this helper below `createTestHub`:

```ts
async function membershipCredential(
  owner: OwnIdentity,
  memberDID: string,
  groupID: string,
): Promise<string> {
  if (owner.id === memberDID) {
    return stringifyToken(await createGroupCapability(owner, groupID))
  }
  return stringifyToken(
    await delegateGroupMembership({
      identity: owner,
      groupID,
      recipientDID: memberDID,
      permission: 'member',
    }),
  )
}
```

Add a new describe block:

```ts
describe('hub/group/join credential validation', () => {
  test('join with a valid owner capability succeeds', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()
    const credential = await membershipCredential(aliceIdentity, aliceIdentity.id, 'chat')

    const result = await alice.request('hub/group/join', {
      param: { groupID: 'chat', credential },
    })
    expect(result.joined).toBe(true)
    expect(ctx.hub.registry.getGroupMembers('chat')).toContain(aliceIdentity.id)

    await ctx.dispose()
  })

  test('join with a delegated membership credential succeeds', async () => {
    const ctx = createTestHub()
    const ownerIdentity = randomIdentity()
    const { client: bob, identity: bobIdentity } = ctx.connect()
    const credential = await membershipCredential(ownerIdentity, bobIdentity.id, 'chat')

    const result = await bob.request('hub/group/join', {
      param: { groupID: 'chat', credential },
    })
    expect(result.joined).toBe(true)

    await ctx.dispose()
  })

  test('join without a valid credential fails', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()

    await expect(
      alice.request('hub/group/join', {
        param: { groupID: 'chat', credential: 'not-a-token' },
      }),
    ).rejects.toThrow()
    expect(ctx.hub.registry.getGroupMembers('chat')).not.toContain(aliceIdentity.id)

    await ctx.dispose()
  })

  test('join with a credential for a different group fails', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()
    const credential = await membershipCredential(aliceIdentity, aliceIdentity.id, 'other-group')

    await expect(
      alice.request('hub/group/join', {
        param: { groupID: 'chat', credential },
      }),
    ).rejects.toThrow()

    await ctx.dispose()
  })

  test('join with a credential issued to a different DID fails', async () => {
    const ctx = createTestHub()
    const ownerIdentity = randomIdentity()
    const strangerDID = randomIdentity().id
    const { client: alice } = ctx.connect()
    // Credential audience is the stranger, not Alice
    const credential = await membershipCredential(ownerIdentity, strangerDID, 'chat')

    await expect(
      alice.request('hub/group/join', {
        param: { groupID: 'chat', credential },
      }),
    ).rejects.toThrow()

    await ctx.dispose()
  })
})
```

Update the two existing tests that join with `credential: 'test'` so they keep passing once validation lands:
- In `hub/group/send fans out to group members`, replace the two join requests with:

```ts
    const credentialAlice = await membershipCredential(aliceIdentity, aliceIdentity.id, 'chat')
    const credentialBob = await membershipCredential(aliceIdentity, bobIdentity.id, 'chat')
    await alice.request('hub/group/join', {
      param: { groupID: 'chat', credential: credentialAlice },
    })
    await bob.request('hub/group/join', {
      param: { groupID: 'chat', credential: credentialBob },
    })
```

  and change its connect destructuring to `const { client: alice, identity: aliceIdentity } = ctx.connect()` and `const { client: bob, identity: bobIdentity } = ctx.connect()`.
- In `group join and leave`, change `const { client } = ctx.connect()` to `const { client, identity } = ctx.connect()` and replace the join request with:

```ts
    const credential = await membershipCredential(identity, identity.id, 'test-group')
    const joinResult = await client.request('hub/group/join', {
      param: { groupID: 'test-group', credential },
    })
```

- [ ] **Step 2.3 — Run, expect FAIL.** `pnpm --filter @enkaku/hub-server run test:unit` — `join without a valid credential fails`, `join with a credential for a different group fails`, and `join with a credential issued to a different DID fails` fail (current handler accepts anything).

- [ ] **Step 2.4 — Implement protocol change.** In `packages/hub-protocol/src/protocol.ts`, replace the `hub/group/join` param schema (lines 126-134) with:

```ts
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string', minLength: 1, maxLength: 128 },
        credential: { type: 'string', minLength: 1, maxLength: 16384 },
        delegationChain: {
          type: 'array',
          items: { type: 'string', maxLength: 16384 },
          maxItems: 10,
        },
      },
      required: ['groupID', 'credential'],
      additionalProperties: false,
    },
```

Build it: `pnpm --filter @enkaku/hub-protocol run build`

- [ ] **Step 2.5 — Implement handler.** In `packages/hub-server/src/handlers.ts`, add imports:

```ts
import { validateGroupCapability } from '@enkaku/group'
import { normalizeDID } from '@enkaku/token'
```

Replace the `hub/group/join` handler with:

```ts
    'hub/group/join': (async (ctx) => {
      const { groupID, credential, delegationChain } = ctx.param
      const clientDID = getClientDID(ctx)
      const token = await validateGroupCapability({
        tokenData: credential,
        groupID,
        delegationChain,
      })
      if (normalizeDID(token.payload.aud) !== normalizeDID(clientDID)) {
        throw new Error('Invalid credential: audience does not match client DID')
      }
      registry.register(clientDID)
      registry.joinGroup(clientDID, groupID)
      if (store != null) {
        const members = registry.getGroupMembers(groupID)
        await store.setGroupMembers(groupID, members)
      }
      return { joined: true }
    }) as RequestHandler<HubProtocol, 'hub/group/join'>,
```

- [ ] **Step 2.6 — Update HubClient.** In `packages/hub-client/src/client.ts`, add after `GroupSendParams`:

```ts
export type JoinGroupParams = {
  groupID: string
  credential: string
  delegationChain?: Array<string>
}
```

Replace the `joinGroup` method with:

```ts
  joinGroup(params: JoinGroupParams): RequestCall<{ joined: boolean }> {
    return this.#client.request('hub/group/join', {
      param: {
        groupID: params.groupID,
        credential: params.credential,
        delegationChain: params.delegationChain,
      },
    })
  }
```

Check `packages/hub-client/src/index.ts` (349 bytes) and add `JoinGroupParams` to the exported types from `./client.js` alongside the existing exports.

- [ ] **Step 2.7 — Update hub-client tests.** In `packages/hub-client/test/client.test.ts`, add imports `import { createGroupCapability, delegateGroupMembership } from '@enkaku/group'` and extend the token import to `import { type OwnIdentity, randomIdentity, stringifyToken } from '@enkaku/token'`. Add the same `membershipCredential` helper as in Step 2.2. Then update the three tests that call `joinGroup`:
- `groupSend and receive with group`: change connect lines to capture identities (`const { client: alice, identity: aliceIdentity, transports: aliceT } = createTestClient(testHub)` and same for bob), then replace the joins with:

```ts
    await alice.joinGroup({
      groupID: 'chat',
      credential: await membershipCredential(aliceIdentity, aliceIdentity.id, 'chat'),
    })
    await bob.joinGroup({
      groupID: 'chat',
      credential: await membershipCredential(aliceIdentity, bobIdentity.id, 'chat'),
    })
```

- `receive with groupIDs filter`: same pattern for the four `joinGroup` calls (`chat` and `work`, alice as owner of both groups):

```ts
    await alice.joinGroup({
      groupID: 'chat',
      credential: await membershipCredential(aliceIdentity, aliceIdentity.id, 'chat'),
    })
    await alice.joinGroup({
      groupID: 'work',
      credential: await membershipCredential(aliceIdentity, aliceIdentity.id, 'work'),
    })
    await bob.joinGroup({
      groupID: 'chat',
      credential: await membershipCredential(aliceIdentity, bobIdentity.id, 'chat'),
    })
    await bob.joinGroup({
      groupID: 'work',
      credential: await membershipCredential(aliceIdentity, bobIdentity.id, 'work'),
    })
```

- `joinGroup and leaveGroup`: change to capture identity and use:

```ts
    const { client, identity, transports } = createTestClient(testHub)
    const result = await client.joinGroup({
      groupID: 'test-group',
      credential: await membershipCredential(identity, identity.id, 'test-group'),
    })
```

- [ ] **Step 2.8 — Run, expect PASS.** `pnpm --filter @enkaku/hub-protocol run test && pnpm --filter @enkaku/hub-server run build && pnpm --filter @enkaku/hub-server run test && pnpm --filter @enkaku/hub-client run test`

- [ ] **Step 2.9 — Commit.**
```sh
git add packages/hub-protocol/src packages/hub-server packages/hub-client pnpm-lock.yaml
git commit -m "feat(hub)!: validate group join credential via validateGroupCapability" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `hub/group/send` checks sender membership

**Files:**
- `packages/hub-server/src/handlers.ts:39-65` (`hub/group/send` handler)
- `packages/hub-server/test/hub.test.ts`

- [ ] **Step 3.1 — Write failing test.** Add to the `hub handlers` describe block in `packages/hub-server/test/hub.test.ts`:

```ts
  test('hub/group/send from a non-member fails', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()
    const { client: mallory } = ctx.connect()

    // Alice creates and joins the group; Mallory does not join
    const credential = await membershipCredential(aliceIdentity, aliceIdentity.id, 'private')
    await alice.request('hub/group/join', {
      param: { groupID: 'private', credential },
    })

    await expect(
      mallory.request('hub/group/send', {
        param: { groupID: 'private', payload: encodePayload('intrusion') },
      }),
    ).rejects.toThrow()

    await ctx.dispose()
  })
```

- [ ] **Step 3.2 — Run, expect FAIL.** `pnpm --filter @enkaku/hub-server run test:unit` — the new test fails: the current handler only rejects when the group has zero members; Mallory's message is stored and fanned out.

- [ ] **Step 3.3 — Implement.** In `packages/hub-server/src/handlers.ts`, in the `hub/group/send` handler, replace:

```ts
      const { groupID, payload } = ctx.param
      const members = registry.getGroupMembers(groupID)
      if (members.length === 0) {
        throw new Error(`Unknown group: ${groupID}`)
      }

      const senderDID = getClientDID(ctx)
```

with:

```ts
      const { groupID, payload } = ctx.param
      const senderDID = getClientDID(ctx)
      const members = registry.getGroupMembers(groupID)
      if (!members.includes(senderDID)) {
        throw new Error(`Sender is not a member of group: ${groupID}`)
      }
```

(The unknown-group case is covered: an unknown group has no members, so the sender is not a member. The existing `hub/group/send fails on unknown group` test keeps passing.)

- [ ] **Step 3.4 — Run, expect PASS.** `pnpm --filter @enkaku/hub-server run test`

- [ ] **Step 3.5 — Commit.**
```sh
git add packages/hub-server
git commit -m "feat(hub-server): require sender membership for hub/group/send" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `hub/keypackage/fetch` — cap `count` and rate-limit per requester

**Files:**
- `packages/hub-server/src/handlers.ts:7-10` (`CreateHandlersParams`), `:165-172` (`hub/keypackage/fetch`)
- `packages/hub-server/src/hub.ts` (`CreateHubParams` passthrough)
- `packages/hub-server/src/index.ts` (exports)
- `packages/hub-server/test/hub.test.ts`

- [ ] **Step 4.1 — Write failing tests.** Add a describe block to `packages/hub-server/test/hub.test.ts`:

```ts
describe('hub/keypackage/fetch limits', () => {
  test('count is capped at maxCount', async () => {
    const ctx = createTestHub({ keyPackageFetchLimits: { maxCount: 3 } })
    const { client, identity } = ctx.connect()

    const keyPackages = Array.from({ length: 10 }, (_, i) => `kp-${i}`)
    await client.request('hub/keypackage/upload', { param: { keyPackages } })

    const fetched = await client.request('hub/keypackage/fetch', {
      param: { did: identity.id, count: 10 },
    })
    expect(fetched.keyPackages).toHaveLength(3)

    await ctx.dispose()
  })

  test('fetch requests are rate-limited per requester DID', async () => {
    const ctx = createTestHub({
      keyPackageFetchLimits: { maxRequests: 2, windowMs: 60_000 },
    })
    const { client, identity } = ctx.connect()

    await client.request('hub/keypackage/fetch', { param: { did: identity.id } })
    await client.request('hub/keypackage/fetch', { param: { did: identity.id } })
    await expect(
      client.request('hub/keypackage/fetch', { param: { did: identity.id } }),
    ).rejects.toThrow()

    // A different requester is not affected
    const { client: other } = ctx.connect()
    const result = await other.request('hub/keypackage/fetch', {
      param: { did: identity.id },
    })
    expect(result.keyPackages).toEqual([])

    await ctx.dispose()
  })
})
```

- [ ] **Step 4.2 — Run, expect FAIL.** `pnpm --filter @enkaku/hub-server run test:types` fails first (`keyPackageFetchLimits` is not in `CreateHubParams`); unit tests would also fail.

- [ ] **Step 4.3 — Implement handlers.** In `packages/hub-server/src/handlers.ts`, replace:

```ts
export type CreateHandlersParams = {
  registry: HubClientRegistry
  store: HubStore
}
```

with:

```ts
export type KeyPackageFetchLimits = {
  /** Maximum number of key packages returned per fetch. Default: 10 */
  maxCount: number
  /** Maximum number of fetch requests per requester DID per window. Default: 30 */
  maxRequests: number
  /** Rate-limit window duration in milliseconds. Default: 60000 (1 min) */
  windowMs: number
}

export const DEFAULT_KEYPACKAGE_FETCH_LIMITS: KeyPackageFetchLimits = {
  maxCount: 10,
  maxRequests: 30,
  windowMs: 60_000,
}

export type CreateHandlersParams = {
  registry: HubClientRegistry
  store: HubStore
  keyPackageFetchLimits?: Partial<KeyPackageFetchLimits>
}
```

In `createHandlers`, after `const { store, registry } = params`, add:

```ts
  const fetchLimits: KeyPackageFetchLimits = {
    ...DEFAULT_KEYPACKAGE_FETCH_LIMITS,
    ...params.keyPackageFetchLimits,
  }
  const fetchWindows = new Map<string, { count: number; resetAt: number }>()

  function assertKeyPackageFetchAllowed(requesterDID: string): void {
    const now = Date.now()
    // Bound memory: sweep expired windows once the map grows large
    if (fetchWindows.size > 1024) {
      for (const [did, window] of fetchWindows) {
        if (window.resetAt <= now) {
          fetchWindows.delete(did)
        }
      }
    }
    const window = fetchWindows.get(requesterDID)
    if (window == null || window.resetAt <= now) {
      fetchWindows.set(requesterDID, { count: 1, resetAt: now + fetchLimits.windowMs })
      return
    }
    if (window.count >= fetchLimits.maxRequests) {
      throw new Error('Key package fetch rate limit exceeded')
    }
    window.count++
  }
```

Replace the `hub/keypackage/fetch` handler with:

```ts
    'hub/keypackage/fetch': (async (ctx) => {
      const requesterDID = getClientDID(ctx)
      assertKeyPackageFetchAllowed(requesterDID)
      const { did, count } = ctx.param
      const cappedCount = Math.min(Math.max(count ?? 1, 1), fetchLimits.maxCount)
      const keyPackages = await store.fetchKeyPackages(did, cappedCount)
      return { keyPackages }
    }) as RequestHandler<HubProtocol, 'hub/keypackage/fetch'>,
```

- [ ] **Step 4.4 — Implement hub passthrough.** In `packages/hub-server/src/hub.ts`:
  - change the handlers import to `import { createHandlers, type KeyPackageFetchLimits } from './handlers.js'`
  - add to `CreateHubParams`:

```ts
  /** Quotas applied to hub/keypackage/fetch. Merged over {@link DEFAULT_KEYPACKAGE_FETCH_LIMITS}. */
  keyPackageFetchLimits?: Partial<KeyPackageFetchLimits>
```

  - change the `createHandlers` call to:

```ts
  const handlers = createHandlers({
    registry,
    store: params.store,
    keyPackageFetchLimits: params.keyPackageFetchLimits,
  })
```

In `packages/hub-server/src/index.ts`, replace:

```ts
export type { CreateHandlersParams } from './handlers.js'
export { createHandlers } from './handlers.js'
```

with:

```ts
export type { CreateHandlersParams, KeyPackageFetchLimits } from './handlers.js'
export { createHandlers, DEFAULT_KEYPACKAGE_FETCH_LIMITS } from './handlers.js'
```

- [ ] **Step 4.5 — Run, expect PASS.** `pnpm --filter @enkaku/hub-server run test`

- [ ] **Step 4.6 — Commit.**
```sh
git add packages/hub-server
git commit -m "feat(hub-server): cap and rate-limit hub/keypackage/fetch" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Protocol schema quotas + enable runtime validation in `createHub`

**Files:**
- `packages/hub-protocol/src/protocol.ts` (all param/send schemas)
- `packages/hub-protocol/test/protocol.test.ts`
- `packages/hub-server/src/hub.ts` (pass `protocol: hubProtocol` to `serve`)
- `packages/hub-server/test/hub.test.ts`

- [ ] **Step 5.1 — Write failing tests.** Add to `packages/hub-protocol/test/protocol.test.ts`:

```ts
  test('schema quotas bound list and string sizes', () => {
    const sendParam = hubProtocol['hub/send'].param
    expect(sendParam.properties.recipients.maxItems).toBe(100)
    expect(sendParam.properties.recipients.items.maxLength).toBe(256)
    expect(sendParam.properties.payload.maxLength).toBe(1048576)

    const groupSendParam = hubProtocol['hub/group/send'].param
    expect(groupSendParam.properties.groupID.maxLength).toBe(128)
    expect(groupSendParam.properties.payload.maxLength).toBe(1048576)

    const receiveParam = hubProtocol['hub/receive'].param
    expect(receiveParam.properties.after.maxLength).toBe(64)
    expect(receiveParam.properties.groupIDs.maxItems).toBe(100)
    expect(receiveParam.properties.groupIDs.items.maxLength).toBe(128)
    const receiveSend = hubProtocol['hub/receive'].send
    expect(receiveSend.properties.ack.maxItems).toBe(1000)
    expect(receiveSend.properties.ack.items.maxLength).toBe(64)

    const uploadParam = hubProtocol['hub/keypackage/upload'].param
    expect(uploadParam.properties.keyPackages.maxItems).toBe(50)
    expect(uploadParam.properties.keyPackages.items.maxLength).toBe(16384)

    const fetchParam = hubProtocol['hub/keypackage/fetch'].param
    expect(fetchParam.properties.did.maxLength).toBe(256)
    expect(fetchParam.properties.count.minimum).toBe(1)
    expect(fetchParam.properties.count.maximum).toBe(10)

    const joinParam = hubProtocol['hub/group/join'].param
    expect(joinParam.properties.groupID.maxLength).toBe(128)
    expect(joinParam.properties.credential.maxLength).toBe(16384)
    expect(joinParam.properties.delegationChain.maxItems).toBe(10)

    const leaveParam = hubProtocol['hub/group/leave'].param
    expect(leaveParam.properties.groupID.maxLength).toBe(128)
  })
```

Add to `packages/hub-server/test/hub.test.ts` (inside the `hub handlers` describe block):

```ts
  test('schema validation drops messages violating quotas and emits invalidMessage', async () => {
    const ctx = createTestHub()
    const { client } = ctx.connect()

    const invalidMessage = new Promise<unknown>((resolve) => {
      ctx.hub.server.events.on('invalidMessage', (event) => resolve(event.error))
    })

    // 101 recipients exceeds maxItems: 100
    const recipients = Array.from({ length: 101 }, (_, i) => `did:test:${i}`)
    const request = client.request('hub/send', {
      param: { recipients, payload: encodePayload('too-many') },
    })
    // The server drops invalid messages without replying (error reply for
    // schema-invalid messages ships in the platform-fixes plan), so the
    // request only settles when the client is disposed.
    request.catch(() => {})

    const error = await invalidMessage
    expect(error).toBeInstanceOf(Error)

    await ctx.dispose()
  })
```

- [ ] **Step 5.2 — Run, expect FAIL.** `pnpm --filter @enkaku/hub-protocol run test:unit` fails (quota fields missing). `pnpm --filter @enkaku/hub-server run test:unit` — the new hub-server test times out / fails (no validator configured, so `invalidMessage` never fires).

- [ ] **Step 5.3 — Implement protocol quotas.** In `packages/hub-protocol/src/protocol.ts`, apply these schema changes (Task 2 already handled `hub/group/join`):
  - `hub/send` param:

```ts
    param: {
      type: 'object',
      properties: {
        recipients: {
          type: 'array',
          items: { type: 'string', maxLength: 256 },
          minItems: 1,
          maxItems: 100,
        },
        payload: { type: 'string', contentEncoding: 'base64', maxLength: 1048576 },
      },
      required: ['recipients', 'payload'],
      additionalProperties: false,
    },
```

  - `hub/group/send` param:

```ts
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string', minLength: 1, maxLength: 128 },
        payload: { type: 'string', contentEncoding: 'base64', maxLength: 1048576 },
      },
      required: ['groupID', 'payload'],
      additionalProperties: false,
    },
```

  - `hub/receive` param and send:

```ts
    param: {
      type: 'object',
      properties: {
        after: { type: 'string', maxLength: 64 },
        groupIDs: {
          type: 'array',
          items: { type: 'string', maxLength: 128 },
          maxItems: 100,
        },
      },
      additionalProperties: false,
    },
    send: {
      type: 'object',
      properties: {
        ack: {
          type: 'array',
          items: { type: 'string', maxLength: 64 },
          maxItems: 1000,
        },
      },
      required: ['ack'],
      additionalProperties: false,
    },
```

  (leave the `receive` schema unchanged — it describes server-emitted messages, which the client-message validator does not check)
  - `hub/keypackage/upload` param:

```ts
    param: {
      type: 'object',
      properties: {
        keyPackages: {
          type: 'array',
          items: { type: 'string', maxLength: 16384 },
          minItems: 1,
          maxItems: 50,
        },
      },
      required: ['keyPackages'],
      additionalProperties: false,
    },
```

  - `hub/keypackage/fetch` param:

```ts
    param: {
      type: 'object',
      properties: {
        did: { type: 'string', minLength: 1, maxLength: 256 },
        count: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['did'],
      additionalProperties: false,
    },
```

  - `hub/group/leave` param:

```ts
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string', minLength: 1, maxLength: 128 },
      },
      required: ['groupID'],
      additionalProperties: false,
    },
```

- [ ] **Step 5.4 — Enable validation in createHub.** In `packages/hub-server/src/hub.ts`, change the hub-protocol import to:

```ts
import { type HubProtocol, type HubStore, hubProtocol } from '@enkaku/hub-protocol'
```

and add `protocol: hubProtocol,` to the `serve<HubProtocol>({ ... })` call (alongside `handlers`).

- [ ] **Step 5.5 — Run, expect PASS.** `pnpm --filter @enkaku/hub-protocol run build && pnpm --filter @enkaku/hub-protocol run test && pnpm --filter @enkaku/hub-server run build && pnpm --filter @enkaku/hub-server run test && pnpm --filter @enkaku/hub-client run test`

- [ ] **Step 5.6 — Commit.**
```sh
git add packages/hub-protocol packages/hub-server
git commit -m "feat(hub-protocol): schema quotas + enable runtime validation in createHub" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Lifecycle — drain-failure recovery, idle unregister, scheduled purge

**Files:**
- `packages/hub-server/src/handlers.ts:67-156` (`hub/receive`), `:186-195` (`hub/group/leave`)
- `packages/hub-server/src/registry.ts` (add `unregisterIfIdle`)
- `packages/hub-server/src/hub.ts` (purge scheduling)
- `packages/hub-server/test/hub.test.ts`, `packages/hub-server/test/registry.test.ts`

- [ ] **Step 6.1 — Write failing tests.** Add a describe block to `packages/hub-server/test/hub.test.ts`:

```ts
describe('hub lifecycle', () => {
  test('receive drain failure releases the writer binding (lockout recovery)', async () => {
    const baseStore = createMemoryStore()
    let failNextFetch = true
    const store: HubStore = {
      ...baseStore,
      fetch: async (params) => {
        if (failNextFetch) {
          failNextFetch = false
          throw new Error('store offline')
        }
        return await baseStore.fetch(params)
      },
    }
    const ctx = createTestHub({ store })
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    // First open fails during drain (store.fetch throws)
    const channel1 = bob.createChannel('hub/receive', { param: {} })
    await expect(channel1).rejects.toThrow()
    await delay(50)

    // Without cleanup the writer stays bound forever and every reopen fails.
    const channel2 = bob.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()
    await delay(50)

    const payload = encodePayload('recovered')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader2.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('closing a receive channel unregisters clients with no group memberships', async () => {
    const ctx = createTestHub()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const channel = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    expect(ctx.hub.registry.getClient(bobIdentity.id)).toBeDefined()

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    expect(ctx.hub.registry.getClient(bobIdentity.id)).toBeUndefined()

    await ctx.dispose()
  })

  test('group members stay registered after their receive channel closes', async () => {
    const ctx = createTestHub()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const credential = await membershipCredential(bobIdentity, bobIdentity.id, 'sticky')
    await bob.request('hub/group/join', {
      param: { groupID: 'sticky', credential },
    })
    const channel = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)

    // Offline group members must keep receiving group fan-out via the store
    expect(ctx.hub.registry.getGroupMembers('sticky')).toContain(bobIdentity.id)

    await ctx.dispose()
  })

  test('scheduled purge evicts expired stored messages', async () => {
    const store = createMemoryStore()
    const ctx = createTestHub({ store, purge: { interval: 50, olderThan: 0 } })
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()

    const purged = new Promise<Array<string>>((resolve) => {
      store.events.on('purge', (event) => resolve(event.sequenceIDs))
    })

    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('expiring') },
    })

    const sequenceIDs = await purged
    expect(sequenceIDs).toHaveLength(1)
    const result = await store.fetch({ recipientDID: bobIdentity.id })
    expect(result.messages).toHaveLength(0)

    await ctx.dispose()
  })
})
```

Add to `packages/hub-server/test/registry.test.ts` (inside the existing top-level describe, matching the file's existing import of `HubClientRegistry`):

```ts
  test('unregisterIfIdle removes entries with no writer and no groups', () => {
    const registry = new HubClientRegistry()
    registry.register('did:test:idle')
    registry.unregisterIfIdle('did:test:idle')
    expect(registry.getClient('did:test:idle')).toBeUndefined()
  })

  test('unregisterIfIdle keeps entries with group memberships', () => {
    const registry = new HubClientRegistry()
    registry.register('did:test:member')
    registry.joinGroup('did:test:member', 'g1')
    registry.unregisterIfIdle('did:test:member')
    expect(registry.getClient('did:test:member')).toBeDefined()
  })

  test('unregisterIfIdle keeps entries with a bound writer', () => {
    const registry = new HubClientRegistry()
    registry.register('did:test:online')
    registry.setReceiveWriter('did:test:online', () => {})
    registry.unregisterIfIdle('did:test:online')
    expect(registry.getClient('did:test:online')).toBeDefined()
  })
```

- [ ] **Step 6.2 — Run, expect FAIL.** `pnpm --filter @enkaku/hub-server run test:unit` — `unregisterIfIdle` tests fail to compile/run (method missing), lockout-recovery test fails (`receive writer already bound` on reopen), idle-unregister test fails (entry still present), purge test times out (`purge` never scheduled; `purge` is also not a valid `CreateHubParams` key so `test:types` fails too).

- [ ] **Step 6.3 — Implement registry.** In `packages/hub-server/src/registry.ts`, add after `unregister`:

```ts
  /**
   * Removes the entry only when it is idle: no bound receive writer and no
   * group memberships. Group members must stay registered while offline so
   * hub/group/send keeps routing to them through the store.
   */
  unregisterIfIdle(did: string): void {
    const entry = this.#clients.get(did)
    if (entry != null && entry.sendMessage == null && entry.groups.size === 0) {
      this.#clients.delete(did)
    }
  }
```

- [ ] **Step 6.4 — Implement handlers.** In `packages/hub-server/src/handlers.ts`, restructure the `hub/receive` handler: wrap the writer-bind and drain sections in try/catch, and add idle unregistration to the abort listener. The handler body between `const reader = ctx.readable.getReader()` and the ack-reading IIFE becomes:

```ts
      try {
        // Set up message delivery callback with optional group filter
        registry.setReceiveWriter(clientDID, (message: StoredMessage) => {
          // Apply group filter: direct messages always pass, group messages only if in filter
          if (groupIDs != null && groupIDs.length > 0) {
            if (message.groupID != null && !groupIDs.includes(message.groupID)) {
              return
            }
          }
          writer
            .write({
              sequenceID: message.sequenceID,
              senderDID: message.senderDID,
              groupID: message.groupID,
              payload: toB64(message.payload),
            })
            .catch(() => {})
        })

        // Drain queued messages from store
        if (store != null) {
          let cursor: string | null | undefined = after
          while (true) {
            const result = await store.fetch({
              recipientDID: clientDID,
              after: cursor ?? undefined,
              limit: 50,
            })
            for (const msg of result.messages) {
              // Apply group filter
              if (groupIDs != null && groupIDs.length > 0) {
                if (msg.groupID != null && !groupIDs.includes(msg.groupID)) {
                  continue
                }
              }
              await writer.write({
                sequenceID: msg.sequenceID,
                senderDID: msg.senderDID,
                groupID: msg.groupID,
                payload: toB64(msg.payload),
              })
            }
            cursor = result.cursor
            if (!result.hasMore) break
          }
        }
      } catch (error) {
        // Bind/drain failure: release the writer binding so the client can
        // reconnect instead of being locked out permanently.
        registry.clearReceiveWriter(clientDID)
        registry.unregisterIfIdle(clientDID)
        reader.cancel().catch(() => {})
        writer.abort(error).catch(() => {})
        throw error
      }
```

and the abort listener at the end of the handler becomes:

```ts
      // Keep channel open until aborted
      return new Promise((resolve) => {
        ctx.signal.addEventListener(
          'abort',
          () => {
            registry.clearReceiveWriter(clientDID)
            registry.unregisterIfIdle(clientDID)
            reader.cancel().catch(() => {})
            writer.close().catch(() => {})
            resolve(undefined as never)
          },
          { once: true },
        )
      })
```

In the `hub/group/leave` handler, add `registry.unregisterIfIdle(clientDID)` immediately after the `if (store != null) { ... }` block (before `return { left: true }`).

- [ ] **Step 6.5 — Implement purge scheduling.** In `packages/hub-server/src/hub.ts`, add the type:

```ts
export type HubPurgeOptions = {
  /** Interval between purge runs in milliseconds. Default: 3600000 (1 hour) */
  interval?: number
  /** Age in seconds after which unacked stored messages are purged. Default: 604800 (7 days) */
  olderThan?: number
}
```

add to `CreateHubParams`:

```ts
  /** Scheduled purge of expired stored messages. Set to `false` to disable. */
  purge?: HubPurgeOptions | false
```

and in `createHub`, after the `serve()` call and before `return`:

```ts
  if (params.purge !== false) {
    const interval = params.purge?.interval ?? 3_600_000
    const olderThan = params.purge?.olderThan ?? 604_800
    const purgeTimer = setInterval(() => {
      params.store.purge({ olderThan }).catch(() => {
        // Purge failures are non-fatal; retried on the next interval
      })
    }, interval)
    server.disposed.then(() => clearInterval(purgeTimer))
  }
```

Export `HubPurgeOptions` from `packages/hub-server/src/index.ts`: change the hub exports line to `export type { CreateHubParams, HubInstance, HubPurgeOptions } from './hub.js'`.

- [ ] **Step 6.6 — Run, expect PASS.** `pnpm --filter @enkaku/hub-server run build && pnpm --filter @enkaku/hub-server run test && pnpm --filter @enkaku/hub-client run test`

- [ ] **Step 6.7 — Commit.**
```sh
git add packages/hub-server
git commit -m "fix(hub-server): receive lockout recovery, idle unregister, scheduled purge" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Server `longLivedProcedures` limit + hub wiring (`limits` in `CreateHubParams`)

**Files:**
- `packages/server/src/limits.ts` (whole file, 84 lines)
- `packages/server/src/server.ts:179-264` (`processHandler`)
- `packages/server/test/limits.test.ts`
- `packages/server/test/long-lived-procedures.test.ts` (new)
- `packages/hub-server/src/hub.ts`
- `packages/hub-server/test/hub.test.ts`

- [ ] **Step 7.1 — Write failing limiter tests.** Add to `packages/server/test/limits.test.ts`:

```ts
describe('ResourceLimiter long-lived handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('DEFAULT_RESOURCE_LIMITS includes empty longLivedProcedures', () => {
    expect(DEFAULT_RESOURCE_LIMITS.longLivedProcedures).toEqual([])
  })

  test('long-lived acquire bypasses maxConcurrentHandlers and is counted separately', () => {
    const limiter = createResourceLimiter({ maxConcurrentHandlers: 1 })
    expect(limiter.acquireHandler()).toBe(true)
    expect(limiter.acquireHandler(true)).toBe(true)
    expect(limiter.acquireHandler(true)).toBe(true)
    expect(limiter.activeHandlers).toBe(1)
    expect(limiter.activeLongLivedHandlers).toBe(2)
    expect(limiter.acquireHandler()).toBe(false)
    limiter.releaseHandler(true)
    expect(limiter.activeLongLivedHandlers).toBe(1)
    limiter.releaseHandler()
    expect(limiter.activeHandlers).toBe(0)
  })

  test('releaseHandler(true) does not go negative', () => {
    const limiter = createResourceLimiter()
    limiter.releaseHandler(true)
    expect(limiter.activeLongLivedHandlers).toBe(0)
  })

  test('long-lived controllers never expire', () => {
    const limiter = createResourceLimiter({ controllerTimeoutMs: 1000 })
    limiter.addController('short')
    limiter.addController('long', true)
    vi.advanceTimersByTime(2000)
    expect(limiter.getExpiredControllers()).toEqual(['short'])
  })
})
```

- [ ] **Step 7.2 — Write failing server integration tests.** Create `packages/server/test/long-lived-procedures.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  hold: {
    type: 'channel',
    param: { type: 'object', properties: {}, additionalProperties: false },
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
  ping: {
    type: 'request',
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

type TestTransports = DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>

function createHoldHandlers(holdSignals: Array<AbortSignal>): ProcedureHandlers<Protocol> {
  return {
    hold: (ctx) =>
      new Promise<string>((resolve) => {
        holdSignals.push(ctx.signal)
        ctx.signal.addEventListener('abort', () => resolve('done'))
      }),
    ping: () => 'pong',
  } as unknown as ProcedureHandlers<Protocol>
}

describe('longLivedProcedures resource limits', () => {
  test('long-lived channels are exempt from controllerTimeoutMs', async () => {
    const holdSignals: Array<AbortSignal> = []
    const transports: TestTransports = new DirectTransports()
    const timeoutHandler = vi.fn()
    const server = serve<Protocol>({
      handlers: createHoldHandlers(holdSignals),
      transport: transports.server,
      limits: { controllerTimeoutMs: 50, longLivedProcedures: ['hold'] },
    })
    server.events.on('handlerTimeout', timeoutHandler)

    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'hold',
        rid: 'c1',
        prm: {},
      }) as AnyClientMessageOf<Protocol>,
    )
    // Cleanup interval runs every min(controllerTimeoutMs, 10000) = 50ms
    await new Promise((resolve) => setTimeout(resolve, 250))

    expect(timeoutHandler).not.toHaveBeenCalled()
    expect(holdSignals).toHaveLength(1)
    expect(holdSignals[0].aborted).toBe(false)

    await server.dispose()
    await transports.dispose()
  })

  test('long-lived channels do not consume maxConcurrentHandlers slots', async () => {
    const holdSignals: Array<AbortSignal> = []
    const transports: TestTransports = new DirectTransports()
    const errorCodes: Array<string> = []
    const server = serve<Protocol>({
      handlers: createHoldHandlers(holdSignals),
      transport: transports.server,
      limits: { maxConcurrentHandlers: 1, longLivedProcedures: ['hold'] },
    })
    server.events.on('handlerError', (event) => {
      errorCodes.push(event.error.code)
    })

    // Two concurrent long-lived channels with maxConcurrentHandlers: 1
    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'hold',
        rid: 'c1',
        prm: {},
      }) as AnyClientMessageOf<Protocol>,
    )
    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'hold',
        rid: 'c2',
        prm: {},
      }) as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(holdSignals).toHaveLength(2)

    // A regular request still has its full handler budget available
    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        prc: 'ping',
        rid: 'r1',
      }) as AnyClientMessageOf<Protocol>,
    )
    let result: unknown
    while (true) {
      const next = await transports.client.read()
      if (next.done) break
      const payload = (next.value as { payload: { typ: string; rid?: string; val?: unknown } })
        .payload
      if (payload.typ === 'result' && payload.rid === 'r1') {
        result = payload.val
        break
      }
    }
    expect(result).toBe('pong')
    expect(errorCodes).not.toContain('EK04')

    await server.dispose()
    await transports.dispose()
  })
})
```

- [ ] **Step 7.3 — Run, expect FAIL.** `pnpm --filter @enkaku/server run test:unit` — limiter tests fail (`longLivedProcedures`, `activeLongLivedHandlers`, `acquireHandler(true)` do not exist); integration tests fail (`handlerTimeout` fires at 50ms; second `hold` channel hits EK04).

- [ ] **Step 7.4 — Implement limits.ts.** Replace the entire content of `packages/server/src/limits.ts` with:

```ts
export type ResourceLimits = {
  /** Maximum number of concurrent controllers (in-flight requests). Default: 10000 */
  maxControllers: number
  /** Maximum number of concurrent handler executions. Default: 100 */
  maxConcurrentHandlers: number
  /** Controller timeout in milliseconds. Default: 300000 (5 min) */
  controllerTimeoutMs: number
  /** Cleanup timeout in milliseconds when disposing. Default: 30000 (30 sec) */
  cleanupTimeoutMs: number
  /** Maximum size in bytes for any individual message payload. Default: 10485760 (10 MB) */
  maxMessageSize: number
  /**
   * Procedures treated as long-lived: exempt from controllerTimeoutMs and
   * counted separately from maxConcurrentHandlers (bounded by maxControllers).
   * Default: []
   */
  longLivedProcedures: Array<string>
}

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxControllers: 10000,
  maxConcurrentHandlers: 100,
  controllerTimeoutMs: 300000,
  cleanupTimeoutMs: 30000,
  maxMessageSize: 10485760,
  longLivedProcedures: [],
}

export type ResourceLimiter = {
  limits: ResourceLimits
  controllerCount: number
  activeHandlers: number
  activeLongLivedHandlers: number
  canAddController: () => boolean
  addController: (rid: string, longLived?: boolean) => void
  removeController: (rid: string) => void
  getExpiredControllers: () => Array<string>
  acquireHandler: (longLived?: boolean) => boolean
  releaseHandler: (longLived?: boolean) => void
}

type ControllerRecord = {
  timestamp: number
  longLived: boolean
}

export function createResourceLimiter(options?: Partial<ResourceLimits>): ResourceLimiter {
  const limits: ResourceLimits = {
    ...DEFAULT_RESOURCE_LIMITS,
    ...options,
  }

  const controllers = new Map<string, ControllerRecord>()
  let handlerCount = 0
  let longLivedHandlerCount = 0

  return {
    limits,
    get controllerCount() {
      return controllers.size
    },
    get activeHandlers() {
      return handlerCount
    },
    get activeLongLivedHandlers() {
      return longLivedHandlerCount
    },
    canAddController() {
      return controllers.size < limits.maxControllers
    },
    addController(rid: string, longLived = false) {
      controllers.set(rid, { timestamp: Date.now(), longLived })
    },
    removeController(rid: string) {
      controllers.delete(rid)
    },
    getExpiredControllers() {
      const now = Date.now()
      const expired: Array<string> = []
      for (const [rid, record] of controllers) {
        if (!record.longLived && now - record.timestamp > limits.controllerTimeoutMs) {
          expired.push(rid)
        }
      }
      return expired
    },
    acquireHandler(longLived = false) {
      if (longLived) {
        // Long-lived handlers (e.g. persistent channels) bypass the
        // concurrency cap; they remain bounded by maxControllers.
        longLivedHandlerCount++
        return true
      }
      if (handlerCount >= limits.maxConcurrentHandlers) {
        return false
      }
      handlerCount++
      return true
    },
    releaseHandler(longLived = false) {
      if (longLived) {
        if (longLivedHandlerCount > 0) {
          longLivedHandlerCount--
        }
        return
      }
      if (handlerCount > 0) {
        handlerCount--
      }
    },
  }
}
```

- [ ] **Step 7.5 — Implement server.ts.** In `packages/server/src/server.ts`, inside `processHandler` (line 179):
  - After the `const rid = ...` statement, add:

```ts
    const procedure = (message.payload as Record<string, unknown>).prc as string | undefined
    const longLived =
      procedure != null && limiter.limits.longLivedProcedures.includes(procedure)
```

  - Replace the handler-concurrency fast path condition `if (limiter.activeHandlers >= limiter.limits.maxConcurrentHandlers) {` with `if (!longLived && limiter.activeHandlers >= limiter.limits.maxConcurrentHandlers) {`.
  - Replace `limiter.addController(rid)` / `limiter.acquireHandler()` (lines 212-213) with `limiter.addController(rid, longLived)` / `limiter.acquireHandler(longLived)`.
  - Replace the three `limiter.releaseHandler()` calls inside `processHandler` (synchronous error branch at line 224, the `.then` branch at line 242, the `.catch` branch at line 253) with `limiter.releaseHandler(longLived)`.
  - Do **not** change the `limiter.releaseHandler()` call in the cleanup interval (line 128) — long-lived rids never appear in `getExpiredControllers()`, so that path only ever releases regular handlers. Add a comment above it:

```ts
          // Only non-long-lived controllers expire (getExpiredControllers skips
          // long-lived entries), so the default releaseHandler() is correct here.
```

- [ ] **Step 7.6 — Run server tests, expect PASS.** `pnpm --filter @enkaku/server run test` — all server tests green, including the pre-existing `limits.test.ts` defaults test (`toEqual` now includes `longLivedProcedures: []`).

- [ ] **Step 7.7 — Write failing hub tests.** Add a describe block to `packages/hub-server/test/hub.test.ts`:

```ts
describe('hub server limits', () => {
  test('hub/receive channels outlive controllerTimeoutMs', async () => {
    const ctx = createTestHub({ limits: { controllerTimeoutMs: 100 } })
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    // Wait past the timeout (cleanup interval = min(100, 10000) = 100ms)
    await delay(300)

    const payload = encodePayload('survives-timeout')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/receive channels are not bounded by maxConcurrentHandlers', async () => {
    const ctx = createTestHub({ limits: { maxConcurrentHandlers: 2 } })
    const receivers = Array.from({ length: 5 }, () => ctx.connect())
    const channels = receivers.map(({ client }) =>
      client.createChannel('hub/receive', { param: {} }),
    )
    const readers = channels.map((channel) => channel.readable.getReader())
    await delay(100)

    for (const { identity } of receivers) {
      expect(ctx.hub.registry.isOnline(identity.id)).toBe(true)
    }

    // Regular requests still work with all channels held open
    const { client: alice } = ctx.connect()
    const payload = encodePayload('to-first')
    await alice.request('hub/send', {
      param: { recipients: [receivers[0].identity.id], payload },
    })
    const msg = await readers[0].read()
    expect(msg.value?.payload).toBe(payload)

    for (const channel of channels) {
      channel.close()
    }
    await Promise.all(channels.map((channel) => expect(channel).rejects.toEqual('Close')))
    await delay(50)
    await ctx.dispose()
  })

  test('more than 100 receive channels can be open concurrently', { timeout: 30_000 }, async () => {
    const ctx = createTestHub()
    const receivers = Array.from({ length: 105 }, () => ctx.connect())
    const channels = receivers.map(({ client }) =>
      client.createChannel('hub/receive', { param: {} }),
    )
    await delay(500)

    const online = receivers.filter(({ identity }) => ctx.hub.registry.isOnline(identity.id))
    expect(online).toHaveLength(105)

    for (const channel of channels) {
      channel.close()
    }
    await Promise.all(channels.map((channel) => expect(channel).rejects.toEqual('Close')))
    await delay(100)
    await ctx.dispose()
  })
})
```

- [ ] **Step 7.8 — Run, expect FAIL.** `pnpm --filter @enkaku/server run build && pnpm --filter @enkaku/hub-server run test:types` fails (`limits` is not in `CreateHubParams`); with the type added but no wiring, the unit tests fail: the timeout test loses the channel after 100ms, and the 105-receiver test gets EK04 errors past receiver 100.

- [ ] **Step 7.9 — Implement hub wiring.** In `packages/hub-server/src/hub.ts`:
  - extend the server import: `import type { AccessRules, ResourceLimits, Server } from '@enkaku/server'`
  - add to `CreateHubParams`:

```ts
  /**
   * Server resource limits. `hub/receive` is always added to
   * `longLivedProcedures` so open mailbox channels are exempt from
   * `controllerTimeoutMs` and from the `maxConcurrentHandlers` cap.
   */
  limits?: Partial<ResourceLimits>
```

  - in `createHub`, before the `serve()` call, add:

```ts
  const limits: Partial<ResourceLimits> = {
    ...params.limits,
    longLivedProcedures: [
      ...new Set([...(params.limits?.longLivedProcedures ?? []), 'hub/receive']),
    ],
  }
```

  and pass `limits,` to the `serve<HubProtocol>({ ... })` call.

- [ ] **Step 7.10 — Run, expect PASS.** `pnpm --filter @enkaku/server run build && pnpm --filter @enkaku/hub-server run build && pnpm --filter @enkaku/hub-server run test && pnpm --filter @enkaku/hub-client run test && pnpm --filter @enkaku/server run test`

- [ ] **Step 7.11 — Commit.**
```sh
git add packages/server packages/hub-server
git commit -m "feat(server): longLivedProcedures limits; exempt hub/receive channels" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Final verification

- [ ] Run the full affected-package suites: `pnpm --filter @enkaku/server run test && pnpm --filter @enkaku/hub-protocol run test && pnpm --filter @enkaku/hub-server run test && pnpm --filter @enkaku/hub-client run test`
- [ ] Run the repo build to catch downstream type breaks (Kubun/Mokei are external and updated separately, but in-repo consumers must compile): `pnpm run build`
- [ ] Lint: `rtk proxy pnpm run lint`
- [ ] Full test run: `pnpm run test`
- [ ] Confirm zero unhandled rejections in the hub teardown test output.

### Breaking changes shipped (downstream consumers: Kubun, Mokei)

1. `createHub` requires `identity` (and clients must pass `serverID` + `identity` — unsigned hub clients are rejected).
2. `HubClient.joinGroup(groupID, credential?)` → `joinGroup({ groupID, credential, delegationChain? })` with a mandatory, validated capability credential.
3. `hub/group/send` requires the sender to have joined the group on the hub.
4. Protocol schemas now enforce quotas (runtime validation enabled): oversized messages are dropped (client-visible error reply ships with the platform-fixes plan).
