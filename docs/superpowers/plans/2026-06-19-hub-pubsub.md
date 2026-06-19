# Hub Pub/Sub (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Enkaku hub into a blind capability-gated pub/sub broker over opaque topic IDs, removing all group/recipients awareness, and re-base `@enkaku/hub-tunnel` onto the new pub/sub API.

**Architecture:** `hub-protocol` exposes `publish` / `subscribe` / `unsubscribe` over opaque `topicID`s plus a reworked `receive` channel that drains a subscriber's delivery stream across all its subscribed topics. `hub-server` keeps the existing single-copy-message + per-subscriber-delivery-index + refcount-GC store engine, swapping the recipients-from-params model for a subscription table; adds a consumer-supplied `authorize` predicate and per-DID / per-topic token-bucket rate limiting. `hub-tunnel`'s `HubLike` seam is re-based onto `publish` / `subscribe` and made topic-agnostic (a caller-supplied send-topic + receive-topic pair). Bootstrap (`keypackage/upload` + `keypackage/fetch`) is retained verbatim.

**Tech Stack:** TypeScript (strict, `nodenext`), `@enkaku/server` / `@enkaku/client` / `@enkaku/protocol` / `@enkaku/transport`, swc build + `tsc` types, vitest, pnpm workspace.

## Global Constraints

Every task's requirements implicitly include this section.

- Use `type`, never `interface`. Use `Array<T>`, never `T[]`. Never use `any` (use `unknown`, `Record<string, unknown>`, or a specific type).
- Casing: `ID`, `HTTP`, `JWT`, `DID` (not `Id`/`Http`/`Jwt`/`Did`).
- Use `pnpm` / `pnpx`, never `npm` / `npx`. Use `.js` import suffixes on relative imports. Each package's `tsconfig.json` extends `../../tsconfig.build.json`.
- Lint via `rtk proxy pnpm run lint` (NOT bare `pnpm run lint`).
- **Single breaking release** — old procedures are REMOVED, not deprecated. No back-compat shims.
- **Hub stays blind:** it routes on the opaque `topicID` only; `topicID` is always required; the payload is opaque ciphertext the hub never interprets. No `groupID`, no recipients, no membership.
- **authorize hook:** `authorize(did, action: 'publish' | 'subscribe', topicID) => boolean | Promise<boolean>`. Default = allow any authenticated DID. There is no per-topic ACL; the `topicID` is passed so the same hook can feed rate-limit accounting.
- **Rate limiting (both tunable):** `perDID` default `{ rate: 20, burst: 50 }`; `perTopic` default `{ rate: 100, burst: 200 }`.
- **Retention:** per-topic `maxDepth` default `1000` (trim oldest on publish); time-based expiry continues via the existing scheduled `purge`; a zero-subscriber topic drops its messages immediately.
- **Breaking window (Tasks 1–7) requires `git commit --no-verify`.** The repo's pre-commit hook type-checks all ~46 packages. The moment Task 1 lands the renamed `hub-protocol` types, `@enkaku/hub-tunnel` (and, until Task 5, `@enkaku/hub-server`) no longer compile against them — so the hook will FAIL on every intermediate commit. Therefore Tasks 1–7 commit with `git commit --no-verify` (the commit commands below omit it for readability — add it). **Task 8's final commit runs the hook normally (verified)** and closes the window: by then all three packages compile and the whole workspace is green again. Land the entire Task 1→8 sequence before pushing; never push a mid-window commit.
- Per-package commands: `pnpm --filter <pkg> run test` (runs `tsc --noEmit -p tsconfig.test.json` then `vitest run`). Build = `pnpm --filter <pkg> run build`.

> **Sequencing note for the controller:** Run **per-package** tests at each task gate (the task names the package) — never a repo-wide `tsc` until Task 8, where it is finally green. Each task's `vitest`-only step verifies its own deliverable; the cross-package green gate is Task 8 Step 6. If you cannot use `--no-verify` (policy), do all eight tasks then make a single verified commit at the end — but that forfeits the per-task review packages, so prefer `--no-verify` per task.

---

### Task 1: hub-protocol — pub/sub procedures + store types

**Files:**
- Modify: `packages/hub-protocol/src/protocol.ts`
- Modify: `packages/hub-protocol/src/types.ts`
- Modify: `packages/hub-protocol/src/index.ts`
- Test: `packages/hub-protocol/test/protocol.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2, 3, 5, 6, 7, 8):
  - `hubProtocol` with procedures `hub/publish`, `hub/subscribe`, `hub/unsubscribe`, `hub/receive`, `hub/keypackage/upload`, `hub/keypackage/fetch`.
  - `type StoredMessage = { sequenceID: string; senderDID: string; topicID: string; payload: Uint8Array }`
  - `type PublishParams = { senderDID: string; topicID: string; payload: Uint8Array }`
  - `type HubStore` with `publish(params: PublishParams): Promise<string>`, `fetch`, `ack`, `purge`, `subscribe(subscriberDID: string, topicID: string): Promise<void>`, `unsubscribe(subscriberDID: string, topicID: string): Promise<void>`, `getSubscribers(topicID: string): Promise<Array<string>>`, `storeKeyPackage`, `fetchKeyPackages`, `events`.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `packages/hub-protocol/test/protocol.test.ts` with:

```typescript
import { describe, expect, test } from 'vitest'

import { hubProtocol } from '../src/protocol.js'

