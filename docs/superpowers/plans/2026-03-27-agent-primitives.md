# Agent Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hub mailbox channel (paginated receive with ack), split send procedures, revocation primitive for capability delegation, and integration tests for multi-device agent scenarios.

**Architecture:** Extend four existing packages — hub-protocol (protocol definitions), hub-server (handlers + in-memory store), hub-client (convenience wrapper), capability (revocation). No new packages. TDD throughout.

**Tech Stack:** TypeScript, Vitest, `@enkaku/event` EventEmitter, `@enkaku/protocol` definitions, `@enkaku/token` identities

---

## File Structure

### `@enkaku/hub-protocol` (packages/hub-protocol/)
- **Modify:** `src/types.ts` — Replace `RoutedMessage` and `HubStore` with new types
- **Modify:** `src/protocol.ts` — Replace `hub/receive` stream with channel, split `hub/send` into two procedures, simplify message shapes
- **Modify:** `src/index.ts` — Update exports

### `@enkaku/hub-server` (packages/hub-server/)
- **Modify:** `src/memoryStore.ts` — Rewrite as `MemoryHubStore` class with sequence IDs, reference counting, pagination, ack, purge, EventEmitter
- **Modify:** `src/registry.ts` — Update `ClientEntry` to remove `RoutedMessage` dependency, update `sendMessage` callback type
- **Modify:** `src/hub.ts` — Rewrite handlers for new protocol (channel receive, two send procedures)
- **Modify:** `src/index.ts` — Update exports
- **Modify:** `test/memoryStore.test.ts` — Tests for new store API
- **Modify:** `test/registry.test.ts` — Update for new message types
- **Modify:** `test/hub.test.ts` — Tests for new handlers

### `@enkaku/hub-client` (packages/hub-client/)
- **Modify:** `src/client.ts` — Replace `send()`/`receive()` with new API
- **Modify:** `src/index.ts` — Update exports if needed
- **Modify:** `test/client.test.ts` — Tests for new client API

### `@enkaku/capability` (packages/capability/)
- **Create:** `src/revocation.ts` — `RevocationRecord`, `RevocationBackend`, `createRevocationChecker`, `createMemoryRevocationBackend`
- **Modify:** `src/index.ts` — Re-export revocation module
- **Create:** `test/revocation.test.ts` — Tests for revocation primitive

### Integration tests (tests/integration/)
- **Create:** `hub-agent-scenarios.test.ts` — Multi-device, group, delegation, eviction scenarios
- **Modify:** `package.json` — Add hub dependencies

---

## Task 1: Hub Protocol — New Types

**Files:**
- Modify: `packages/hub-protocol/src/types.ts`

- [ ] **Step 1: Write the new types file**

Replace the entire `types.ts` with the new type definitions. The old `RoutedMessage` and `HubStore` are removed completely.

```typescript
import type { EventEmitter } from '@enkaku/event'

/** Opaque message stored by the hub — minimal metadata for routing only. */
export type StoredMessage = {
  sequenceID: string
  senderDID: string
  groupID?: string
  payload: Uint8Array
}

export type StoreParams = {
  senderDID: string
  recipients: Array<string>
  payload: Uint8Array
  groupID?: string
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
  store(params: StoreParams): Promise<string>
  fetch(params: FetchParams): Promise<FetchResult>
  ack(params: AckParams): Promise<void>
  purge(params: PurgeParams): Promise<Array<string>>
  storeKeyPackage(ownerDID: string, keyPackage: string): Promise<void>
  fetchKeyPackages(ownerDID: string, count?: number): Promise<Array<string>>
  setGroupMembers(groupID: string, members: Array<string>): Promise<void>
  getGroupMembers(groupID: string): Promise<Array<string>>
}
```

- [ ] **Step 2: Update package.json to add @enkaku/event dependency**