describe('hubProtocol', () => {
  test('defines the pub/sub + bootstrap procedures', () => {
    expect(Object.keys(hubProtocol).sort()).toEqual(
      [
        'hub/keypackage/fetch',
        'hub/keypackage/upload',
        'hub/publish',
        'hub/receive',
        'hub/subscribe',
        'hub/unsubscribe',
      ].sort(),
    )
  })

  test('removes the legacy group/recipients procedures', () => {
    expect(hubProtocol).not.toHaveProperty('hub/send')
    expect(hubProtocol).not.toHaveProperty('hub/group/send')
    expect(hubProtocol).not.toHaveProperty('hub/group/join')
    expect(hubProtocol).not.toHaveProperty('hub/group/leave')
  })

  test('hub/publish is a request keyed by topicID', () => {
    const publish = hubProtocol['hub/publish']
    expect(publish.type).toBe('request')
    expect(publish.param.required).toEqual(['topicID', 'payload'])
  })

  test('hub/subscribe and hub/unsubscribe are topicID requests', () => {
    expect(hubProtocol['hub/subscribe'].type).toBe('request')
    expect(hubProtocol['hub/subscribe'].param.required).toEqual(['topicID'])
    expect(hubProtocol['hub/unsubscribe'].type).toBe('request')
    expect(hubProtocol['hub/unsubscribe'].param.required).toEqual(['topicID'])
  })

  test('hub/receive carries topicID and not groupID', () => {
    const receive = hubProtocol['hub/receive']
    expect(receive.type).toBe('channel')
    expect(receive.receive.required).toEqual(['sequenceID', 'senderDID', 'topicID', 'payload'])
    expect(receive.receive.properties).not.toHaveProperty('groupID')
    expect(receive.param.properties).not.toHaveProperty('groupIDs')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/hub-protocol exec vitest run test/protocol.test.ts`
Expected: FAIL (procedures `hub/publish` etc. do not exist; `hub/send` still present).

- [ ] **Step 3: Rewrite `protocol.ts`**

Replace the entire contents of `packages/hub-protocol/src/protocol.ts` with:

```typescript
import type { ProtocolDefinition } from '@enkaku/protocol'

export const hubProtocol = {
  'hub/publish': {
    type: 'request',
    description: 'Publish an opaque message to a topic; fans out to current subscribers',
    param: {
      type: 'object',
      properties: {
        topicID: { type: 'string', minLength: 1, maxLength: 256 },
        payload: { type: 'string', contentEncoding: 'base64', maxLength: 1048576 },
      },
      required: ['topicID', 'payload'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        sequenceID: { type: 'string' },
      },
      required: ['sequenceID'],
      additionalProperties: false,
    },
  },
  'hub/subscribe': {
    type: 'request',
    description: 'Subscribe to a topic, creating a durable inbox for the caller',
    param: {
      type: 'object',
      properties: {
        topicID: { type: 'string', minLength: 1, maxLength: 256 },
      },
      required: ['topicID'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        subscribed: { type: 'boolean' },
      },
      required: ['subscribed'],
      additionalProperties: false,
    },
  },
  'hub/unsubscribe': {
    type: 'request',
    description: "Unsubscribe from a topic, dropping the caller's inbox for it",
    param: {
      type: 'object',
      properties: {
        topicID: { type: 'string', minLength: 1, maxLength: 256 },
      },
      required: ['topicID'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        unsubscribed: { type: 'boolean' },
      },
      required: ['unsubscribed'],
      additionalProperties: false,
    },
  },
  'hub/receive': {
    type: 'channel',
    description:
      'Bidirectional mailbox channel — hub pushes messages across all subscribed topics, device pushes acks',
    param: {
      type: 'object',
      properties: {
        after: { type: 'string', maxLength: 64 },
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
    receive: {
      type: 'object',
      properties: {
        sequenceID: { type: 'string' },
        senderDID: { type: 'string' },
        topicID: { type: 'string' },
        payload: { type: 'string', contentEncoding: 'base64' },
      },
      required: ['sequenceID', 'senderDID', 'topicID', 'payload'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  'hub/keypackage/upload': {
    type: 'request',
    description: 'Upload key packages for later retrieval',
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
    result: {
      type: 'object',
      properties: {
        stored: { type: 'integer' },
      },
      required: ['stored'],
      additionalProperties: false,
    },
  },
  'hub/keypackage/fetch': {
    type: 'request',
    description: 'Fetch and consume key packages for a DID',
    param: {
      type: 'object',
      properties: {
        did: { type: 'string', minLength: 1, maxLength: 256 },
        count: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['did'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        keyPackages: { type: 'array', items: { type: 'string' } },
      },
      required: ['keyPackages'],
      additionalProperties: false,
    },
  },
} as const satisfies ProtocolDefinition

export type HubProtocol = typeof hubProtocol
```

- [ ] **Step 4: Rewrite `types.ts`**

Replace the entire contents of `packages/hub-protocol/src/types.ts` with:

```typescript
import type { EventEmitter } from '@enkaku/event'

/** Opaque message stored by the hub — minimal metadata for routing only. */
export type StoredMessage = {
  sequenceID: string
  senderDID: string
  topicID: string
  payload: Uint8Array
}

export type PublishParams = {
  senderDID: string
  topicID: string
  payload: Uint8Array
}

export type FetchParams = {
  recipientDID: string
  after?: string
  limit?: number
  ack?: Array<string>
}

export type FetchResult = {
  messages: Array<StoredMessage>
  cursor: string | null
  hasMore?: boolean
}

export type AckParams = {
  recipientDID: string
  sequenceIDs: Array<string>
}

export type PurgeParams = {
  olderThan: number
}

export type HubStoreEvents = {
  purge: { sequenceIDs: Array<string> }
}

export type HubStore = {
  events: EventEmitter<HubStoreEvents>
  publish(params: PublishParams): Promise<string>
  fetch(params: FetchParams): Promise<FetchResult>
  ack(params: AckParams): Promise<void>
  purge(params: PurgeParams): Promise<Array<string>>
  subscribe(subscriberDID: string, topicID: string): Promise<void>
  unsubscribe(subscriberDID: string, topicID: string): Promise<void>
  getSubscribers(topicID: string): Promise<Array<string>>
  storeKeyPackage(ownerDID: string, keyPackage: string): Promise<void>
  fetchKeyPackages(ownerDID: string, count?: number): Promise<Array<string>>
}
```

- [ ] **Step 5: Update `index.ts` re-exports**

Replace the entire contents of `packages/hub-protocol/src/index.ts` with:

```typescript
/**
 * Hub protocol for blind pub/sub messaging over opaque topic IDs.
 *
 * @module hub-protocol
 */

export type { HubProtocol } from './protocol.js'
export { hubProtocol } from './protocol.js'
export type {
  AckParams,
  FetchParams,
  FetchResult,
  HubStore,
  HubStoreEvents,
  PublishParams,
  PurgeParams,
  StoredMessage,
} from './types.js'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/hub-protocol run test`
Expected: PASS (type check + `protocol.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add packages/hub-protocol/src packages/hub-protocol/test
git commit -m "feat(hub-protocol): replace group/recipients procedures with topic pub/sub"
```

---

### Task 2: hub-server — memoryStore pub/sub rewrite

**Files:**
- Modify: `packages/hub-server/src/memoryStore.ts`
- Test: `packages/hub-server/test/memoryStore.test.ts`

**Interfaces:**
- Consumes: `HubStore`, `PublishParams`, `StoredMessage`, `FetchParams`, `FetchResult`, `AckParams`, `PurgeParams`, `HubStoreEvents` from `@enkaku/hub-protocol` (Task 1).
- Produces (consumed by Task 5): `createMemoryStore(options?: MemoryStoreOptions): HubStore` and `type MemoryStoreOptions = { maxDepth?: number }`.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `packages/hub-server/test/memoryStore.test.ts` with:

```typescript
import { describe, expect, test, vi } from 'vitest'

import { createMemoryStore } from '../src/memoryStore.js'

const ALICE = 'did:key:alice'
const BOB = 'did:key:bob'
const CAROL = 'did:key:carol'
const TOPIC = 'topic:1'

describe('createMemoryStore pub/sub', () => {
  test('publish stores nothing when the topic has no subscribers (drop)', async () => {
    const store = createMemoryStore()
    const id = await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })
    expect(typeof id).toBe('string')
    const result = await store.fetch({ recipientDID: BOB })
    expect(result.messages).toHaveLength(0)
  })

  test('publish fans out to current subscribers (minus sender)', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.subscribe(ALICE, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1, 2]) })

    const bob = await store.fetch({ recipientDID: BOB })
    expect(bob.messages).toHaveLength(1)
    expect(bob.messages[0].topicID).toBe(TOPIC)
    expect(bob.messages[0].senderDID).toBe(ALICE)
    expect(bob.messages[0].payload).toEqual(new Uint8Array([1, 2]))

    // Sender is excluded from its own publish.
    const alice = await store.fetch({ recipientDID: ALICE })
    expect(alice.messages).toHaveLength(0)
  })

  test('getSubscribers reflects subscribe / unsubscribe', async () => {
    const store = createMemoryStore()
    expect(await store.getSubscribers(TOPIC)).toEqual([])
    await store.subscribe(BOB, TOPIC)
    await store.subscribe(BOB, TOPIC) // idempotent
    expect(await store.getSubscribers(TOPIC)).toEqual([BOB])
    await store.unsubscribe(BOB, TOPIC)
    expect(await store.getSubscribers(TOPIC)).toEqual([])
  })

  test('unsubscribe clears the subscriber pending deliveries for that topic', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.subscribe(CAROL, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })

    await store.unsubscribe(BOB, TOPIC)
    expect((await store.fetch({ recipientDID: BOB })).messages).toHaveLength(0)
    // Carol still has hers.
    expect((await store.fetch({ recipientDID: CAROL })).messages).toHaveLength(1)
  })

  test('last unsubscribe drops the whole topic log immediately', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })
    await store.unsubscribe(BOB, TOPIC)
    // Re-subscribe and confirm no backlog survived.
    await store.subscribe(BOB, TOPIC)
    expect((await store.fetch({ recipientDID: BOB })).messages).toHaveLength(0)
  })

  test('maxDepth trims the oldest message per topic on publish', async () => {
    const store = createMemoryStore({ maxDepth: 2 })
    await store.subscribe(BOB, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([2]) })
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([3]) })

    const result = await store.fetch({ recipientDID: BOB })
    expect(result.messages.map((m) => m.payload[0])).toEqual([2, 3])
  })

  test('refcount GC: message removed when its last subscriber acks', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.subscribe(CAROL, TOPIC)
    const id = await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })
    await store.ack({ recipientDID: BOB, sequenceIDs: [id] })
    expect((await store.fetch({ recipientDID: CAROL })).messages).toHaveLength(1)
    await store.ack({ recipientDID: CAROL, sequenceIDs: [id] })
    expect((await store.fetch({ recipientDID: CAROL })).messages).toHaveLength(0)
  })

  test('fetch respects after cursor, limit, and hasMore', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    const id1 = await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([2]) })
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([3]) })

    const after = await store.fetch({ recipientDID: BOB, after: id1 })
    expect(after.messages.map((m) => m.payload[0])).toEqual([2, 3])

    const limited = await store.fetch({ recipientDID: BOB, limit: 1 })
    expect(limited.messages).toHaveLength(1)
    expect(limited.hasMore).toBe(true)
  })

  test('purge removes aged messages and emits the purge event', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })
    const handler = vi.fn()
    store.events.on('purge', handler)
    const purged = await store.purge({ olderThan: 0 })
    expect(purged.length).toBeGreaterThan(0)
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sequenceIDs: expect.any(Array) }))
    expect((await store.fetch({ recipientDID: BOB })).messages).toHaveLength(0)
  })

  test('key package store and fetch', async () => {
    const store = createMemoryStore()
    await store.storeKeyPackage(ALICE, 'kp-1')
    await store.storeKeyPackage(ALICE, 'kp-2')
    expect(await store.fetchKeyPackages(ALICE, 1)).toEqual(['kp-1'])
    expect(await store.fetchKeyPackages(ALICE)).toEqual(['kp-2'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/hub-server exec vitest run test/memoryStore.test.ts`
Expected: FAIL (`store.publish` / `store.subscribe` do not exist yet).

- [ ] **Step 3: Rewrite `memoryStore.ts`**

Replace the entire contents of `packages/hub-server/src/memoryStore.ts` with:

```typescript
import { EventEmitter } from '@enkaku/event'
import type {
  AckParams,
  FetchParams,
  FetchResult,
  HubStore,
  HubStoreEvents,
  PublishParams,
  PurgeParams,
  StoredMessage,
} from '@enkaku/hub-protocol'

type MessageRecord = {
  sequenceID: string
  senderDID: string
  topicID: string
  payload: Uint8Array
  recipients: Set<string>
  storedAt: number
}

export type MemoryStoreOptions = {
  /** Per-topic max retained messages; oldest are trimmed beyond this. Default 1000. */
  maxDepth?: number
}

const DEFAULT_MAX_DEPTH = 1000

function formatSequenceID(counter: number): string {
  return String(counter).padStart(12, '0')
}

/**
 * In-memory implementation of HubStore for testing and development.
 *
 * Single message copy + per-subscriber delivery index + refcount GC. Recipients
 * are resolved from the subscription table at publish time, never passed in.
 */
export function createMemoryStore(options: MemoryStoreOptions = {}): HubStore {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  let counter = 0
  const messages = new Map<string, MessageRecord>()
  const deliveries = new Map<string, Array<string>>()
  const subscriptions = new Map<string, Set<string>>()
  const topicMessages = new Map<string, Array<string>>()
  const keyPackages = new Map<string, Array<string>>()
  const events = new EventEmitter<HubStoreEvents>()

  // Remove a message entirely: every recipient delivery list, the topic log,
  // and the message record.
  function deleteMessage(sequenceID: string): void {
    const record = messages.get(sequenceID)
    if (record == null) return
    for (const recipient of record.recipients) {
      const list = deliveries.get(recipient)
      if (list != null) {
        const index = list.indexOf(sequenceID)
        if (index !== -1) list.splice(index, 1)
      }
    }
    const topicLog = topicMessages.get(record.topicID)
    if (topicLog != null) {
      const index = topicLog.indexOf(sequenceID)
      if (index !== -1) topicLog.splice(index, 1)
      if (topicLog.length === 0) topicMessages.delete(record.topicID)
    }
    messages.delete(sequenceID)
  }

  // Drop one subscriber's delivery of a message; GC the message when its last
  // recipient is gone (refcount → 0).
  function removeDelivery(recipientDID: string, sequenceID: string): void {
    const list = deliveries.get(recipientDID)
    if (list != null) {
      const index = list.indexOf(sequenceID)
      if (index !== -1) list.splice(index, 1)
    }
    const record = messages.get(sequenceID)
    if (record != null) {
      record.recipients.delete(recipientDID)
      if (record.recipients.size === 0) {
        deleteMessage(sequenceID)
      }
    }
  }

  return {
    events,

    async publish(params: PublishParams): Promise<string> {
      counter++
      const sequenceID = formatSequenceID(counter)

      // Recipients = current subscribers minus the sender. Zero recipients
      // (no subscribers, or only the sender) → drop immediately, store nothing.
      const subscribers = subscriptions.get(params.topicID)
      const recipients = new Set<string>()
      if (subscribers != null) {
        for (const did of subscribers) {
          if (did !== params.senderDID) recipients.add(did)
        }
      }
      if (recipients.size === 0) {
        return sequenceID
      }

      const record: MessageRecord = {
        sequenceID,
        senderDID: params.senderDID,
        topicID: params.topicID,
        payload: params.payload,
        recipients,
        storedAt: Date.now(),
      }
      messages.set(sequenceID, record)

      for (const recipient of recipients) {
        let list = deliveries.get(recipient)
        if (list == null) {
          list = []
          deliveries.set(recipient, list)
        }
        list.push(sequenceID)
      }

      let topicLog = topicMessages.get(params.topicID)
      if (topicLog == null) {
        topicLog = []
        topicMessages.set(params.topicID, topicLog)
      }
      topicLog.push(sequenceID)
      // Per-topic max-depth trim: drop oldest beyond the bound.
      while (topicLog.length > maxDepth) {
        deleteMessage(topicLog[0])
      }

      return sequenceID
    },

    async fetch(params: FetchParams): Promise<FetchResult> {
      if (params.ack != null && params.ack.length > 0) {
        for (const sequenceID of params.ack) {
          removeDelivery(params.recipientDID, sequenceID)
        }
      }

      const recipientDeliveries = deliveries.get(params.recipientDID)
      if (recipientDeliveries == null || recipientDeliveries.length === 0) {
        return { messages: [], cursor: null }
      }

      let startIndex = 0
      if (params.after != null) {
        const afterIndex = recipientDeliveries.indexOf(params.after)
        if (afterIndex !== -1) {
          startIndex = afterIndex + 1
        }
      }

      const available = recipientDeliveries.slice(startIndex)
      const limit = params.limit ?? available.length
      const selected = available.slice(0, limit)
      const hasMore = available.length > limit

      const resultMessages: Array<StoredMessage> = []
      for (const sequenceID of selected) {
        const record = messages.get(sequenceID)
        if (record != null) {
          resultMessages.push({
            sequenceID: record.sequenceID,
            senderDID: record.senderDID,
            topicID: record.topicID,
            payload: record.payload,
          })
        }
      }

      const cursor =
        resultMessages.length > 0 ? resultMessages[resultMessages.length - 1].sequenceID : null

      const result: FetchResult = { messages: resultMessages, cursor }
      if (hasMore) {
        result.hasMore = true
      }
      return result
    },

    async ack(params: AckParams): Promise<void> {
      for (const sequenceID of params.sequenceIDs) {
        removeDelivery(params.recipientDID, sequenceID)
      }
    },

    async purge(params: PurgeParams): Promise<Array<string>> {
      const threshold = Date.now() - params.olderThan * 1000
      const purgedIDs: Array<string> = []
      for (const [sequenceID, record] of messages) {
        if (record.storedAt <= threshold) {
          purgedIDs.push(sequenceID)
          deleteMessage(sequenceID)
        }
      }
      if (purgedIDs.length > 0) {
        await events.emit('purge', { sequenceIDs: purgedIDs })
      }
      return purgedIDs
    },

    async subscribe(subscriberDID: string, topicID: string): Promise<void> {
      let subs = subscriptions.get(topicID)
      if (subs == null) {
        subs = new Set()
        subscriptions.set(topicID, subs)
      }
      subs.add(subscriberDID)
    },

    async unsubscribe(subscriberDID: string, topicID: string): Promise<void> {
      const subs = subscriptions.get(topicID)
      if (subs != null) {
        subs.delete(subscriberDID)
        if (subs.size === 0) {
          subscriptions.delete(topicID)
        }
      }
      // Drop this subscriber's pending deliveries for the topic.
      const list = deliveries.get(subscriberDID)
      if (list != null) {
        for (const sequenceID of [...list]) {
          const record = messages.get(sequenceID)
          if (record != null && record.topicID === topicID) {
            removeDelivery(subscriberDID, sequenceID)
          }
        }
      }
      // Last subscriber gone → drop the whole topic log immediately.
      if (!subscriptions.has(topicID)) {
        const topicLog = topicMessages.get(topicID)
        if (topicLog != null) {
          for (const sequenceID of [...topicLog]) {
            deleteMessage(sequenceID)
          }
        }
      }
    },

    async getSubscribers(topicID: string): Promise<Array<string>> {
      const subs = subscriptions.get(topicID)
      return subs == null ? [] : [...subs]
    },

    async storeKeyPackage(ownerDID: string, keyPackage: string): Promise<void> {
      let packages = keyPackages.get(ownerDID)
      if (packages == null) {
        packages = []
        keyPackages.set(ownerDID, packages)
      }
      packages.push(keyPackage)
    },

    async fetchKeyPackages(ownerDID: string, count?: number): Promise<Array<string>> {
      const packages = keyPackages.get(ownerDID)
      if (packages == null || packages.length === 0) return []
      const n = count ?? 1
      return packages.splice(0, n)
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/hub-server exec vitest run test/memoryStore.test.ts`
Expected: PASS (10 tests).

> Note: `pnpm --filter @enkaku/hub-server run test` (the full suite incl. `tsc`) will still FAIL here because `handlers.ts`/`hub.ts`/`registry.ts`/`hub.test.ts` reference the old API — those are fixed in Tasks 3–5. Run only the `vitest` file at this gate.

- [ ] **Step 5: Commit**

```bash
git add packages/hub-server/src/memoryStore.ts packages/hub-server/test/memoryStore.test.ts
git commit -m "feat(hub-server): pub/sub memoryStore with subscription table and per-topic retention"
```

---

### Task 3: hub-server — registry simplification

**Files:**
- Modify: `packages/hub-server/src/registry.ts`
- Test: `packages/hub-server/test/registry.test.ts`

**Interfaces:**
- Consumes: `StoredMessage` from `@enkaku/hub-protocol` (Task 1).
- Produces (consumed by Task 5): `class HubClientRegistry` with `register`, `unregister`, `unregisterIfIdle`, `setReceiveWriter`, `clearReceiveWriter`, `getClient`, `isOnline`, `isWriterBound`; `type ClientEntry = { did: string; sendMessage: ((message: StoredMessage) => void) | null }`.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `packages/hub-server/test/registry.test.ts` with:

```typescript
import type { StoredMessage } from '@enkaku/hub-protocol'
import { describe, expect, test, vi } from 'vitest'

import { HubClientRegistry } from '../src/registry.js'

const DID = 'did:key:alice'

function noopWriter(_message: StoredMessage): void {}

describe('HubClientRegistry', () => {
  test('register is idempotent', () => {
    const registry = new HubClientRegistry()
    const first = registry.register(DID)
    const second = registry.register(DID)
    expect(first).toBe(second)
    expect(first.sendMessage).toBeNull()
  })

  test('setReceiveWriter binds and rejects a double-bind', () => {
    const registry = new HubClientRegistry()
    registry.register(DID)
    registry.setReceiveWriter(DID, noopWriter)
    expect(registry.isWriterBound(DID)).toBe(true)
    expect(registry.isOnline(DID)).toBe(true)
    expect(() => registry.setReceiveWriter(DID, noopWriter)).toThrow('receive writer already bound')
  })

  test('clearReceiveWriter unbinds', () => {
    const registry = new HubClientRegistry()
    registry.register(DID)
    registry.setReceiveWriter(DID, noopWriter)
    registry.clearReceiveWriter(DID)
    expect(registry.isWriterBound(DID)).toBe(false)
  })

  test('unregisterIfIdle removes only when no writer is bound', () => {
    const registry = new HubClientRegistry()
    registry.register(DID)
    registry.setReceiveWriter(DID, noopWriter)
    registry.unregisterIfIdle(DID)
    expect(registry.getClient(DID)).toBeDefined()
    registry.clearReceiveWriter(DID)
    registry.unregisterIfIdle(DID)
    expect(registry.getClient(DID)).toBeUndefined()
  })

  test('getClient exposes the bound writer', () => {
    const registry = new HubClientRegistry()
    registry.register(DID)
    const writer = vi.fn()
    registry.setReceiveWriter(DID, writer)
    const message: StoredMessage = {
      sequenceID: '1',
      senderDID: 'did:key:bob',
      topicID: 'topic:1',
      payload: new Uint8Array([1]),
    }
    registry.getClient(DID)?.sendMessage?.(message)
    expect(writer).toHaveBeenCalledWith(message)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/hub-server exec vitest run test/registry.test.ts`
Expected: FAIL (current `ClientEntry` still has `groups`; type check / behavior mismatch).

- [ ] **Step 3: Rewrite `registry.ts`**

Replace the entire contents of `packages/hub-server/src/registry.ts` with:

```typescript
import type { StoredMessage } from '@enkaku/hub-protocol'

export type ClientEntry = {
  did: string
  sendMessage: ((message: StoredMessage) => void) | null
}

/**
 * Tracks online clients and their live receive-channel writers. Subscription
 * state is durable in the store, not here — the registry only routes live
 * fan-out to currently-connected subscribers.
 */
export class HubClientRegistry {
  #clients = new Map<string, ClientEntry>()

  register(did: string): ClientEntry {
    const existing = this.#clients.get(did)
    if (existing != null) {
      return existing
    }
    const entry: ClientEntry = { did, sendMessage: null }
    this.#clients.set(did, entry)
    return entry
  }

  unregister(did: string): void {
    this.#clients.delete(did)
  }

  /** Removes the entry only when no receive writer is bound. */
  unregisterIfIdle(did: string): void {
    const entry = this.#clients.get(did)
    if (entry != null && entry.sendMessage == null) {
      this.#clients.delete(did)
    }
  }

  setReceiveWriter(did: string, writer: (message: StoredMessage) => void): void {
    const entry = this.#clients.get(did)
    if (entry == null) return
    if (entry.sendMessage != null) {
      throw new Error(`receive writer already bound for DID ${did}`)
    }
    entry.sendMessage = writer
  }

  clearReceiveWriter(did: string): void {
    const entry = this.#clients.get(did)
    if (entry != null) {
      entry.sendMessage = null
    }
  }

  getClient(did: string): ClientEntry | undefined {
    return this.#clients.get(did)
  }

  isOnline(did: string): boolean {
    return this.#clients.get(did)?.sendMessage != null
  }

  isWriterBound(did: string): boolean {
    return this.#clients.get(did)?.sendMessage != null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/hub-server exec vitest run test/registry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hub-server/src/registry.ts packages/hub-server/test/registry.test.ts
git commit -m "feat(hub-server): strip group tracking from client registry"
```

---

### Task 4: hub-server — rate-limit token bucket

**Files:**
- Create: `packages/hub-server/src/rateLimit.ts`
- Test: `packages/hub-server/test/rateLimit.test.ts`

**Interfaces:**
- Produces (consumed by Task 5): `type RateLimitConfig = { rate: number; burst: number }`, `type RateLimiter = { tryConsume(key: string): boolean }`, `createRateLimiter(config: RateLimitConfig): RateLimiter`.

- [ ] **Step 1: Write the failing test**

Create `packages/hub-server/test/rateLimit.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createRateLimiter } from '../src/rateLimit.js'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('allows up to burst then rejects', () => {
    const limiter = createRateLimiter({ rate: 1, burst: 3 })
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
  })

  test('refills over time at the configured rate', () => {
    const limiter = createRateLimiter({ rate: 2, burst: 2 })
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
    // After 1s, rate=2 refills 2 tokens (capped at burst).
    vi.advanceTimersByTime(1000)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
  })

  test('keys are independent', () => {
    const limiter = createRateLimiter({ rate: 1, burst: 1 })
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
    expect(limiter.tryConsume('b')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/hub-server exec vitest run test/rateLimit.test.ts`
Expected: FAIL (`createRateLimiter` not found).

- [ ] **Step 3: Write `rateLimit.ts`**

Create `packages/hub-server/src/rateLimit.ts`:

```typescript
export type RateLimitConfig = {
  /** Sustained refill rate in tokens per second. */
  rate: number
  /** Maximum bucket capacity (burst). */
  burst: number
}

export type RateLimiter = {
  /** Consumes a token if available, returning true; returns false otherwise. */
  tryConsume(key: string): boolean
}

type Bucket = {
  tokens: number
  lastRefill: number
}

/** Per-key token-bucket rate limiter. */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const buckets = new Map<string, Bucket>()
  return {
    tryConsume(key: string): boolean {
      const now = Date.now()
      let bucket = buckets.get(key)
      if (bucket == null) {
        bucket = { tokens: config.burst, lastRefill: now }
        buckets.set(key, bucket)
      } else {
        const elapsedSeconds = (now - bucket.lastRefill) / 1000
        bucket.tokens = Math.min(config.burst, bucket.tokens + elapsedSeconds * config.rate)
        bucket.lastRefill = now
      }
      if (bucket.tokens < 1) {
        return false
      }
      bucket.tokens -= 1
      return true
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/hub-server exec vitest run test/rateLimit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hub-server/src/rateLimit.ts packages/hub-server/test/rateLimit.test.ts
git commit -m "feat(hub-server): add per-key token-bucket rate limiter"
```

---

### Task 5: hub-server — handlers + hub wiring (integration)

**Files:**
- Modify: `packages/hub-server/src/handlers.ts`
- Modify: `packages/hub-server/src/hub.ts`
- Modify: `packages/hub-server/src/index.ts`
- Test: `packages/hub-server/test/hub.test.ts`

**Interfaces:**
- Consumes: `HubProtocol`, `HubStore`, `StoredMessage` (Task 1); `HubClientRegistry` (Task 3); `createRateLimiter`, `RateLimitConfig` (Task 4); `createMemoryStore` (Task 2).
- Produces (consumed by downstream Phase 3 + re-exported): `type AuthorizeAction = 'publish' | 'subscribe'`, `type AuthorizeHook = (did: string, action: AuthorizeAction, topicID: string) => boolean | Promise<boolean>`, `type HubRateLimits = { perDID: RateLimitConfig; perTopic: RateLimitConfig }`, `DEFAULT_RATE_LIMITS`, `createHandlers`, `createHub` (now accepting `authorize` + `rateLimits`).

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `packages/hub-server/test/hub.test.ts` with:

```typescript
import { Client } from '@enkaku/client'
import { fromUTF, toB64 } from '@enkaku/codec'
import type { HubProtocol, HubStore } from '@enkaku/hub-protocol'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { type OwnIdentity, randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { createHandlers } from '../src/handlers.js'
import { type CreateHubParams, createHub, type HubInstance } from '../src/hub.js'
import { createMemoryStore } from '../src/memoryStore.js'
import { HubClientRegistry } from '../src/registry.js'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

const TOPIC = 'topic:1'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function encodePayload(value: string): string {
  return toB64(fromUTF(value))
}

type TestHubOptions = Omit<CreateHubParams, 'identity' | 'store' | 'transport'> & {
  store?: HubStore
}

type TestConnection = {
  client: Client<HubProtocol>
  identity: OwnIdentity
}

type TestHub = {
  hub: HubInstance
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

  return { hub, store, connect, dispose }
}

describe('hub authentication', () => {
  test('rejects unsigned client messages', async () => {
    const ctx = createTestHub()
    const transports: HubTransports = new DirectTransports()
    ctx.hub.server.handle(transports.server)
    const anonymous = new Client<HubProtocol>({ transport: transports.client })

    await expect(
      anonymous.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('nope') } }),
    ).rejects.toThrow('Message is not signed')

    await transports.dispose()
    await ctx.dispose()
  })

  test('handlers reject messages without a verified issuer DID', async () => {
    const registry = new HubClientRegistry()
    const store = createMemoryStore()
    const handlers = createHandlers({ registry, store })
    await expect(
      handlers['hub/publish']({
        message: { header: {}, payload: { typ: 'request', prc: 'hub/publish', rid: '1' } },
        param: { topicID: TOPIC, payload: encodePayload('x') },
        signal: new AbortController().signal,
      } as never),
    ).rejects.toThrow('missing verified issuer DID')
  })
})

describe('hub pub/sub', () => {
  test('publish fans out to subscribers (live)', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()
    const { client: bob } = ctx.connect(bobIdentity)

    await bob.request('hub/subscribe', { param: { topicID: TOPIC } })
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    await delay(20)

    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('hi') } })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.topicID).toBe(TOPIC)
    expect(msg.value?.payload).toBe(encodePayload('hi'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(20)
    await ctx.dispose()
  })

  test('publish to a topic with no subscribers stores nothing', async () => {
    const store = createMemoryStore()
    const ctx = createTestHub({ store })
    const { client: alice } = ctx.connect()

    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('void') } })
    await delay(20)

    expect(await store.getSubscribers(TOPIC)).toEqual([])
    expect((await store.fetch({ recipientDID: 'did:key:nobody' })).messages).toHaveLength(0)
    await ctx.dispose()
  })

  test('offline subscriber receives queued messages on connect', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()

    const { client: bobSetup } = ctx.connect(bobIdentity)
    await bobSetup.request('hub/subscribe', { param: { topicID: TOPIC } })

    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('queued') } })
    await delay(20)

    const { client: bob } = ctx.connect(bobIdentity)
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg = await reader.read()
    expect(msg.value?.payload).toBe(encodePayload('queued'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(20)
    await ctx.dispose()
  })

  test('ack drains the store', async () => {
    const store = createMemoryStore()
    const ackSpy = vi.spyOn(store, 'ack')
    const ctx = createTestHub({ store })
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()
    const { client: bobSetup } = ctx.connect(bobIdentity)
    await bobSetup.request('hub/subscribe', { param: { topicID: TOPIC } })

    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('m1') } })
    await delay(20)

    const { client: bob } = ctx.connect(bobIdentity)
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg = await reader.read()
    const sequenceID = msg.value?.sequenceID as string
    await channel.send({ ack: [sequenceID] })
    await delay(20)

    expect(ackSpy).toHaveBeenCalledWith({ recipientDID: bobIdentity.id, sequenceIDs: [sequenceID] })
    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(20)
    await ctx.dispose()
  })

  test('unsubscribe stops further delivery', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()
    const { client: bob } = ctx.connect(bobIdentity)

    await bob.request('hub/subscribe', { param: { topicID: TOPIC } })
    await bob.request('hub/unsubscribe', { param: { topicID: TOPIC } })

    expect(await ctx.store.getSubscribers(TOPIC)).toEqual([])
    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('gone') } })
    await delay(20)
    expect((await ctx.store.fetch({ recipientDID: bobIdentity.id })).messages).toHaveLength(0)
    await ctx.dispose()
  })

  test('hub/receive rejects a second concurrent open for the same DID', async () => {
    const ctx = createTestHub()
    const bobIdentity = randomIdentity()
    const { client: bob } = ctx.connect(bobIdentity)
    const channel1 = bob.createChannel('hub/receive', { param: {} })
    channel1.readable.getReader()
    await delay(20)

    const channel2 = bob.createChannel('hub/receive', { param: {} })
    await expect(channel2).rejects.toThrow('already bound')

    channel1.close()
    await expect(channel1).rejects.toEqual('Close')
    await delay(20)
    await ctx.dispose()
  })
})

describe('hub authorization', () => {
  test('authorize=false rejects publish and subscribe', async () => {
    const ctx = createTestHub({ authorize: () => false })
    const { client: alice } = ctx.connect()
    await expect(
      alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('x') } }),
    ).rejects.toThrow('Not authorized')
    await expect(
      alice.request('hub/subscribe', { param: { topicID: TOPIC } }),
    ).rejects.toThrow('Not authorized')
    await ctx.dispose()
  })
})

describe('hub rate limiting', () => {
  test('rejects publishes beyond the per-DID burst', async () => {
    const ctx = createTestHub({ rateLimits: { perDID: { rate: 0, burst: 2 } } })
    const { client: alice } = ctx.connect()
    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('1') } })
    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('2') } })
    await expect(
      alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('3') } }),
    ).rejects.toThrow('rate limit')
    await ctx.dispose()
  })
})

describe('hub key packages', () => {
  test('upload then fetch consumes packages', async () => {
    const ctx = createTestHub()
    const { client: alice, identity } = ctx.connect()
    const uploaded = await alice.request('hub/keypackage/upload', {
      param: { keyPackages: ['kp-1', 'kp-2'] },
    })
    expect(uploaded.stored).toBe(2)

    const { client: bob } = ctx.connect()
    const fetched = await bob.request('hub/keypackage/fetch', { param: { did: identity.id, count: 1 } })
    expect(fetched.keyPackages).toEqual(['kp-1'])
    await ctx.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/hub-server exec vitest run test/hub.test.ts`
Expected: FAIL (handlers have no `hub/publish` etc.).

- [ ] **Step 3: Rewrite `handlers.ts`**

Replace the entire contents of `packages/hub-server/src/handlers.ts` with:

```typescript
import { fromB64, toB64 } from '@enkaku/codec'
import type { HubProtocol, HubStore, StoredMessage } from '@enkaku/hub-protocol'
import type { ChannelHandler, ProcedureHandlers, RequestHandler } from '@enkaku/server'

import { createRateLimiter, type RateLimitConfig } from './rateLimit.js'
import type { HubClientRegistry } from './registry.js'

export type AuthorizeAction = 'publish' | 'subscribe'

export type AuthorizeHook = (
  did: string,
  action: AuthorizeAction,
  topicID: string,
) => boolean | Promise<boolean>

export type HubRateLimits = {
  perDID: RateLimitConfig
  perTopic: RateLimitConfig
}

export const DEFAULT_RATE_LIMITS: HubRateLimits = {
  perDID: { rate: 20, burst: 50 },
  perTopic: { rate: 100, burst: 200 },
}

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
  authorize?: AuthorizeHook
  rateLimits?: Partial<HubRateLimits>
  keyPackageFetchLimits?: Partial<KeyPackageFetchLimits>
}

function getClientDID(ctx: { message: { payload: Record<string, unknown> } }): string {
  const iss = ctx.message.payload.iss
  if (typeof iss !== 'string' || iss.length === 0) {
    throw new Error('Unauthenticated message: missing verified issuer DID')
  }
  return iss
}

export function createHandlers(params: CreateHandlersParams): ProcedureHandlers<HubProtocol> {
  const { store, registry } = params
  const authorize: AuthorizeHook = params.authorize ?? (() => true)
  const rateLimits: HubRateLimits = {
    perDID: { ...DEFAULT_RATE_LIMITS.perDID, ...params.rateLimits?.perDID },
    perTopic: { ...DEFAULT_RATE_LIMITS.perTopic, ...params.rateLimits?.perTopic },
  }
  const didLimiter = createRateLimiter(rateLimits.perDID)
  const topicLimiter = createRateLimiter(rateLimits.perTopic)

  const fetchLimits: KeyPackageFetchLimits = {
    ...DEFAULT_KEYPACKAGE_FETCH_LIMITS,
    ...params.keyPackageFetchLimits,
  }
  const fetchWindows = new Map<string, { count: number; resetAt: number }>()

  function assertKeyPackageFetchAllowed(requesterDID: string): void {
    const now = Date.now()
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

  return {
    'hub/publish': (async (ctx) => {
      const { topicID, payload } = ctx.param
      const senderDID = getClientDID(ctx)
      if (!(await authorize(senderDID, 'publish', topicID))) {
        throw new Error('Not authorized to publish to topic')
      }
      if (!didLimiter.tryConsume(senderDID)) {
        throw new Error('Publish rate limit exceeded for DID')
      }
      if (!topicLimiter.tryConsume(topicID)) {
        throw new Error('Publish rate limit exceeded for topic')
      }
      const payloadBytes = fromB64(payload)
      const sequenceID = await store.publish({ senderDID, topicID, payload: payloadBytes })

      // Live-deliver to currently-connected subscribers (minus the sender).
      const subscribers = await store.getSubscribers(topicID)
      for (const recipientDID of subscribers) {
        if (recipientDID === senderDID) continue
        const client = registry.getClient(recipientDID)
        if (client?.sendMessage != null) {
          client.sendMessage({ sequenceID, senderDID, topicID, payload: payloadBytes })
        }
      }

      return { sequenceID }
    }) as RequestHandler<HubProtocol, 'hub/publish'>,

    'hub/subscribe': (async (ctx) => {
      const { topicID } = ctx.param
      const clientDID = getClientDID(ctx)
      if (!(await authorize(clientDID, 'subscribe', topicID))) {
        throw new Error('Not authorized to subscribe to topic')
      }
      await store.subscribe(clientDID, topicID)
      return { subscribed: true }
    }) as RequestHandler<HubProtocol, 'hub/subscribe'>,

    'hub/unsubscribe': (async (ctx) => {
      const { topicID } = ctx.param
      const clientDID = getClientDID(ctx)
      await store.unsubscribe(clientDID, topicID)
      return { unsubscribed: true }
    }) as RequestHandler<HubProtocol, 'hub/unsubscribe'>,

    'hub/receive': (async (ctx) => {
      const clientDID = getClientDID(ctx)
      const { after } = ctx.param ?? {}

      registry.register(clientDID)
      if (registry.isWriterBound(clientDID)) {
        throw new Error(`receive writer already bound for DID ${clientDID}`)
      }

      const writer = ctx.writable.getWriter()
      const reader = ctx.readable.getReader()

      try {
        registry.setReceiveWriter(clientDID, (message: StoredMessage) => {
          writer
            .write({
              sequenceID: message.sequenceID,
              senderDID: message.senderDID,
              topicID: message.topicID,
              payload: toB64(message.payload),
            })
            .catch(() => {})
        })

        let cursor: string | null | undefined = after
        while (true) {
          const result = await store.fetch({
            recipientDID: clientDID,
            after: cursor ?? undefined,
            limit: 50,
          })
          for (const msg of result.messages) {
            await writer.write({
              sequenceID: msg.sequenceID,
              senderDID: msg.senderDID,
              topicID: msg.topicID,
              payload: toB64(msg.payload),
            })
          }
          cursor = result.cursor
          if (!result.hasMore) break
        }
      } catch (error) {
        registry.clearReceiveWriter(clientDID)
        registry.unregisterIfIdle(clientDID)
        reader.cancel().catch(() => {})
        writer.abort(error).catch(() => {})
        throw error
      }

      void (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value?.ack != null) {
              await store.ack({ recipientDID: clientDID, sequenceIDs: value.ack })
            }
          }
        } catch {
          // Channel closed
        }
      })()

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
    }) as ChannelHandler<HubProtocol, 'hub/receive'>,

    'hub/keypackage/upload': (async (ctx) => {
      const { keyPackages } = ctx.param
      const clientDID = getClientDID(ctx)
      await Promise.all(keyPackages.map((kp: string) => store.storeKeyPackage(clientDID, kp)))
      return { stored: keyPackages.length }
    }) as RequestHandler<HubProtocol, 'hub/keypackage/upload'>,

    'hub/keypackage/fetch': (async (ctx) => {
      const requesterDID = getClientDID(ctx)
      assertKeyPackageFetchAllowed(requesterDID)
      const { did, count } = ctx.param
      const cappedCount = Math.min(Math.max(count ?? 1, 1), fetchLimits.maxCount)
      const keyPackages = await store.fetchKeyPackages(did, cappedCount)
      return { keyPackages }
    }) as RequestHandler<HubProtocol, 'hub/keypackage/fetch'>,
  }
}
```

- [ ] **Step 4: Rewrite `hub.ts`**

Replace the entire contents of `packages/hub-server/src/hub.ts` with:

```typescript
import { type HubProtocol, type HubStore, hubProtocol } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type { AccessRules, ResourceLimits, Server } from '@enkaku/server'
import { serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'

import {
  type AuthorizeHook,
  createHandlers,
  type HubRateLimits,
  type KeyPackageFetchLimits,
} from './handlers.js'
import { HubClientRegistry } from './registry.js'

/**
 * Default access rules: any authenticated DID may call hub procedures.
 * The hub is a blind relay — per-procedure authorization (the `authorize`
 * hook) happens in the handlers.
 */
export const DEFAULT_HUB_ACCESS_RULES: AccessRules = {
  'hub/*': { allow: true },
}

export type HubPurgeOptions = {
  /** Interval between purge runs in milliseconds. Default: 3600000 (1 hour) */
  interval?: number
  /** Age in seconds after which unacked stored messages are purged. Default: 604800 (7 days) */
  olderThan?: number
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
  /** Per-procedure publish/subscribe authorization. Defaults to allow-any-authed. */
  authorize?: AuthorizeHook
  /** Publish rate limits. Merged over {@link DEFAULT_RATE_LIMITS}. */
  rateLimits?: Partial<HubRateLimits>
  /** Quotas applied to hub/keypackage/fetch. Merged over {@link DEFAULT_KEYPACKAGE_FETCH_LIMITS}. */
  keyPackageFetchLimits?: Partial<KeyPackageFetchLimits>
  /** Scheduled purge of expired stored messages. Set to `false` to disable. */
  purge?: HubPurgeOptions | false
  /**
   * Server resource limits. `hub/receive` is always added to
   * `longLivedProcedures` so open mailbox channels are exempt from
   * `controllerTimeoutMs` and from the `maxConcurrentHandlers` cap.
   */
  limits?: Partial<ResourceLimits>
}

export type HubInstance = {
  registry: HubClientRegistry
  server: Server<HubProtocol>
}

export function createHub(params: CreateHubParams): HubInstance {
  const registry = new HubClientRegistry()
  const handlers = createHandlers({
    registry,
    store: params.store,
    authorize: params.authorize,
    rateLimits: params.rateLimits,
    keyPackageFetchLimits: params.keyPackageFetchLimits,
  })
  const limits: Partial<ResourceLimits> = {
    ...params.limits,
    longLivedProcedures: [
      ...new Set([...(params.limits?.longLivedProcedures ?? []), 'hub/receive']),
    ],
  }
  const server = serve<HubProtocol>({
    handlers,
    protocol: hubProtocol,
    transport: params.transport,
    identity: params.identity,
    accessRules: params.accessRules ?? DEFAULT_HUB_ACCESS_RULES,
    limits,
  })
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
  return { registry, server }
}
```

- [ ] **Step 5: Update `index.ts` exports**

Replace the entire contents of `packages/hub-server/src/index.ts` with:

```typescript
export type {
  AuthorizeAction,
  AuthorizeHook,
  CreateHandlersParams,
  HubRateLimits,
  KeyPackageFetchLimits,
} from './handlers.js'
export { createHandlers, DEFAULT_KEYPACKAGE_FETCH_LIMITS, DEFAULT_RATE_LIMITS } from './handlers.js'
export type { CreateHubParams, HubInstance, HubPurgeOptions } from './hub.js'
export { createHub, DEFAULT_HUB_ACCESS_RULES } from './hub.js'
export { createMemoryStore, type MemoryStoreOptions } from './memoryStore.js'
export { createRateLimiter, type RateLimitConfig, type RateLimiter } from './rateLimit.js'
export type { ClientEntry } from './registry.js'
export { HubClientRegistry } from './registry.js'
```

- [ ] **Step 6: Run the hub-server suite**

Run: `pnpm --filter @enkaku/hub-server run test`
Expected: PASS (type check across hub-server + all `vitest` files: memoryStore, registry, rateLimit, hub).

- [ ] **Step 7: Commit**

```bash
git add packages/hub-server/src packages/hub-server/test
git commit -m "feat(hub-server): topic pub/sub handlers with authorize hook and rate limiting"
```

---

### Task 6: hub-tunnel — core transport re-base

**Files:**
- Modify: `packages/hub-tunnel/src/transport.ts`
- Modify: `packages/hub-tunnel/src/events.ts`
- Modify: `packages/hub-tunnel/src/index.ts` (verify exports only)

**Interfaces:**
- Consumes: `StoredMessage` from `@enkaku/hub-protocol` (Task 1, now carries `topicID`).
- Produces (consumed by Tasks 7, 8): `HubLike` with `publish` / `subscribe` / `unsubscribe?` / `receive` / `events?`; `HubTunnelTransportParams` with `sendTopicID` + `receiveTopicID` + `localDID` (no `peerDID`). `FrameDroppedReason` includes `'topic-mismatch'` (not `'sender-mismatch'`).

- [ ] **Step 1: Update `events.ts` (rename the drop reason)**

In `packages/hub-tunnel/src/events.ts`, change the `FrameDroppedReason` union — replace `'sender-mismatch'` with `'topic-mismatch'`:

```typescript
export type FrameDroppedReason =
  | 'envelope-decode'
  | 'decrypt'
  | 'topic-mismatch'
  | 'session-mismatch'
  | 'dedup'
```

(Leave the rest of `events.ts` unchanged.)

- [ ] **Step 2: Rewrite `transport.ts`**

Replace the entire contents of `packages/hub-tunnel/src/transport.ts` with:

```typescript
import { AbortInterruption, TimeoutInterruption } from '@enkaku/async'
import type { StoredMessage } from '@enkaku/hub-protocol'
import { Transport, type TransportType } from '@enkaku/transport'

import {
  BackpressureError,
  FrameDecodeError,
  HubReconnectingError,
  SessionNotEstablishedError,
} from './errors.js'
import type { ObservabilityEventListener } from './events.js'
import { decodeFrame, encodeFrame, type HubFrame } from './frame.js'

export type HubReceiveSubscription = AsyncIterable<StoredMessage> & {
  return?: () => void
}

export type HubLikeEvent =
  | { type: 'reconnecting' }
  | { type: 'connected' }
  | { type: 'disconnected' }

export type HubLikeEventListener = (event: HubLikeEvent) => void

export type HubLikeEvents = {
  subscribe: (listener: HubLikeEventListener) => () => void
}

export type HubPublishParams = {
  senderDID: string
  topicID: string
  payload: Uint8Array
}

export type HubLike = {
  publish: (params: HubPublishParams) => Promise<{ sequenceID: string }>
  subscribe: (subscriberDID: string, topicID: string) => Promise<void> | void
  unsubscribe?: (subscriberDID: string, topicID: string) => Promise<void> | void
  receive: (subscriberDID: string) => HubReceiveSubscription
  events?: HubLikeEvents
}

export type HubTunnelSessionID = string | { auto: true }

export type HubTunnelTransportParams = {
  hub: HubLike
  sessionID: HubTunnelSessionID
  /**
   * The authenticated DID used to drain the receive stream (`hub.receive`) and
   * stamp published frames (`senderDID`). NOT a routing key — routing is by
   * `sendTopicID` / `receiveTopicID`.
   */
  localDID: string
  /** Topic this transport publishes its outbound frames to. */
  sendTopicID: string
  /** Topic this transport subscribes to and accepts inbound frames from. */
  receiveTopicID: string
  inboxCapacity?: number
  idleTimeoutMs?: number
  reconnectTimeoutMs?: number
  signal?: AbortSignal
  onEvent?: ObservabilityEventListener
  /**
   * Fired exactly once when the peer signals graceful end-of-session via the
   * `session-end` frame kind. Non-error path — `teardown(error)` paths emit
   * through `onEvent` instead.
   */
  onSessionEnd?: () => void
}

const DEFAULT_INBOX_CAPACITY = 1024

/**
 * Build a hub-tunnel transport over the pub/sub hub API. The returned
 * `TransportType` subscribes to `receiveTopicID`, reads from a single inbox
 * subscription (filtering to that topic), and writes to the hub via
 * `hub.publish` on `sendTopicID`.
 *
 * **Contract notes (relied on by callers):**
 * - `hub.subscribe(localDID, receiveTopicID)` and `hub.receive(localDID)` are
 *   each called **exactly once** during construction.
 * - On any teardown path (signal abort, idle timeout, encrypt failure,
 *   peer-side `session-end`, manual `transport.dispose()`), this transport
 *   publishes a best-effort `session-end` frame to `sendTopicID` and
 *   best-effort `hub.unsubscribe?.(localDID, receiveTopicID)`.
 */
export function createHubTunnelTransport<R, W>(
  params: HubTunnelTransportParams,
): TransportType<R, W> {
  const {
    hub,
    sessionID,
    localDID,
    sendTopicID,
    receiveTopicID,
    signal,
    idleTimeoutMs,
    reconnectTimeoutMs,
    onEvent,
    onSessionEnd,
  } = params
  const inboxCapacity = params.inboxCapacity ?? DEFAULT_INBOX_CAPACITY

  let lockedSessionID: string | null = typeof sessionID === 'string' ? sessionID : null

  let outboundSeq = 0
  let expectedSeq = 0
  // Best-effort subscribe; rejection is swallowed (the receive stream still
  // attaches, and a missing subscription simply yields no inbound frames).
  void Promise.resolve(hub.subscribe(localDID, receiveTopicID)).catch(() => {})
  const subscription = hub.receive(localDID)
  const iterator = subscription[Symbol.asyncIterator]()

  let abortHandler: (() => void) | undefined
  let torndown = false
  let readableController: ReadableStreamDefaultController<R> | undefined
  let lastActivity = Date.now()
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let unsubscribeEvents: (() => void) | undefined

  const clearIdleTimer = (): void => {
    if (idleTimer != null) {
      clearTimeout(idleTimer)
      idleTimer = undefined
    }
  }

  const clearReconnectTimer = (): void => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = undefined
    }
  }

  const sendSessionEnd = (): void => {
    if (lockedSessionID == null) return
    const frame: HubFrame = {
      v: 1,
      sessionID: lockedSessionID,
      kind: 'session-end',
      seq: outboundSeq,
    }
    void hub
      .publish({
        senderDID: localDID,
        topicID: sendTopicID,
        payload: encodeFrame(frame),
      })
      .catch(() => {
        // ignore
      })
  }

  const teardown = (error?: unknown): void => {
    if (torndown) return
    torndown = true
    clearIdleTimer()
    clearReconnectTimer()
    if (unsubscribeEvents != null) {
      unsubscribeEvents()
      unsubscribeEvents = undefined
    }
    if (abortHandler != null && signal != null) {
      signal.removeEventListener('abort', abortHandler)
      abortHandler = undefined
    }
    sendSessionEnd()
    try {
      void Promise.resolve(hub.unsubscribe?.(localDID, receiveTopicID)).catch(() => {})
    } catch {
      // ignore
    }
    if (error !== undefined && readableController != null) {
      try {
        readableController.error(error)
      } catch {
        // controller may already be closed
      }
    }
    iterator.return?.()
  }

  const scheduleIdleTimer = (): void => {
    if (idleTimeoutMs == null || torndown) return
    clearIdleTimer()
    const elapsed = Date.now() - lastActivity
    const remaining = idleTimeoutMs - elapsed
    const delay = remaining > 0 ? remaining : 0
    idleTimer = setTimeout(() => {
      idleTimer = undefined
      if (torndown) return
      const sinceActivity = Date.now() - lastActivity
      if (sinceActivity >= idleTimeoutMs) {
        teardown(new TimeoutInterruption({ message: 'idle timeout' }))
      } else {
        scheduleIdleTimer()
      }
    }, delay)
  }

  const markActivity = (): void => {
    lastActivity = Date.now()
  }

  const readable = new ReadableStream<R>(
    {
      start(controller) {
        readableController = controller
        if (signal?.aborted === true) {
          teardown(new AbortInterruption({ cause: signal.reason }))
          return
        }
        scheduleIdleTimer()
        void (async () => {
          while (true) {
            let result: IteratorResult<StoredMessage>
            try {
              result = await iterator.next()
            } catch (error) {
              if (!torndown) {
                torndown = true
                clearIdleTimer()
                controller.error(error)
              }
              return
            }
            if (torndown) return
            if (result.done) {
              torndown = true
              clearIdleTimer()
              controller.close()
              return
            }
            const message = result.value
            if (message.topicID !== receiveTopicID) {
              onEvent?.({ type: 'frame-dropped', reason: 'topic-mismatch' })
              continue
            }
            let frame: HubFrame
            try {
              frame = decodeFrame(message.payload)
            } catch (error) {
              if (error instanceof FrameDecodeError) continue
              teardown(error)
              return
            }
            if (lockedSessionID == null) {
              lockedSessionID = frame.sessionID
            } else if (frame.sessionID !== lockedSessionID) {
              onEvent?.({ type: 'frame-dropped', reason: 'session-mismatch' })
              continue
            }
            if (frame.kind === 'session-end') {
              torndown = true
              clearIdleTimer()
              try {
                controller.close()
              } catch {
                // already closed
              }
              iterator.return?.()
              onSessionEnd?.()
              return
            }
            if (frame.kind !== 'message') {
              continue
            }
            if (frame.seq < expectedSeq) {
              onEvent?.({ type: 'frame-dropped', reason: 'dedup' })
              continue
            }
            const desired = controller.desiredSize
            if (desired != null && desired <= 0) {
              const err = new BackpressureError(
                `Hub tunnel inbox overflow: capacity=${inboxCapacity} session=${lockedSessionID}`,
              )
              teardown(err)
              return
            }
            expectedSeq = frame.seq + 1
            markActivity()
            controller.enqueue(frame.body as R)
          }
        })()
      },
      cancel() {
        teardown()
      },
    },
    new CountQueuingStrategy({ highWaterMark: inboxCapacity }),
  )

  const writable = new WritableStream<W>({
    async write(value) {
      if (torndown) {
        throw new Error('Hub tunnel transport torn down')
      }
      if (lockedSessionID == null) {
        throw new SessionNotEstablishedError(
          'hub-tunnel: cannot send before session is established',
        )
      }
      const frame: HubFrame = {
        v: 1,
        sessionID: lockedSessionID,
        kind: 'message',
        seq: outboundSeq++,
        body: value as unknown as Extract<HubFrame, { kind: 'message' }>['body'],
      }
      await hub.publish({
        senderDID: localDID,
        topicID: sendTopicID,
        payload: encodeFrame(frame),
      })
      markActivity()
    },
    close() {
      teardown()
    },
    abort() {
      teardown()
    },
  })

  const transport = new Transport<R, W>({ stream: { readable, writable } })

  if (signal != null && signal.aborted !== true) {
    abortHandler = (): void => {
      teardown(new AbortInterruption({ cause: signal.reason }))
    }
    signal.addEventListener('abort', abortHandler, { once: true })
  }

  transport.events.on('disposed', () => {
    teardown()
  })

  if (reconnectTimeoutMs != null && hub.events != null) {
    const armReconnectTimer = (): void => {
      if (torndown || reconnectTimer != null) return
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined
        if (torndown) return
        teardown(new HubReconnectingError('reconnect timeout exceeded'))
      }, reconnectTimeoutMs)
    }
    unsubscribeEvents = hub.events.subscribe((event) => {
      if (torndown) return
      switch (event.type) {
        case 'reconnecting':
        case 'disconnected':
          armReconnectTimer()
          return
        case 'connected':
          clearReconnectTimer()
          return
      }
    })
  }

  return transport
}
```

- [ ] **Step 3: Verify `index.ts` exports**

Open `packages/hub-tunnel/src/index.ts`. The `transport.js` export block lists `HubLike`, `HubLikeEvent`, `HubLikeEventListener`, `HubLikeEvents`, `HubReceiveSubscription`, `HubTunnelSessionID`, `HubTunnelTransportParams`, `createHubTunnelTransport`. Add `HubPublishParams` to that export block:

```typescript
export {
  createHubTunnelTransport,
  type HubLike,
  type HubLikeEvent,
  type HubLikeEventListener,
  type HubLikeEvents,
  type HubPublishParams,
  type HubReceiveSubscription,
  type HubTunnelSessionID,
  type HubTunnelTransportParams,
} from './transport.js'
```

- [ ] **Step 4: Confirm it compiles (no test run yet)**

Run: `pnpm --filter @enkaku/hub-tunnel exec tsc --noEmit -p tsconfig.json`
Expected: PASS for `src/` (the `transport.ts` + `events.ts` source compile against the new hub-protocol types). `encrypted-transport.ts` is fixed in Task 7; if `tsc` flags it here, that is expected — re-run after Task 7. To scope this check to the changed files, it is acceptable to defer the green gate to Task 7's compile step.

- [ ] **Step 5: Commit**

```bash
git add packages/hub-tunnel/src/transport.ts packages/hub-tunnel/src/events.ts packages/hub-tunnel/src/index.ts
git commit -m "feat(hub-tunnel): re-base core transport onto topic pub/sub"
```

---

### Task 7: hub-tunnel — encrypted transport re-base

**Files:**
- Modify: `packages/hub-tunnel/src/encrypted-transport.ts`

**Interfaces:**
- Consumes: `HubLike`, `HubPublishParams`, `HubReceiveSubscription`, `HubTunnelTransportParams`, `createHubTunnelTransport` (Task 6); `StoredMessage` (Task 1).
- Produces (consumed by Task 8): `createEncryptedHubTunnelTransport`, `EncryptedHubTunnelTransportParams` (now extends the topic-based `HubTunnelTransportParams`).

- [ ] **Step 1: Rewrite `encrypted-transport.ts`**

Replace the entire contents of `packages/hub-tunnel/src/encrypted-transport.ts` with:

```typescript
import { fromB64, toB64 } from '@enkaku/codec'
import type { StoredMessage } from '@enkaku/hub-protocol'
import type { TransportType } from '@enkaku/transport'