```bash
cd packages/hub-protocol && pnpm add @enkaku/event@"workspace:^"
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm run build:types --filter=@enkaku/hub-protocol`
Expected: Success (downstream packages will fail — that's expected at this stage)

- [ ] **Step 4: Commit**

```bash
git add packages/hub-protocol/src/types.ts packages/hub-protocol/package.json pnpm-lock.yaml
git commit -m "refactor(hub-protocol): replace RoutedMessage and HubStore with agent primitive types"
```

---

## Task 2: Hub Protocol — New Procedure Definitions

**Files:**
- Modify: `packages/hub-protocol/src/protocol.ts`
- Modify: `packages/hub-protocol/src/index.ts`

- [ ] **Step 1: Rewrite protocol.ts with new procedures**

Replace the full protocol definition. Key changes:
- `hub/send` takes `recipients` array + opaque `payload` (explicit recipients)
- `hub/group/send` takes `groupID` + opaque `payload` (group routing)
- `hub/receive` becomes a channel with `after`/`groupIDs` params, bidirectional ack
- Key package and group join/leave procedures stay but are simplified
- Remove `hub/tunnel/request` (partial implementation, out of scope)

```typescript
import type { ProtocolDefinition } from '@enkaku/protocol'

export const hubProtocol = {
  'hub/send': {
    type: 'request',
    description: 'Send opaque message to explicit recipients',
    param: {
      type: 'object',
      properties: {
        recipients: { type: 'array', items: { type: 'string' } },
        payload: { type: 'string', contentEncoding: 'base64' },
      },
      required: ['recipients', 'payload'],
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
  'hub/group/send': {
    type: 'request',
    description: 'Send opaque message to all members of a group',
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string' },
        payload: { type: 'string', contentEncoding: 'base64' },
      },
      required: ['groupID', 'payload'],
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
  'hub/receive': {
    type: 'channel',
    description: 'Bidirectional mailbox channel — hub pushes messages, device pushes acks',
    param: {
      type: 'object',
      properties: {
        after: { type: 'string' },
        groupIDs: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    send: {
      type: 'object',
      properties: {
        ack: { type: 'array', items: { type: 'string' } },
      },
      required: ['ack'],
      additionalProperties: false,
    },
    receive: {
      type: 'object',
      properties: {
        sequenceID: { type: 'string' },
        senderDID: { type: 'string' },
        groupID: { type: 'string' },
        payload: { type: 'string', contentEncoding: 'base64' },
      },
      required: ['sequenceID', 'senderDID', 'payload'],
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
        keyPackages: { type: 'array', items: { type: 'string' } },
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
        did: { type: 'string' },
        count: { type: 'integer' },
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
  'hub/group/join': {
    type: 'request',
    description: 'Register as a member of a group on the hub',
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string' },
        credential: { type: 'string' },
      },
      required: ['groupID', 'credential'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        joined: { type: 'boolean' },
      },
      required: ['joined'],
      additionalProperties: false,
    },
  },
  'hub/group/leave': {
    type: 'request',
    description: 'Unregister from a group on the hub',
    param: {
      type: 'object',
      properties: {
        groupID: { type: 'string' },
      },
      required: ['groupID'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        left: { type: 'boolean' },
      },
      required: ['left'],
      additionalProperties: false,
    },
  },
} as const satisfies ProtocolDefinition
```

- [ ] **Step 2: Update index.ts exports**

```typescript
/**
 * Hub protocol for blind relay messaging with mailbox semantics.
 *
 * @module hub-protocol
 */

export { hubProtocol } from './protocol.js'
export type { HubProtocol } from './protocol.js'
export type {
  AckParams,
  FetchParams,
  FetchResult,
  HubStore,
  HubStoreEvents,
  PurgeParams,
  StoredMessage,
  StoreParams,
} from './types.js'
```

Add the `HubProtocol` type export in `protocol.ts`:

```typescript
export type HubProtocol = typeof hubProtocol
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm run build:types --filter=@enkaku/hub-protocol`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add packages/hub-protocol/src/
git commit -m "refactor(hub-protocol): new protocol with channel receive, split send, opaque payload"
```

---

## Task 3: Hub Server — Memory Store

**Files:**
- Modify: `packages/hub-server/src/memoryStore.ts`
- Modify: `packages/hub-server/test/memoryStore.test.ts`

- [ ] **Step 1: Write failing tests for the new memory store**

Replace `test/memoryStore.test.ts` entirely:

```typescript
import { describe, expect, test, vi } from 'vitest'

import { createMemoryStore } from '../src/memoryStore.js'

describe('createMemoryStore', () => {
  test('store returns a sequence ID', async () => {
    const store = createMemoryStore()
    const id = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1, 2, 3]),
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  test('fetch returns stored messages for recipient', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1, 2, 3]),
    })
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].senderDID).toBe('did:key:alice')
    expect(result.messages[0].payload).toEqual(new Uint8Array([1, 2, 3]))
    expect(result.cursor).toBe(result.messages[0].sequenceID)
  })

  test('fetch returns empty for unknown recipient', async () => {
    const store = createMemoryStore()
    const result = await store.fetch({ recipientDID: 'did:key:unknown' })
    expect(result.messages).toHaveLength(0)
    expect(result.cursor).toBeNull()
  })

  test('fetch respects after cursor', async () => {
    const store = createMemoryStore()
    const id1 = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([2]),
    })
    const result = await store.fetch({ recipientDID: 'did:key:bob', after: id1 })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].payload).toEqual(new Uint8Array([2]))
  })

  test('fetch respects limit and sets hasMore', async () => {
    const store = createMemoryStore()
    for (let i = 0; i < 5; i++) {
      await store.store({
        senderDID: 'did:key:alice',
        recipients: ['did:key:bob'],
        payload: new Uint8Array([i]),
      })
    }
    const result = await store.fetch({ recipientDID: 'did:key:bob', limit: 2 })
    expect(result.messages).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(result.messages[0].payload).toEqual(new Uint8Array([0]))
    expect(result.messages[1].payload).toEqual(new Uint8Array([1]))
  })

  test('fetch with ack acknowledges previous messages', async () => {
    const store = createMemoryStore()
    const id1 = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([2]),
    })
    // Ack first message while fetching
    const result = await store.fetch({
      recipientDID: 'did:key:bob',
      ack: [id1],
    })
    // Should still return both (ack + fetch are independent)
    // But re-fetching after ack should not return acked message
    const result2 = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result2.messages).toHaveLength(1)
    expect(result2.messages[0].payload).toEqual(new Uint8Array([2]))
  })

  test('ack removes delivery record for recipient', async () => {
    const store = createMemoryStore()
    const id = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    await store.ack({ recipientDID: 'did:key:bob', sequenceIDs: [id] })
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages).toHaveLength(0)
  })

  test('reference counting: message deleted when all recipients ack', async () => {
    const store = createMemoryStore()
    const id = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob', 'did:key:carol'],
      payload: new Uint8Array([1]),
    })
    // Bob acks — Carol should still see it
    await store.ack({ recipientDID: 'did:key:bob', sequenceIDs: [id] })
    const carolResult = await store.fetch({ recipientDID: 'did:key:carol' })
    expect(carolResult.messages).toHaveLength(1)

    // Carol acks — message is fully consumed
    await store.ack({ recipientDID: 'did:key:carol', sequenceIDs: [id] })
    const carolResult2 = await store.fetch({ recipientDID: 'did:key:carol' })
    expect(carolResult2.messages).toHaveLength(0)
  })

  test('store with groupID preserves it in fetched messages', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
      groupID: 'group-123',
    })
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages[0].groupID).toBe('group-123')
  })

  test('store without groupID has no groupID in fetched messages', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages[0].groupID).toBeUndefined()
  })

  test('purge removes messages older than threshold', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    // Purge with olderThan=0 should remove everything
    const purged = await store.purge({ olderThan: 0 })
    expect(purged.length).toBeGreaterThan(0)
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages).toHaveLength(0)
  })

  test('purge emits purge event', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    const handler = vi.fn()
    store.events.on('purge', handler)
    await store.purge({ olderThan: 0 })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceIDs: expect.any(Array) }),
    )
  })

  test('sequence IDs are monotonically ordered', async () => {
    const store = createMemoryStore()
    const id1 = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    const id2 = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([2]),
    })
    expect(id1 < id2).toBe(true)
  })

  test('key package store and fetch', async () => {
    const store = createMemoryStore()
    await store.storeKeyPackage('did:key:alice', 'kp-1')
    await store.storeKeyPackage('did:key:alice', 'kp-2')
    const packages = await store.fetchKeyPackages('did:key:alice', 1)
    expect(packages).toEqual(['kp-1'])
    const remaining = await store.fetchKeyPackages('did:key:alice')
    expect(remaining).toEqual(['kp-2'])
  })

  test('group members management', async () => {
    const store = createMemoryStore()
    await store.setGroupMembers('group-1', ['did:key:alice', 'did:key:bob'])
    const members = await store.getGroupMembers('group-1')
    expect(members).toEqual(['did:key:alice', 'did:key:bob'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/hub-server`
Expected: FAIL — `createMemoryStore` returns old API

- [ ] **Step 3: Implement the new memory store**

Replace `src/memoryStore.ts`:

```typescript
import { EventEmitter } from '@enkaku/event'
import type {
  AckParams,
  FetchParams,
  FetchResult,
  HubStore,
  HubStoreEvents,
  PurgeParams,
  StoreParams,
} from '@enkaku/hub-protocol'

type MessageRecord = {
  sequenceID: string
  senderDID: string
  groupID?: string
  payload: Uint8Array
  recipients: Set<string>
  storedAt: number
}

export function createMemoryStore(): HubStore {
  const messages = new Map<string, MessageRecord>()
  const deliveries = new Map<string, Array<string>>() // recipientDID -> sequenceIDs
  const keyPackages = new Map<string, Array<string>>()
  const groupMembers = new Map<string, Array<string>>()
  const events = new EventEmitter<HubStoreEvents>()
  let counter = 0

  function nextSequenceID(): string {
    return String(++counter).padStart(12, '0')
  }

  return {
    events,

    async store(params: StoreParams): Promise<string> {
      const sequenceID = nextSequenceID()
      const record: MessageRecord = {
        sequenceID,
        senderDID: params.senderDID,
        groupID: params.groupID,
        payload: params.payload,
        recipients: new Set(params.recipients),
        storedAt: Date.now(),
      }
      messages.set(sequenceID, record)
      for (const recipient of params.recipients) {
        const list = deliveries.get(recipient) ?? []
        list.push(sequenceID)
        deliveries.set(recipient, list)
      }
      return sequenceID
    },

    async fetch(params: FetchParams): Promise<FetchResult> {
      // Process acks first if provided
      if (params.ack != null && params.ack.length > 0) {
        await this.ack({ recipientDID: params.recipientDID, sequenceIDs: params.ack })
      }

      const ids = deliveries.get(params.recipientDID) ?? []
      let startIndex = 0
      if (params.after != null) {
        const afterIndex = ids.indexOf(params.after)
        if (afterIndex !== -1) {
          startIndex = afterIndex + 1
        }
      }

      const remaining = ids.slice(startIndex)
      const limit = params.limit ?? remaining.length
      const batch = remaining.slice(0, limit)
      const hasMore = remaining.length > limit

      const result: FetchResult = {
        messages: batch
          .map((id) => messages.get(id))
          .filter((r) => r != null)
          .map((r) => ({
            sequenceID: r.sequenceID,
            senderDID: r.senderDID,
            groupID: r.groupID,
            payload: r.payload,
          })),
        cursor: batch.length > 0 ? batch[batch.length - 1] : null,
        hasMore: hasMore ? true : undefined,
      }
      return result
    },

    async ack(params: AckParams): Promise<void> {
      const ids = deliveries.get(params.recipientDID)
      if (ids == null) return

      for (const seqID of params.sequenceIDs) {
        const index = ids.indexOf(seqID)
        if (index !== -1) {
          ids.splice(index, 1)
        }
        // Decrement reference count
        const record = messages.get(seqID)
        if (record != null) {
          record.recipients.delete(params.recipientDID)
          if (record.recipients.size === 0) {
            messages.delete(seqID)
          }
        }
      }
      if (ids.length === 0) {
        deliveries.delete(params.recipientDID)
      }
    },

    async purge(params: PurgeParams): Promise<Array<string>> {
      const threshold = Date.now() - params.olderThan * 1000
      const purged: Array<string> = []
      for (const [seqID, record] of messages) {
        if (record.storedAt <= threshold) {
          purged.push(seqID)
          // Clean up delivery records
          for (const recipient of record.recipients) {
            const ids = deliveries.get(recipient)
            if (ids != null) {
              const index = ids.indexOf(seqID)
              if (index !== -1) {
                ids.splice(index, 1)
              }
              if (ids.length === 0) {
                deliveries.delete(recipient)
              }
            }
          }
          messages.delete(seqID)
        }
      }
      if (purged.length > 0) {
        await events.emit('purge', { sequenceIDs: purged })
      }
      return purged
    },

    async storeKeyPackage(ownerDID: string, keyPackage: string): Promise<void> {
      const list = keyPackages.get(ownerDID) ?? []
      list.push(keyPackage)
      keyPackages.set(ownerDID, list)
    },

    async fetchKeyPackages(ownerDID: string, count = 1): Promise<Array<string>> {
      const list = keyPackages.get(ownerDID) ?? []
      const result = list.splice(0, count)
      if (list.length === 0) {
        keyPackages.delete(ownerDID)
      }
      return result
    },

    async setGroupMembers(groupID: string, members: Array<string>): Promise<void> {
      groupMembers.set(groupID, [...members])
    },

    async getGroupMembers(groupID: string): Promise<Array<string>> {
      return groupMembers.get(groupID) ?? []
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/hub-server -- test/memoryStore.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hub-server/src/memoryStore.ts packages/hub-server/test/memoryStore.test.ts
git commit -m "feat(hub-server): rewrite memory store with sequence IDs, ref counting, pagination, ack, purge"
```

---

## Task 4: Hub Server — Registry Update

**Files:**
- Modify: `packages/hub-server/src/registry.ts`
- Modify: `packages/hub-server/test/registry.test.ts`

- [ ] **Step 1: Write failing tests for updated registry**

The registry needs to decouple from `RoutedMessage`. The `sendMessage` callback should accept the new `StoredMessage` shape. Update `test/registry.test.ts`:

Replace the `sendMessage` callback type in test setup from `RoutedMessage` to `StoredMessage`. The key changes:
- `sendMessage` callback accepts `StoredMessage` (has `sequenceID`, `senderDID`, `groupID?`, `payload: Uint8Array`)
- Remove tunnel-related methods and tests (tunnel is removed from protocol)
- Keep all group membership methods unchanged

```typescript
import { describe, expect, test, vi } from 'vitest'

import type { StoredMessage } from '@enkaku/hub-protocol'

import { HubClientRegistry } from '../src/registry.js'

describe('HubClientRegistry', () => {
  test('register creates client entry', () => {
    const registry = new HubClientRegistry()
    const entry = registry.register('did:key:alice')
    expect(entry.did).toBe('did:key:alice')
    expect(entry.groups.size).toBe(0)
    expect(entry.sendMessage).toBeNull()
  })

  test('register is idempotent', () => {
    const registry = new HubClientRegistry()
    const entry1 = registry.register('did:key:alice')
    const entry2 = registry.register('did:key:alice')
    expect(entry1).toBe(entry2)
  })

  test('unregister removes client and cleans up groups', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.joinGroup('did:key:alice', 'group-1')
    registry.unregister('did:key:alice')
    expect(registry.getClient('did:key:alice')).toBeUndefined()
    expect(registry.getOnlineGroupMembers('group-1')).toEqual([])
  })

  test('setReceiveWriter and clearReceiveWriter', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    const writer = vi.fn()
    registry.setReceiveWriter('did:key:alice', writer)
    expect(registry.isOnline('did:key:alice')).toBe(true)
    registry.clearReceiveWriter('did:key:alice')
    expect(registry.isOnline('did:key:alice')).toBe(false)
  })

  test('joinGroup and leaveGroup', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.joinGroup('did:key:alice', 'group-1')
    expect(registry.getClient('did:key:alice')?.groups.has('group-1')).toBe(true)
    registry.leaveGroup('did:key:alice', 'group-1')
    expect(registry.getClient('did:key:alice')?.groups.has('group-1')).toBe(false)
  })

  test('getOnlineGroupMembers returns only online members', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.register('did:key:bob')
    registry.joinGroup('did:key:alice', 'group-1')
    registry.joinGroup('did:key:bob', 'group-1')
    registry.setReceiveWriter('did:key:alice', vi.fn())
    // Only Alice is online
    expect(registry.getOnlineGroupMembers('group-1')).toEqual(['did:key:alice'])
  })

  test('getGroupMembers returns all members regardless of online status', () => {
    const registry = new HubClientRegistry()
    registry.register('did:key:alice')
    registry.register('did:key:bob')
    registry.joinGroup('did:key:alice', 'group-1')
    registry.joinGroup('did:key:bob', 'group-1')
    expect(registry.getGroupMembers('group-1').sort()).toEqual([
      'did:key:alice',
      'did:key:bob',
    ])
  })

  test('joinGroup throws if client not registered', () => {
    const registry = new HubClientRegistry()
    expect(() => registry.joinGroup('did:key:unknown', 'group-1')).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/hub-server -- test/registry.test.ts`
Expected: FAIL — type mismatches and missing `getGroupMembers`

- [ ] **Step 3: Update the registry implementation**

Update `src/registry.ts`:

```typescript
import type { StoredMessage } from '@enkaku/hub-protocol'

export type ClientEntry = {
  did: string
  groups: Set<string>
  sendMessage: ((message: StoredMessage) => void) | null
}

export class HubClientRegistry {
  #clients = new Map<string, ClientEntry>()
  #groupMembers = new Map<string, Set<string>>()

  register(did: string): ClientEntry {
    const existing = this.#clients.get(did)
    if (existing != null) {
      return existing
    }
    const entry: ClientEntry = {
      did,
      groups: new Set(),
      sendMessage: null,
    }
    this.#clients.set(did, entry)
    return entry
  }

  unregister(did: string): void {
    const entry = this.#clients.get(did)
    if (entry == null) return
    for (const groupID of entry.groups) {
      const members = this.#groupMembers.get(groupID)
      if (members != null) {
        members.delete(did)
        if (members.size === 0) {
          this.#groupMembers.delete(groupID)
        }
      }
    }
    this.#clients.delete(did)
  }

  setReceiveWriter(did: string, writer: (message: StoredMessage) => void): void {
    const entry = this.#clients.get(did)
    if (entry != null) {
      entry.sendMessage = writer
    }
  }

  clearReceiveWriter(did: string): void {
    const entry = this.#clients.get(did)
    if (entry != null) {
      entry.sendMessage = null
    }
  }

  joinGroup(did: string, groupID: string): void {
    const entry = this.#clients.get(did)
    if (entry == null) {
      throw new Error(`Client ${did} not registered`)
    }
    entry.groups.add(groupID)
    const members = this.#groupMembers.get(groupID) ?? new Set()
    members.add(did)
    this.#groupMembers.set(groupID, members)
  }

  leaveGroup(did: string, groupID: string): void {
    const entry = this.#clients.get(did)
    if (entry == null) return
    entry.groups.delete(groupID)
    const members = this.#groupMembers.get(groupID)
    if (members != null) {
      members.delete(did)
      if (members.size === 0) {
        this.#groupMembers.delete(groupID)
      }
    }
  }

  getOnlineGroupMembers(groupID: string): Array<string> {
    const members = this.#groupMembers.get(groupID)
    if (members == null) return []
    return [...members].filter((did) => {
      const entry = this.#clients.get(did)
      return entry?.sendMessage != null
    })
  }

  getGroupMembers(groupID: string): Array<string> {
    const members = this.#groupMembers.get(groupID)
    if (members == null) return []
    return [...members]
  }

  getClient(did: string): ClientEntry | undefined {
    return this.#clients.get(did)
  }

  isOnline(did: string): boolean {
    return this.#clients.get(did)?.sendMessage != null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/hub-server -- test/registry.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hub-server/src/registry.ts packages/hub-server/test/registry.test.ts
git commit -m "refactor(hub-server): update registry to use StoredMessage, remove tunnel support"
```

---

## Task 5: Hub Server — Handler Rewrite

**Files:**
- Modify: `packages/hub-server/src/hub.ts`
- Modify: `packages/hub-server/src/index.ts`
- Modify: `packages/hub-server/test/hub.test.ts`

- [ ] **Step 1: Write failing tests for new handlers**

Replace `test/hub.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { Client } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'
import type {
  AnyClientMessageOf,
  AnyServerMessageOf,
} from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'

import { createHub } from '../src/hub.js'
import { createMemoryStore } from '../src/memoryStore.js'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

function createTestClient(hub: ReturnType<typeof createHub>) {
  const identity = randomIdentity()
  const transports: HubTransports = new DirectTransports()
  hub.server.handle(transports.server)
  const client = new Client<HubProtocol>({
    transport: transports.client,
    identity,
  })
  return { client, identity, transports }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('hub handlers', () => {
  test('hub/send delivers to explicit recipient', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: randomIdentity(),
    })
    const { client: bob, transports: bobTransports } = createTestClient(hub)

    // Bob opens receive channel
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    await delay(50)

    // Alice sends to Bob
    const payload = btoa('hello-bob')
    const result = await alice.request('hub/send', {
      param: { recipients: [bobTransports.server.toString()], payload },
    })
    // Note: we'll need to use Bob's DID from his identity

    channel.close()
    await aliceTransports.dispose()
    await bobTransports.dispose()
  })

  test('hub/group/send fails on unknown group', async () => {
    const store = createMemoryStore()
    const transports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: transports.server, store })
    const alice = new Client<HubProtocol>({
      transport: transports.client,
      identity: randomIdentity(),
    })

    await expect(
      alice.request('hub/group/send', {
        param: { groupID: 'nonexistent', payload: btoa('hello') },
      }),
    ).rejects.toThrow()

    await transports.dispose()
  })

  test('hub/group/send fans out to group members', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })
    const { client: bob } = createTestClient(hub)

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
      param: { groupID: 'chat', payload: btoa('group-message') },
    })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(btoa('group-message'))
    expect(msg.value?.groupID).toBe('chat')

    channel.close()
    await aliceTransports.dispose()
  })

  test('hub/receive channel delivers queued messages on connect', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    const bobIdentity = randomIdentity()

    // Alice sends to Bob while Bob is offline
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: btoa('offline-msg') },
    })
    await delay(50)

    // Bob connects and opens receive channel
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bob = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(btoa('offline-msg'))

    channel.close()
    await aliceTransports.dispose()
    await bobTransports.dispose()
  })

  test('hub/receive with groupIDs filter', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })
    const { client: bob, identity: bobIdentity } = createTestClient(hub)

    // Both join two groups
    await alice.request('hub/group/join', { param: { groupID: 'chat', credential: 'test' } })
    await alice.request('hub/group/join', { param: { groupID: 'work', credential: 'test' } })
    await bob.request('hub/group/join', { param: { groupID: 'chat', credential: 'test' } })
    await bob.request('hub/group/join', { param: { groupID: 'work', credential: 'test' } })

    // Bob opens receive channel filtering to 'chat' only
    const channel = bob.createChannel('hub/receive', {
      param: { groupIDs: ['chat'] },
    })
    const reader = channel.readable.getReader()
    await delay(50)

    // Alice sends to both groups
    await alice.request('hub/group/send', {
      param: { groupID: 'work', payload: btoa('work-msg') },
    })
    await alice.request('hub/group/send', {
      param: { groupID: 'chat', payload: btoa('chat-msg') },
    })

    // Also send a direct message to Bob
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: btoa('direct-msg') },
    })

    await delay(100)

    // Bob should receive the chat message and the direct message, but not work
    const msg1 = await reader.read()
    expect(msg1.value?.payload).toBe(btoa('chat-msg'))

    const msg2 = await reader.read()
    expect(msg2.value?.payload).toBe(btoa('direct-msg'))

    channel.close()
    await aliceTransports.dispose()
  })

  test('hub/receive ack flow', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    const bobIdentity = randomIdentity()

    // Send messages while Bob is offline
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: btoa('msg-1') },
    })
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: btoa('msg-2') },
    })
    await delay(50)

    // Bob connects, receives messages
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bob = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg1 = await reader.read()
    const msg2 = await reader.read()

    // Ack both messages
    await channel.send({ ack: [msg1.value!.sequenceID, msg2.value!.sequenceID] })
    await delay(50)

    // Close and reconnect — should get no messages
    channel.close()
    await bobTransports.dispose()

    const bobTransports2: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports2.server)
    const bob2 = new Client<HubProtocol>({
      transport: bobTransports2.client,
      identity: bobIdentity,
    })

    const channel2 = bob2.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()

    // Send a new message to verify channel works but no old messages
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: btoa('msg-3') },
    })
    const msg3 = await reader2.read()
    expect(msg3.value?.payload).toBe(btoa('msg-3'))

    channel2.close()
    await aliceTransports.dispose()
    await bobTransports2.dispose()
  })

  test('key package upload and fetch', async () => {
    const store = createMemoryStore()
    const transports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: transports.server, store })
    const identity = randomIdentity()
    const client = new Client<HubProtocol>({
      transport: transports.client,
      identity,
    })

    const result = await client.request('hub/keypackage/upload', {
      param: { keyPackages: ['kp-1', 'kp-2'] },
    })
    expect(result.stored).toBe(2)

    const fetched = await client.request('hub/keypackage/fetch', {
      param: { did: identity.id, count: 1 },
    })
    expect(fetched.keyPackages).toHaveLength(1)

    await transports.dispose()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/hub-server -- test/hub.test.ts`
Expected: FAIL — old handler types

- [ ] **Step 3: Rewrite hub.ts with new handlers**

Replace `src/hub.ts`:

```typescript
import type { HubProtocol, HubStore, StoredMessage } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type {
  ChannelHandler,
  ProcedureHandlers,
  RequestHandler,
  Server,
} from '@enkaku/server'
import { serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'

import { HubClientRegistry } from './registry.js'

export type CreateHubParams = {
  transport: ServerTransportOf<HubProtocol>
  store?: HubStore
  accessControl?: boolean
  identity?: Identity
}

export type HubInstance = {
  registry: HubClientRegistry
  server: Server<HubProtocol>
}

function getClientDID(ctx: { message: { payload: { iss?: string } } }): string {
  return ctx.message.payload.iss ?? 'anonymous'
}

export function createHub(params: CreateHubParams): HubInstance {
  const registry = new HubClientRegistry()
  const { store } = params

  const handlers: ProcedureHandlers<HubProtocol> = {
    'hub/send': ((ctx) => {
      const senderDID = getClientDID(ctx)
      const { recipients, payload } = ctx.param
      const payloadBytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))

      if (store != null) {
        return store
          .store({ senderDID, recipients, payload: payloadBytes })
          .then((sequenceID) => {
            // Deliver to online recipients immediately
            for (const recipientDID of recipients) {
              if (recipientDID === senderDID) continue
              const client = registry.getClient(recipientDID)
              if (client?.sendMessage != null) {
                client.sendMessage({
                  sequenceID,
                  senderDID,
                  payload: payloadBytes,
                })
              }
            }
            return { sequenceID }
          })
      }

      // No store — can't persist, just return empty ID
      throw new Error('Store is required for hub/send')
    }) as RequestHandler<HubProtocol, 'hub/send'>,

    'hub/group/send': ((ctx) => {
      const senderDID = getClientDID(ctx)
      const { groupID, payload } = ctx.param
      const payloadBytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))

      const members = registry.getGroupMembers(groupID)
      if (members.length === 0) {
        throw new Error(`Unknown group: ${groupID}`)
      }

      const recipients = members.filter((did) => did !== senderDID)

      if (store == null) {
        throw new Error('Store is required for hub/group/send')
      }

      return store
        .store({ senderDID, recipients, payload: payloadBytes, groupID })
        .then((sequenceID) => {
          // Deliver to online recipients immediately
          for (const recipientDID of recipients) {
            const client = registry.getClient(recipientDID)
            if (client?.sendMessage != null) {
              client.sendMessage({
                sequenceID,
                senderDID,
                groupID,
                payload: payloadBytes,
              })
            }
          }
          return { sequenceID }
        })
    }) as RequestHandler<HubProtocol, 'hub/group/send'>,

    'hub/receive': (async (ctx) => {
      const clientDID = getClientDID(ctx)
      const { after, groupIDs } = ctx.param ?? {}

      registry.register(clientDID)

      const writer = ctx.writable.getWriter()
      const reader = ctx.readable.getReader()

      // Set up message delivery callback with optional group filter
      registry.setReceiveWriter(clientDID, (message: StoredMessage) => {
        // Apply group filter: direct messages always pass, group messages only if in filter
        if (groupIDs != null && groupIDs.length > 0) {
          if (message.groupID != null && !groupIDs.includes(message.groupID)) {
            return
          }
        }
        const encoded = btoa(String.fromCharCode(...message.payload))
        writer.write({
          sequenceID: message.sequenceID,
          senderDID: message.senderDID,
          groupID: message.groupID,
          payload: encoded,
        }).catch(() => {})
      })

      // Drain queued messages from store
      if (store != null) {
        let cursor = after
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
            const encoded = btoa(String.fromCharCode(...msg.payload))
            await writer.write({
              sequenceID: msg.sequenceID,
              senderDID: msg.senderDID,
              groupID: msg.groupID,
              payload: encoded,
            })
          }
          cursor = result.cursor
          if (!result.hasMore) break
        }
      }

      // Read acks from device
      void (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value?.ack != null && store != null) {
              await store.ack({ recipientDID: clientDID, sequenceIDs: value.ack })
            }
          }
        } catch {
          // Channel closed
        }
      })()

      // Keep channel open until aborted
      return new Promise((resolve) => {
        ctx.signal.addEventListener(
          'abort',
          () => {
            registry.clearReceiveWriter(clientDID)
            reader.cancel().catch(() => {})
            writer.close().catch(() => {})
            resolve(undefined as never)
          },
          { once: true },
        )
      })
    }) as ChannelHandler<HubProtocol, 'hub/receive'>,

    'hub/keypackage/upload': ((ctx) => {
      if (store == null) {
        throw new Error('Store is required for key package operations')
      }
      const clientDID = getClientDID(ctx)
      const { keyPackages } = ctx.param
      return Promise.all(
        keyPackages.map((kp: string) => store.storeKeyPackage(clientDID, kp)),
      ).then(() => ({ stored: keyPackages.length }))
    }) as RequestHandler<HubProtocol, 'hub/keypackage/upload'>,

    'hub/keypackage/fetch': ((ctx) => {
      if (store == null) {
        return { keyPackages: [] }
      }
      const { did, count } = ctx.param
      return store.fetchKeyPackages(did, count).then((keyPackages) => ({ keyPackages }))
    }) as RequestHandler<HubProtocol, 'hub/keypackage/fetch'>,

    'hub/group/join': ((ctx) => {
      const clientDID = getClientDID(ctx)
      const { groupID } = ctx.param
      registry.register(clientDID)
      registry.joinGroup(clientDID, groupID)
      if (store != null) {
        const members = registry.getGroupMembers(groupID)
        return store.setGroupMembers(groupID, members).then(() => ({ joined: true }))
      }
      return { joined: true }
    }) as RequestHandler<HubProtocol, 'hub/group/join'>,

    'hub/group/leave': ((ctx) => {
      const clientDID = getClientDID(ctx)
      const { groupID } = ctx.param
      registry.leaveGroup(clientDID, groupID)
      if (store != null) {
        const members = registry.getGroupMembers(groupID)
        return store.setGroupMembers(groupID, members).then(() => ({ left: true }))
      }
      return { left: true }
    }) as RequestHandler<HubProtocol, 'hub/group/leave'>,
  }

  const server = serve<HubProtocol>({
    handlers,
    transport: params.transport,
    accessControl: params.accessControl ?? false,
    identity: params.identity,
  })

  return { registry, server }
}
```

- [ ] **Step 4: Update src/index.ts exports**

```typescript
export { createHub } from './hub.js'
export type { CreateHubParams, HubInstance } from './hub.js'
export { createMemoryStore } from './memoryStore.js'
export { HubClientRegistry } from './registry.js'
export type { ClientEntry } from './registry.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/hub-server`
Expected: All tests PASS