import type { Encryptor } from './encryptor.js'
import { decodeEnvelope, encodeEnvelope, type TunnelEnvelope } from './envelope.js'
import { DecryptError, EncryptError, EnvelopeDecodeError } from './errors.js'
import type { ObservabilityEventListener } from './events.js'
import {
  createHubTunnelTransport,
  type HubLike,
  type HubPublishParams,
  type HubReceiveSubscription,
  type HubTunnelTransportParams,
} from './transport.js'

export type EncryptedHubTunnelTransportParams = HubTunnelTransportParams & {
  encryptor: Encryptor
  groupID: string
}

type WrapHubParams = {
  hub: HubLike
  encryptor: Encryptor
  groupID: string
  onEvent?: ObservabilityEventListener
  onEncryptError: (error: EncryptError) => void
}

function wrapHub({ hub, encryptor, groupID, onEvent, onEncryptError }: WrapHubParams): HubLike {
  const wrapped: HubLike = {
    async publish(params: HubPublishParams): Promise<{ sequenceID: string }> {
      let ciphertextBytes: Uint8Array
      try {
        ciphertextBytes = await encryptor.encrypt(params.payload)
      } catch (cause) {
        const err = new EncryptError('encrypt failed', { cause })
        onEncryptError(err)
        throw err
      }
      const envelope: TunnelEnvelope = {
        v: 1,
        groupID,
        ciphertext: toB64(ciphertextBytes),
      }
      return await hub.publish({
        senderDID: params.senderDID,
        topicID: params.topicID,
        payload: encodeEnvelope(envelope),
      })
    },
    subscribe(subscriberDID: string, topicID: string): Promise<void> | void {
      return hub.subscribe(subscriberDID, topicID)
    },
    unsubscribe(subscriberDID: string, topicID: string): Promise<void> | void {
      return hub.unsubscribe?.(subscriberDID, topicID)
    },
    receive(subscriberDID: string): HubReceiveSubscription {
      const inner = hub.receive(subscriberDID)
      const innerIterator = inner[Symbol.asyncIterator]()

      const iterator: AsyncIterator<StoredMessage> = {
        async next(): Promise<IteratorResult<StoredMessage>> {
          while (true) {
            const result = await innerIterator.next()
            if (result.done) {
              return { value: undefined as unknown as StoredMessage, done: true }
            }
            const message = result.value
            let envelope: TunnelEnvelope
            try {
              envelope = decodeEnvelope(message.payload)
            } catch (error) {
              if (error instanceof EnvelopeDecodeError) {
                onEvent?.({ type: 'envelope-decode-failed', error })
                onEvent?.({ type: 'frame-dropped', reason: 'envelope-decode' })
                continue
              }
              throw error
            }
            let plaintext: Uint8Array
            try {
              plaintext = await encryptor.decrypt(fromB64(envelope.ciphertext))
            } catch (cause) {
              const err = new DecryptError('decrypt failed', { cause })
              onEvent?.({ type: 'decrypt-failed', error: err })
              onEvent?.({ type: 'frame-dropped', reason: 'decrypt' })
              continue
            }
            const decrypted: StoredMessage = {
              sequenceID: message.sequenceID,
              senderDID: message.senderDID,
              topicID: message.topicID,
              payload: plaintext,
            }
            return { value: decrypted, done: false }
          }
        },
        return(): Promise<IteratorResult<StoredMessage>> {
          innerIterator.return?.()
          return Promise.resolve({ value: undefined as unknown as StoredMessage, done: true })
        },
      }

      return {
        [Symbol.asyncIterator]() {
          return iterator
        },
        return() {
          inner.return?.()
        },
      }
    },
  }
  if (hub.events != null) {
    wrapped.events = hub.events
  }
  return wrapped
}