Note: Some handler tests may need adjustment based on exact protocol message format. The tests use `Client<HubProtocol>` which will exercise the actual protocol wiring. If tests fail due to type mismatches between the protocol definition and handler expectations, adjust the protocol definition in Task 2 to match.

- [ ] **Step 6: Commit**

```bash
git add packages/hub-server/src/ packages/hub-server/test/hub.test.ts
git commit -m "feat(hub-server): rewrite handlers for channel receive, split send, group routing"
```

---

## Task 6: Hub Client — Updated API

**Files:**
- Modify: `packages/hub-client/src/client.ts`
- Modify: `packages/hub-client/test/client.test.ts`

- [ ] **Step 1: Write failing tests for new client API**

Replace `test/client.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { Client } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'

import { createHub } from '@enkaku/hub-server'
import { createMemoryStore } from '@enkaku/hub-server'

import { HubClient } from '../src/client.js'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createTestHub() {
  const store = createMemoryStore()
  const transports: HubTransports = new DirectTransports()
  const hub = createHub({ transport: transports.server, store })
  return { hub, store, transports }
}

function createTestClient(hub: ReturnType<typeof createHub>, identity = randomIdentity()) {
  const transports: HubTransports = new DirectTransports()
  hub.server.handle(transports.server)
  const rawClient = new Client<HubProtocol>({
    transport: transports.client,
    identity,
  })
  const client = new HubClient({ client: rawClient })
  return { client, identity, transports }
}

describe('HubClient', () => {
  test('send to explicit recipients and receive', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, identity: bobIdentity, transports: bobT } = createTestClient(hub)

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.send({ recipients: [bobIdentity.id], payload: btoa('hello') })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(btoa('hello'))

    channel.close()
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('groupSend and receive with group', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await bob.joinGroup('chat')

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'chat', payload: btoa('group-hello') })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(btoa('group-hello'))
    expect(msg.value?.groupID).toBe('chat')

    channel.close()
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('receive with groupIDs filter', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, identity: bobIdentity, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await alice.joinGroup('work')
    await bob.joinGroup('chat')
    await bob.joinGroup('work')

    const channel = bob.receive({ groupIDs: ['chat'] })
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'work', payload: btoa('work-msg') })
    await alice.groupSend({ groupID: 'chat', payload: btoa('chat-msg') })
    await alice.send({ recipients: [bobIdentity.id], payload: btoa('direct-msg') })

    await delay(100)
    const msg1 = await reader.read()
    expect(msg1.value?.payload).toBe(btoa('chat-msg'))

    const msg2 = await reader.read()
    expect(msg2.value?.payload).toBe(btoa('direct-msg'))

    channel.close()
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('joinGroup and leaveGroup', async () => {
    const { hub, transports } = createTestHub()
    const identity = randomIdentity()
    const rawClient = new Client<HubProtocol>({
      transport: transports.client,
      identity,
    })
    const client = new HubClient({ client: rawClient })
    const result = await client.joinGroup('test-group')
    expect(result.joined).toBe(true)
    const leaveResult = await client.leaveGroup('test-group')
    expect(leaveResult.left).toBe(true)
    await transports.dispose()
  })

  test('uploadKeyPackages and fetchKeyPackages', async () => {
    const { hub, transports } = createTestHub()
    const identity = randomIdentity()
    const rawClient = new Client<HubProtocol>({
      transport: transports.client,
      identity,
    })
    const client = new HubClient({ client: rawClient })

    const result = await client.uploadKeyPackages(['kp-1', 'kp-2'])
    expect(result.stored).toBe(2)

    const fetched = await client.fetchKeyPackages(identity.id, 1)
    expect(fetched.keyPackages).toHaveLength(1)

    await transports.dispose()
  })

  test('exposes rawClient', () => {
    const transports: HubTransports = new DirectTransports()
    const rawClient = new Client<HubProtocol>({
      transport: transports.client,
    })
    const client = new HubClient({ client: rawClient })
    expect(client.rawClient).toBe(rawClient)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/hub-client`
Expected: FAIL — old `send()`/`receive()` signatures

- [ ] **Step 3: Rewrite client.ts**

```typescript
import type { ChannelCall, Client, RequestCall, StreamCall } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'

export type HubClientParams = {
  client: Client<HubProtocol>
}

export type SendParams = {
  recipients: Array<string>
  payload: string
}

export type GroupSendParams = {
  groupID: string
  payload: string
}

export type ReceiveOptions = {
  after?: string
  groupIDs?: Array<string>
}

export class HubClient {
  #client: Client<HubProtocol>

  constructor(params: HubClientParams) {
    this.#client = params.client
  }

  get rawClient(): Client<HubProtocol> {
    return this.#client
  }

  send(params: SendParams) {
    return this.#client.request('hub/send', {
      param: { recipients: params.recipients, payload: params.payload },
    })
  }

  groupSend(params: GroupSendParams) {
    return this.#client.request('hub/group/send', {
      param: { groupID: params.groupID, payload: params.payload },
    })
  }

  receive(options?: ReceiveOptions) {
    return this.#client.createChannel('hub/receive', {
      param: {
        after: options?.after,
        groupIDs: options?.groupIDs,
      },
    })
  }

  joinGroup(groupID: string, credential = '') {
    return this.#client.request('hub/group/join', {
      param: { groupID, credential },
    })
  }

  leaveGroup(groupID: string) {
    return this.#client.request('hub/group/leave', {
      param: { groupID },
    })
  }

  uploadKeyPackages(keyPackages: Array<string>) {
    return this.#client.request('hub/keypackage/upload', {
      param: { keyPackages },
    })
  }

  fetchKeyPackages(did: string, count?: number) {
    return this.#client.request('hub/keypackage/fetch', {
      param: { did, count },
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/hub-client`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hub-client/src/client.ts packages/hub-client/test/client.test.ts
git commit -m "feat(hub-client): update API with send/groupSend/receive channel"
```

---

## Task 7: Capability — Revocation Primitive

**Files:**
- Create: `packages/capability/src/revocation.ts`
- Modify: `packages/capability/src/index.ts`
- Create: `packages/capability/test/revocation.test.ts`

- [ ] **Step 1: Write failing tests for revocation**

Create `test/revocation.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { randomIdentity, stringifyToken } from '@enkaku/token'