export function createEncryptedHubTunnelTransport<R, W>(
  params: EncryptedHubTunnelTransportParams,
): TransportType<R, W> {
  const { hub, encryptor, groupID, onEvent, signal: externalSignal, ...rest } = params

  const internalController = new AbortController()
  if (externalSignal != null) {
    if (externalSignal.aborted) {
      internalController.abort(externalSignal.reason)
    } else {
      externalSignal.addEventListener(
        'abort',
        () => {
          internalController.abort(externalSignal.reason)
        },
        { once: true },
      )
    }
  }

  const wrappedHub = wrapHub({
    hub,
    encryptor,
    groupID,
    onEvent,
    onEncryptError: (err) => {
      internalController.abort(err)
    },
  })

  return createHubTunnelTransport<R, W>({
    ...rest,
    hub: wrappedHub,
    signal: internalController.signal,
    onEvent,
  })
}
```

- [ ] **Step 2: Confirm src compiles**

Run: `pnpm --filter @enkaku/hub-tunnel exec tsc --noEmit -p tsconfig.json`
Expected: PASS for all of `src/`. (Tests are migrated in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add packages/hub-tunnel/src/encrypted-transport.ts
git commit -m "feat(hub-tunnel): re-base encrypted transport onto topic pub/sub"
```

---

### Task 8: hub-tunnel — fixture + test migration (closes the breaking window)

**Files:**
- Modify: `packages/hub-tunnel/test/fixtures/fake-hub.ts`
- Modify: ALL 18 `packages/hub-tunnel/test/*.test.ts` files.

**Interfaces:**
- Consumes: the new `HubLike` / `HubTunnelTransportParams` shapes (Tasks 6, 7); `StoredMessage` (Task 1).

> This is the one task where exhaustive transcription of every file is impractical. It provides: (1) the fully-rewritten `FakeHub` fixture, (2) two fully-rewritten worked example test files, (3) precise mechanical migration rules, and (4) a green-test gate that proves the sweep is complete.

**Migration rules (apply to every `*.test.ts` that constructs a tunnel transport):**

1. **Topic pair instead of `peerDID`.** A tunnel pair shares two topic IDs that cross. Declare `const topicA = 'topic:a'` and `const topicB = 'topic:b'`. The "server" side uses `{ sendTopicID: topicB, receiveTopicID: topicA }`; the "client" side uses `{ sendTopicID: topicA, receiveTopicID: topicB }`. Remove every `peerDID:` line. Keep `localDID:` as-is.
2. **`hub.send(...)` → `hub.publish(...)`.** Replace `hub.send({ senderDID, recipients: [X], payload })` with `hub.publish({ senderDID, topicID: T, payload })` where `T` is the topic the receiving side subscribes to.
3. **`groupID` assertions → `topicID`.** Any test asserting `message.groupID` becomes `message.topicID`.
4. **Subscribe before expecting delivery.** When a test pushes directly through the FakeHub (not via a tunnel transport, which now auto-subscribes), call `hub.subscribe(receiverDID, topicID)` before `hub.publish` so the FakeHub routes it.
5. **`hub.disconnect(DID)` stays unchanged.**
6. **`'sender-mismatch'` event reason → `'topic-mismatch'`** anywhere a test asserts a dropped-frame reason.