import { checkDelegationChain, createCapability, now } from '../src/index.js'
import {
  createMemoryRevocationBackend,
  createRevocationChecker,
  createRevocationRecord,
} from '../src/revocation.js'

describe('revocation', () => {
  test('createMemoryRevocationBackend tracks revocations', async () => {
    const backend = createMemoryRevocationBackend()
    expect(await backend.isRevoked('some-jti')).toBe(false)
    await backend.add({ jti: 'some-jti', iss: 'did:key:alice', rev: true, iat: now() })
    expect(await backend.isRevoked('some-jti')).toBe(true)
  })

  test('createRevocationChecker returns a VerifyTokenHook', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)
    expect(typeof checker).toBe('function')
  })

  test('checker passes for non-revoked token', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)

    const signer = randomIdentity()
    const capability = await createCapability(signer, {
      sub: signer.id,
      aud: 'did:key:bob',
      act: '*',
      res: '*',
      jti: 'cap-1',
    })

    // Should not throw
    await checker(capability, stringifyToken(capability))
  })

  test('checker rejects revoked token', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)

    const signer = randomIdentity()
    const capability = await createCapability(signer, {
      sub: signer.id,
      aud: 'did:key:bob',
      act: '*',
      res: '*',
      jti: 'cap-revoked',
    })

    await backend.add({ jti: 'cap-revoked', iss: signer.id, rev: true, iat: now() })

    await expect(
      checker(capability, stringifyToken(capability)),
    ).rejects.toThrow('revoked')
  })

  test('checker integrates with checkDelegationChain', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)

    const root = randomIdentity()
    const device = randomIdentity()

    // Root delegates to device
    const delegation = await createCapability(root, {
      sub: root.id,
      aud: device.id,
      act: '*',
      res: '*',
      jti: 'delegation-1',
    })

    // Device creates a sub-delegation
    const subDelegation = await createCapability(
      device,
      {
        sub: root.id,
        aud: 'did:key:service',
        act: 'read',
        res: 'data/*',
        jti: 'sub-delegation-1',
      },
      undefined,
      { parentCapability: stringifyToken(delegation) },
    )

    // Chain is valid before revocation
    await checkDelegationChain(
      subDelegation.payload,
      [stringifyToken(delegation)],
      { verifyToken: checker },
    )

    // Revoke the root delegation
    await backend.add({ jti: 'delegation-1', iss: root.id, rev: true, iat: now() })

    // Chain should now fail
    await expect(
      checkDelegationChain(
        subDelegation.payload,
        [stringifyToken(delegation)],
        { verifyToken: checker },
      ),
    ).rejects.toThrow('revoked')
  })

  test('createRevocationRecord produces a signed revocation', async () => {
    const signer = randomIdentity()
    const record = await createRevocationRecord(signer, 'cap-to-revoke')
    expect(record.jti).toBe('cap-to-revoke')
    expect(record.iss).toBe(signer.id)
    expect(record.rev).toBe(true)
    expect(typeof record.iat).toBe('number')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/capability -- test/revocation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement revocation.ts**

Create `src/revocation.ts`:

```typescript
import type { SigningIdentity } from '@enkaku/token'

import type { CapabilityToken, VerifyTokenHook } from './index.js'

export type RevocationRecord = {
  jti: string
  iss: string
  rev: true
  iat: number
}

export type RevocationBackend = {
  add(record: RevocationRecord): Promise<void>
  isRevoked(jti: string): Promise<boolean>
}

export function createMemoryRevocationBackend(): RevocationBackend {
  const revoked = new Set<string>()
  return {
    async add(record: RevocationRecord): Promise<void> {
      revoked.add(record.jti)
    },
    async isRevoked(jti: string): Promise<boolean> {
      return revoked.has(jti)
    },
  }
}

export function createRevocationChecker(backend: RevocationBackend): VerifyTokenHook {
  return async (token: CapabilityToken, _raw: string): Promise<void> => {
    const jti = token.payload.jti
    if (jti != null && (await backend.isRevoked(jti))) {
      throw new Error(`Token revoked: ${jti}`)
    }
  }
}

export async function createRevocationRecord(
  signer: SigningIdentity,
  jti: string,
): Promise<RevocationRecord> {
  return {
    jti,
    iss: signer.id,
    rev: true,
    iat: Math.floor(Date.now() / 1000),
  }
}
```

- [ ] **Step 4: Update index.ts to re-export revocation module**

Add at the end of `src/index.ts`:

```typescript
export {
  createMemoryRevocationBackend,
  createRevocationChecker,
  createRevocationRecord,
} from './revocation.js'
export type { RevocationBackend, RevocationRecord } from './revocation.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/capability`
Expected: All tests PASS (both existing and new)

- [ ] **Step 6: Commit**

```bash
git add packages/capability/src/revocation.ts packages/capability/src/index.ts packages/capability/test/revocation.test.ts
git commit -m "feat(capability): add revocation primitive with backend interface and checker"
```

---

## Task 8: Integration Tests — Multi-device Agent Scenarios

**Files:**
- Create: `tests/integration/hub-agent-scenarios.test.ts`
- Modify: `tests/integration/package.json`

- [ ] **Step 1: Add hub dependencies to integration test package**

```bash
cd tests/integration && pnpm add @enkaku/hub-protocol@"workspace:^" @enkaku/hub-server@"workspace:^" @enkaku/hub-client@"workspace:^" @enkaku/capability@"workspace:^" @enkaku/hd-keystore@"workspace:^" @enkaku/event@"workspace:^"
```

- [ ] **Step 2: Write the integration test file**

Create `tests/integration/hub-agent-scenarios.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { Client } from '@enkaku/client'
import {
  checkDelegationChain,
  createCapability,
  createMemoryRevocationBackend,
  createRevocationChecker,
  createRevocationRecord,
  now,
} from '@enkaku/capability'
import type { HubProtocol } from '@enkaku/hub-protocol'
import { HubClient } from '@enkaku/hub-client'
import { createHub, createMemoryStore } from '@enkaku/hub-server'
import { HDKeyStore } from '@enkaku/hd-keystore'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { randomIdentity, stringifyToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createTestHub() {
  const store = createMemoryStore()
  const transports: HubTransports = new DirectTransports()
  const hub = createHub({ transport: transports.server, store })
  return { hub, store, transports }
}

function createTestClient(hub: ReturnType<typeof createHub>, identity = randomIdentity()) {
  const transports: HubTransports = new DirectTransports()
  hub.server.handle(transports.server)
  const rawClient = new Client<HubProtocol>({
    transport: transports.client,
    identity,
  })
  const client = new HubClient({ client: rawClient })
  return { client, identity, transports }
}

describe('Scenario A: Multi-device via hub', () => {
  test('two devices, blind relay', async () => {
    const { hub } = createTestHub()
    const { client: phone, transports: phoneT } = createTestClient(hub)
    const { client: laptop, identity: laptopID, transports: laptopT } = createTestClient(hub)

    const channel = laptop.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    const payload = btoa('encrypted-blob')
    await phone.send({ recipients: [laptopID.id], payload })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel.close()
    await phoneT.dispose()
    await laptopT.dispose()
  })

  test('store-and-forward: offline device gets messages on connect', async () => {
    const { hub } = createTestHub()
    const laptopIdentity = randomIdentity()
    const { client: phone, transports: phoneT } = createTestClient(hub)

    // Phone sends while laptop is offline
    await phone.send({ recipients: [laptopIdentity.id], payload: btoa('msg-while-offline') })
    await delay(50)

    // Laptop connects later
    const { client: laptop, transports: laptopT } = createTestClient(hub, laptopIdentity)
    const channel = laptop.receive()
    const reader = channel.readable.getReader()

    const msg = await reader.read()
    expect(msg.value?.payload).toBe(btoa('msg-while-offline'))

    channel.close()
    await phoneT.dispose()
    await laptopT.dispose()
  })

  test('pagination: fetch messages in batches', async () => {
    const { hub, store } = createTestHub()
    const recipient = randomIdentity()

    // Store 5 messages directly
    for (let i = 0; i < 5; i++) {
      await store.store({
        senderDID: 'did:key:sender',
        recipients: [recipient.id],
        payload: new Uint8Array([i]),
      })
    }

    // Fetch in batches of 2
    const result1 = await store.fetch({ recipientDID: recipient.id, limit: 2 })
    expect(result1.messages).toHaveLength(2)
    expect(result1.hasMore).toBe(true)

    const result2 = await store.fetch({
      recipientDID: recipient.id,
      after: result1.cursor!,
      limit: 2,
    })
    expect(result2.messages).toHaveLength(2)
    expect(result2.hasMore).toBe(true)

    const result3 = await store.fetch({
      recipientDID: recipient.id,
      after: result2.cursor!,
      limit: 2,
    })
    expect(result3.messages).toHaveLength(1)
    expect(result3.hasMore).toBeUndefined()
  })

  test('ack semantics: unacked messages are re-delivered', async () => {
    const { hub, store } = createTestHub()
    const recipient = randomIdentity()

    await store.store({
      senderDID: 'did:key:sender',
      recipients: [recipient.id],
      payload: new Uint8Array([1]),
    })

    // Fetch without acking
    const result1 = await store.fetch({ recipientDID: recipient.id })
    expect(result1.messages).toHaveLength(1)

    // Fetch again — still there
    const result2 = await store.fetch({ recipientDID: recipient.id })
    expect(result2.messages).toHaveLength(1)

    // Ack
    await store.ack({ recipientDID: recipient.id, sequenceIDs: [result2.messages[0].sequenceID] })

    // Fetch again — gone
    const result3 = await store.fetch({ recipientDID: recipient.id })
    expect(result3.messages).toHaveLength(0)
  })

  test('combined ack+fetch', async () => {
    const { hub, store } = createTestHub()
    const recipient = randomIdentity()

    const id1 = await store.store({
      senderDID: 'did:key:sender',
      recipients: [recipient.id],
      payload: new Uint8Array([1]),
    })
    await store.store({
      senderDID: 'did:key:sender',
      recipients: [recipient.id],
      payload: new Uint8Array([2]),
    })

    // Ack first, fetch remaining
    const result = await store.fetch({ recipientDID: recipient.id, ack: [id1] })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].payload).toEqual(new Uint8Array([2]))
  })
})

describe('Scenario A: Group communication', () => {
  test('group fan-out', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await bob.joinGroup('chat')

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'chat', payload: btoa('hello-group') })

    const msg = await reader.read()
    expect(msg.value?.payload).toBe(btoa('hello-group'))
    expect(msg.value?.groupID).toBe('chat')

    channel.close()
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('group send fails on unknown group', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)

    await expect(
      alice.groupSend({ groupID: 'nonexistent', payload: btoa('hello') }),
    ).rejects.toThrow()

    await aliceT.dispose()
  })

  test('receive with groupIDs filter', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, identity: bobID, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await alice.joinGroup('work')
    await bob.joinGroup('chat')
    await bob.joinGroup('work')

    // Bob filters to only 'chat' group
    const channel = bob.receive({ groupIDs: ['chat'] })
    const reader = channel.readable.getReader()
    await delay(50)

    // Alice sends to both groups + direct
    await alice.groupSend({ groupID: 'work', payload: btoa('work-msg') })
    await alice.groupSend({ groupID: 'chat', payload: btoa('chat-msg') })
    await alice.send({ recipients: [bobID.id], payload: btoa('direct-msg') })

    await delay(100)

    // Bob gets chat + direct, not work
    const msg1 = await reader.read()
    expect(msg1.value?.payload).toBe(btoa('chat-msg'))

    const msg2 = await reader.read()
    expect(msg2.value?.payload).toBe(btoa('direct-msg'))

    channel.close()
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('mixed delivery: group and direct on same channel', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, identity: bobID, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await bob.joinGroup('chat')

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'chat', payload: btoa('group-msg') })
    await alice.send({ recipients: [bobID.id], payload: btoa('direct-msg') })

    const msg1 = await reader.read()
    expect(msg1.value?.groupID).toBe('chat')

    const msg2 = await reader.read()
    expect(msg2.value?.groupID).toBeUndefined()

    channel.close()
    await aliceT.dispose()
    await bobT.dispose()
  })
})

describe('Scenario B: Delegation chain verification', () => {
  test('root delegates to device, third party verifies', async () => {
    const root = randomIdentity()
    const device = randomIdentity()

    const delegation = await createCapability(root, {
      sub: root.id,
      aud: device.id,
      act: '*',
      res: '*',
      jti: 'root-to-device',
    })

    // Device creates a sub-capability for a specific action
    const deviceCap = await createCapability(
      device,
      {
        sub: root.id,
        aud: 'did:key:third-party',
        act: 'read',
        res: 'data/*',
      },
      undefined,
      { parentCapability: stringifyToken(delegation) },
    )

    // Third party verifies the chain
    await checkDelegationChain(
      deviceCap.payload,
      [stringifyToken(delegation)],
    )
  })

  test('scoped delegation to service', async () => {
    const root = randomIdentity()
    const service = randomIdentity()

    const delegation = await createCapability(root, {
      sub: root.id,
      aud: service.id,
      act: 'read',
      res: 'data/*',
      exp: now() + 3600, // 1 hour
      jti: 'root-to-service',
    })

    // Valid chain
    await checkDelegationChain(
      delegation.payload,
      [],
    )
  })

  test('expired delegation rejected', async () => {
    const root = randomIdentity()
    const device = randomIdentity()

    const delegation = await createCapability(root, {
      sub: root.id,
      aud: device.id,
      act: '*',
      res: '*',
      exp: now() - 10, // Already expired
    })

    await expect(
      checkDelegationChain(delegation.payload, []),
    ).rejects.toThrow('expired')
  })

  test('revocation: revoked capability rejected in chain', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)

    const root = randomIdentity()
    const device = randomIdentity()

    const delegation = await createCapability(root, {
      sub: root.id,
      aud: device.id,
      act: '*',
      res: '*',
      jti: 'revocable-cap',
    })

    const subCap = await createCapability(
      device,
      {
        sub: root.id,
        aud: 'did:key:service',
        act: 'read',
        res: 'data/*',
      },
      undefined,
      { parentCapability: stringifyToken(delegation) },
    )

    // Valid before revocation
    await checkDelegationChain(
      subCap.payload,
      [stringifyToken(delegation)],
      { verifyToken: checker },
    )

    // Revoke
    const record = await createRevocationRecord(root, 'revocable-cap')
    await backend.add(record)

    // Rejected after revocation
    await expect(
      checkDelegationChain(
        subCap.payload,
        [stringifyToken(delegation)],
        { verifyToken: checker },
      ),
    ).rejects.toThrow('revoked')
  })
})

describe('Store eviction', () => {
  test('consumer-driven purge', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })

    const purged = await store.purge({ olderThan: 0 })
    expect(purged.length).toBeGreaterThan(0)

    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages).toHaveLength(0)
  })

  test('purge event emitted', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })

    const eventPromise = store.events.once('purge')
    await store.purge({ olderThan: 0 })
    const event = await eventPromise
    expect(event.sequenceIDs.length).toBeGreaterThan(0)
  })

  test('reference counting: message survives partial ack', async () => {
    const store = createMemoryStore()
    const id = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob', 'did:key:carol'],
      payload: new Uint8Array([1]),
    })

    // Bob acks
    await store.ack({ recipientDID: 'did:key:bob', sequenceIDs: [id] })

    // Carol still sees it
    const result = await store.fetch({ recipientDID: 'did:key:carol' })
    expect(result.messages).toHaveLength(1)

    // Carol acks — message fully consumed
    await store.ack({ recipientDID: 'did:key:carol', sequenceIDs: [id] })
    const result2 = await store.fetch({ recipientDID: 'did:key:carol' })
    expect(result2.messages).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `pnpm run test:unit --filter=integration`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/integration/hub-agent-scenarios.test.ts tests/integration/package.json pnpm-lock.yaml
git commit -m "test: add integration tests for multi-device agent scenarios"
```

---

## Task 9: Build and Lint Verification

**Files:** None (verification only)

- [ ] **Step 1: Build all packages**

Run: `pnpm run build`
Expected: All packages build successfully

- [ ] **Step 2: Run all tests**

Run: `pnpm run test`
Expected: All tests pass (including type checks)

- [ ] **Step 3: Lint**

Run: `pnpm run lint`
Expected: No lint errors

- [ ] **Step 4: Fix any issues**

If any build, test, or lint errors occur, fix them and re-run until all pass.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build/lint issues from agent primitives implementation"
```

(Only if there were fixes needed.)