- [ ] **Step 1: Rewrite the FakeHub fixture**

Replace the entire contents of `packages/hub-tunnel/test/fixtures/fake-hub.ts` with:

```typescript
import type { StoredMessage } from '@enkaku/hub-protocol'

import type { HubLikeEvent, HubLikeEventListener, HubPublishParams } from '../../src/transport.js'

export type FakeHubPublishParams = HubPublishParams
export type FakeHubMessage = StoredMessage

type Subscriber = {
  push: (message: FakeHubMessage) => void
  close: () => void
}

type DeliveryAction =
  | { kind: 'normal' }
  | { kind: 'drop' }
  | { kind: 'duplicate' }
  | { kind: 'delay'; ms: number }
  | { kind: 'swap-hold' }
  | { kind: 'swap-flush' }

export class FakeHub {
  #sequence = 0
  // subscriberDID → set of live receive streams
  #subscribers = new Map<string, Set<Subscriber>>()
  // topicID → set of subscriberDIDs
  #topics = new Map<string, Set<string>>()
  #pendingDrops = 0
  #pendingDuplicates = 0
  #pendingDelays: Array<number> = []
  #pendingSwap = 0
  #heldForSwap: Array<{ recipient: string; message: FakeHubMessage }> = []
  #eventListeners = new Set<HubLikeEventListener>()

  events = {
    subscribe: (listener: HubLikeEventListener): (() => void) => {
      this.#eventListeners.add(listener)
      return () => {
        this.#eventListeners.delete(listener)
      }
    },
  }

  #emitEvent(event: HubLikeEvent): void {
    for (const listener of this.#eventListeners) {
      listener(event)
    }
  }

  simulateReconnecting(): void {
    this.#emitEvent({ type: 'reconnecting' })
  }

  simulateConnected(): void {
    this.#emitEvent({ type: 'connected' })
  }

  simulateDisconnected(): void {
    this.#emitEvent({ type: 'disconnected' })
  }

  subscribe(subscriberDID: string, topicID: string): void {
    let set = this.#topics.get(topicID)
    if (set == null) {
      set = new Set()
      this.#topics.set(topicID, set)
    }
    set.add(subscriberDID)
  }

  unsubscribe(subscriberDID: string, topicID: string): void {
    const set = this.#topics.get(topicID)
    if (set == null) return
    set.delete(subscriberDID)
    if (set.size === 0) {
      this.#topics.delete(topicID)
    }
  }

  async publish(params: FakeHubPublishParams): Promise<{ sequenceID: string }> {
    const sequenceID = String(++this.#sequence)
    const message: FakeHubMessage = {
      sequenceID,
      senderDID: params.senderDID,
      topicID: params.topicID,
      payload: params.payload,
    }

    const recipients = this.#topics.get(params.topicID)
    if (recipients != null) {
      for (const recipient of recipients) {
        const action = this.#nextAction()
        this.#deliver(recipient, message, action)
      }
    }

    return { sequenceID }
  }

  receive(subscriberDID: string): AsyncIterable<FakeHubMessage> & { return: () => void } {
    const queue: Array<FakeHubMessage> = []
    const waiters: Array<(value: IteratorResult<FakeHubMessage>) => void> = []
    let closed = false

    const subscriber: Subscriber = {
      push(message) {
        if (closed) return
        const waiter = waiters.shift()
        if (waiter != null) {
          waiter({ value: message, done: false })
        } else {
          queue.push(message)
        }
      },
      close() {
        if (closed) return
        closed = true
        while (waiters.length > 0) {
          const w = waiters.shift()
          w?.({ value: undefined as unknown as FakeHubMessage, done: true })
        }
      },
    }

    let set = this.#subscribers.get(subscriberDID)
    if (set == null) {
      set = new Set()
      this.#subscribers.set(subscriberDID, set)
    }
    set.add(subscriber)

    const detach = (): void => {
      const current = this.#subscribers.get(subscriberDID)
      if (current != null) {
        current.delete(subscriber)
        if (current.size === 0) {
          this.#subscribers.delete(subscriberDID)
        }
      }
    }

    const iterator: AsyncIterator<FakeHubMessage> = {
      next() {
        if (queue.length > 0) {
          const value = queue.shift() as FakeHubMessage
          return Promise.resolve({ value, done: false })
        }
        if (closed) {
          return Promise.resolve({ value: undefined as unknown as FakeHubMessage, done: true })
        }
        return new Promise((resolve) => {
          waiters.push(resolve)
        })
      },
      return() {
        subscriber.close()
        detach()
        return Promise.resolve({ value: undefined as unknown as FakeHubMessage, done: true })
      },
    }

    return {
      [Symbol.asyncIterator]() {
        return iterator
      },
      return() {
        subscriber.close()
        detach()
      },
    }
  }

  subscriberCount(subscriberDID: string): number {
    const set = this.#subscribers.get(subscriberDID)
    return set == null ? 0 : set.size
  }

  disconnect(subscriberDID: string): void {
    const set = this.#subscribers.get(subscriberDID)
    if (set == null) return
    for (const subscriber of set) {
      subscriber.close()
    }
    this.#subscribers.delete(subscriberDID)
  }

  dropNext(n: number): void {
    this.#pendingDrops += n
  }

  duplicateNext(n: number): void {
    this.#pendingDuplicates += n
  }

  delayNext(ms: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.#pendingDelays.push(ms)
    }
  }

  swapNextPair(): void {
    this.#pendingSwap = 2
  }

  #nextAction(): DeliveryAction {
    if (this.#pendingDrops > 0) {
      this.#pendingDrops--
      return { kind: 'drop' }
    }
    if (this.#pendingDuplicates > 0) {
      this.#pendingDuplicates--
      return { kind: 'duplicate' }
    }
    if (this.#pendingDelays.length > 0) {
      const ms = this.#pendingDelays.shift() as number
      return { kind: 'delay', ms }
    }
    if (this.#pendingSwap > 0) {
      this.#pendingSwap--
      return this.#pendingSwap === 0 ? { kind: 'swap-flush' } : { kind: 'swap-hold' }
    }
    return { kind: 'normal' }
  }

  #deliver(recipient: string, message: FakeHubMessage, action: DeliveryAction): void {
    const subscribers = this.#subscribers.get(recipient)
    if (subscribers == null || subscribers.size === 0) return

    const push = (): void => {
      for (const sub of subscribers) {
        sub.push(message)
      }
    }

    switch (action.kind) {
      case 'drop':
        return
      case 'normal':
        push()
        return
      case 'duplicate':
        push()
        push()
        return
      case 'delay':
        setTimeout(push, action.ms)
        return
      case 'swap-hold':
        this.#heldForSwap.push({ recipient, message })
        return
      case 'swap-flush': {
        push()
        const held = this.#heldForSwap.splice(0)
        for (const { recipient: r, message: m } of held) {
          const subs = this.#subscribers.get(r)
          if (subs == null) continue
          for (const sub of subs) {
            sub.push(m)
          }
        }
        return
      }
    }
  }
}
```

> Note: the `createHubTunnelTransport` constructor auto-calls `hub.subscribe(localDID, receiveTopicID)`, so a transport's own inbox routing is wired automatically. Tests that push messages directly through the FakeHub (without a tunnel transport on the receiving side) must call `hub.subscribe(receiverDID, topicID)` explicitly (rule 4).

- [ ] **Step 2: Worked example — rewrite `test/transport.test.ts`**

Replace the entire contents of `packages/hub-tunnel/test/transport.test.ts` with:

```typescript
import { Client } from '@enkaku/client'
import { serve } from '@enkaku/server'
import { randomIdentity } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import { createHubTunnelTransport } from '../src/transport.js'

import {
  type EchoClientMessage,
  type EchoProtocol,
  type EchoServerMessage,
  echoHandlers,
} from './fixtures/echo-protocol.js'
import { FakeHub } from './fixtures/fake-hub.js'

describe('createHubTunnelTransport', () => {
  test('echo/ping round-trips end-to-end via tunnel + FakeHub', async () => {
    const hub = new FakeHub()
    const sessionID = 's1'
    const serverDID = 'did:peer:server'
    const clientDID = 'did:peer:client'
    const topicToServer = 'topic:to-server'
    const topicToClient = 'topic:to-client'

    const serverTransport = createHubTunnelTransport<EchoClientMessage, EchoServerMessage>({
      hub,
      sessionID,
      localDID: serverDID,
      sendTopicID: topicToClient,
      receiveTopicID: topicToServer,
    })
    const clientTransport = createHubTunnelTransport<EchoServerMessage, EchoClientMessage>({
      hub,
      sessionID,
      localDID: clientDID,
      sendTopicID: topicToServer,
      receiveTopicID: topicToClient,
    })

    const server = serve<EchoProtocol>({
      handlers: echoHandlers,
      requireAuth: false,
      transport: serverTransport,
    })
    const client = new Client<EchoProtocol>({
      transport: clientTransport,
      identity: randomIdentity(),
    })

    try {
      const result = await client.request('echo/ping', { param: { msg: 'hi' } })
      expect(result).toEqual({ msg: 'hi' })
    } finally {
      try {
        await client.dispose()
      } catch {
        // ignore
      }
      try {
        await server.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(serverDID)
      hub.disconnect(clientDID)
    }
  })
})
```

- [ ] **Step 3: Worked example — rewrite `test/fake-hub.test.ts`**

Replace the entire contents of `packages/hub-tunnel/test/fake-hub.test.ts` with:

```typescript
import { describe, expect, test } from 'vitest'

import { FakeHub, type FakeHubMessage } from './fixtures/fake-hub.js'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

async function collect(
  iterable: AsyncIterable<FakeHubMessage>,
  count: number,
): Promise<Array<FakeHubMessage>> {
  const out: Array<FakeHubMessage> = []
  for await (const message of iterable) {
    out.push(message)
    if (out.length >= count) break
  }
  return out
}

describe('FakeHub fixture', () => {
  test('delivers frames in order from publisher to subscriber', async () => {
    const hub = new FakeHub()
    const a = 'did:key:alice'
    const b = 'did:key:bob'
    const topic = 'topic:t'

    hub.subscribe(b, topic)
    const subscription = hub.receive(b)
    const received = collect(subscription, 5)

    for (let i = 0; i < 5; i++) {
      await hub.publish({ senderDID: a, topicID: topic, payload: textEncoder.encode(`msg-${i}`) })
    }

    const messages = await received
    expect(messages).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      expect(messages[i].senderDID).toBe(a)
      expect(messages[i].topicID).toBe(topic)
      expect(textDecoder.decode(messages[i].payload)).toBe(`msg-${i}`)
    }
    subscription.return()
  })

  test('dropNext skips the next outbound delivery', async () => {
    const hub = new FakeHub()
    const a = 'did:key:alice'
    const b = 'did:key:bob'
    const topic = 'topic:t'

    hub.subscribe(b, topic)
    const subscription = hub.receive(b)
    const received = collect(subscription, 4)

    hub.dropNext(1)
    for (let i = 0; i < 5; i++) {
      await hub.publish({ senderDID: a, topicID: topic, payload: textEncoder.encode(`msg-${i}`) })
    }

    const messages = await received
    expect(messages).toHaveLength(4)
    expect(messages.map((m) => textDecoder.decode(m.payload))).toEqual([
      'msg-1',
      'msg-2',
      'msg-3',
      'msg-4',
    ])
    subscription.return()
  })

  test('disconnect closes the receive iterator for the device', async () => {
    const hub = new FakeHub()
    const b = 'did:key:bob'
    const subscription = hub.receive(b)
    const iterator = subscription[Symbol.asyncIterator]()

    const next = iterator.next()
    hub.disconnect(b)
    const result = await next
    expect(result.done).toBe(true)
  })
})
```

- [ ] **Step 4: Migrate the remaining 16 test files**

Apply the migration rules (above) to each of these, reading the current file and transforming it in place:

```
packages/hub-tunnel/test/transport-auto-session.test.ts
packages/hub-tunnel/test/transport-backpressure.test.ts
packages/hub-tunnel/test/transport-channel.test.ts
packages/hub-tunnel/test/transport-concurrent.test.ts
packages/hub-tunnel/test/transport-lifecycle.test.ts
packages/hub-tunnel/test/transport-ordering.test.ts
packages/hub-tunnel/test/transport-reconnect.test.ts
packages/hub-tunnel/test/encrypted-transport.test.ts
packages/hub-tunnel/test/encrypted-transport-decrypt-fail.test.ts
packages/hub-tunnel/test/encrypted-transport-e2e.test.ts
packages/hub-tunnel/test/encrypted-transport-encrypt-fail.test.ts
packages/hub-tunnel/test/encrypted-transport-observability.test.ts
packages/hub-tunnel/test/encrypted-transport-opacity.test.ts
packages/hub-tunnel/test/encrypted-transport-tampered.test.ts
packages/hub-tunnel/test/echo-protocol.test.ts
packages/hub-tunnel/test/frame.test.ts
```

(`frame.test.ts` and `echo-protocol.test.ts` matched 0 occurrences of `peerDID`/`localDID`/`recipients` in the survey — verify they still compile against the new types; they likely need no change beyond confirming imports. `envelope.test.ts` and `fake-encryptor.test.ts` similarly need no change but must still pass.)

- [ ] **Step 5: Run the hub-tunnel suite until green**

Run: `pnpm --filter @enkaku/hub-tunnel run test`
Expected: PASS (type check + all `vitest` files). Iterate on any file the run flags until the whole suite is green.

- [ ] **Step 6: Cross-package green gate (closes the breaking window)**

Run all three package suites and the workspace lint:

```bash
pnpm --filter @enkaku/hub-protocol run test
pnpm --filter @enkaku/hub-server run test
pnpm --filter @enkaku/hub-tunnel run test
rtk proxy pnpm run lint
```

Expected: all PASS. Optionally run a repo-wide type check (`pnpm run build` or the equivalent type task) to confirm no other package referenced the removed procedures.

- [ ] **Step 7: Commit**

```bash
git add packages/hub-tunnel/test
git commit -m "test(hub-tunnel): migrate fixture and suite to topic pub/sub API"
```

---

## Notes for the implementer

- **Do not** reintroduce `groupID`, `recipients`, or any `hub/group/*` / `hub/send` symbol — they are removed deliberately (single breaking release).
- The `Date.now()` calls in `memoryStore.ts` (`storedAt`, `purge` threshold) and `rateLimit.ts` are intentional and fine; the `rateLimit` tests drive them with vitest fake timers.
- `hub/receive` keeps the existing writer-bind guard and error-cleanup structure exactly — only the message shape (`topicID` instead of `groupID`, no group filter) changes.
- The tunnel's `localDID` is an auth/drain identity, not a routing key. Routing is entirely by `sendTopicID` / `receiveTopicID`.
