# @enkaku/broadcast (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@enkaku/broadcast`, the generic fan-out primitive package (Phase 1 of the group-messaging design) — a topic-addressed broadcast transport, an anycast/gather bus client, a responder helper with storm-collapse, opaque topic-ID derivation, and group-protocol scaffold types — with zero MLS, hub, or DID coupling.

**Architecture:** A `BroadcastBus` interface abstracts 1→N publish/subscribe over opaque topic IDs (a `createMemoryBus` test fake stands in for the hub). `createBroadcastTransport` wraps a single topic as an Enkaku `TransportType` by building a `ReadableWritablePair` over the bus and handing it to the existing `Transport` class — outbound values are JSON-encoded then passed through a consumer `wrap` hook; inbound bytes go through `unwrap` then JSON-decode. `BroadcastClient` and `createBroadcastResponder` implement the anycast event envelope (request-events + reply-events correlated by `(requestID, from)`) on top of that transport. `deriveTopicID` is a pure HKDF-SHA256 function. The package depends only on other Enkaku packages plus `@noble/hashes`.

**Tech Stack:** TypeScript (ESM, `.js` import suffixes), `@noble/hashes` (HKDF-SHA256, SHA-256), `@enkaku/transport`, `@enkaku/codec`, `@enkaku/async`, `@enkaku/protocol`, vitest, swc build.

**Spec:** `docs/superpowers/specs/2026-06-19-group-messaging-primitives-design.md` (Phase 1 section).

## Global Constraints

Copied verbatim from the project conventions (AGENTS.md). Every task's requirements include these:

- Use `type`, never `interface`.
- Use `Array<T>`, never `T[]`.
- Never use `any` — use `unknown`, `Record<string, unknown>`, or a specific type.
- Names: `ID` not `Id`, `HTTP` not `Http`, `JWT` not `Jwt` (no lowercase abbreviations).
- Use `pnpm` / `pnpx`, never `npm` / `npx`.
- Never edit generated files (`.gen.ts`, `__generated__/`, `lib/`).
- Do not create packages beyond the one defined here without checking with the user.
- `@noble/hashes` v2 import paths carry a `.js` suffix (e.g. `@noble/hashes/sha2.js`), matching existing usage in `packages/group/src/crypto.ts`.
- New deps reference the workspace catalog: `"@noble/hashes": "catalog:"`, `"vitest": "catalog:"`; intra-repo deps use `"workspace:^"`.
- Lint via `rtk proxy pnpm run lint` (not bare `pnpm run lint`) when linting in this repo.

## File Structure

All paths under `packages/broadcast/`.

- `package.json` — package manifest (mirrors `packages/transport/package.json`).
- `tsconfig.json` — build config (extends `../../tsconfig.build.json`).
- `tsconfig.test.json` — type-check config for tests.
- `src/index.ts` — public barrel re-exporting every module below.
- `src/topic.ts` — `deriveTopicID` (pure HKDF).
- `src/bus.ts` — `BroadcastBus` type + `createMemoryBus` test fake.
- `src/transport.ts` — `createBroadcastTransport` + `BroadcastMessage` type + JSON encode/decode + `wrap`/`unwrap` plumbing.
- `src/client.ts` — `BroadcastClient` (`dispatch`/`request`/`gather`).
- `src/responder.ts` — `createBroadcastResponder` + `suppressible`.
- `src/protocol.ts` — group-protocol scaffold types + `defineGroupProtocol`.
- `test/topic.test.ts`, `test/transport.test.ts`, `test/client.test.ts`, `test/responder.test.ts`, `test/protocol.test.ts` — unit tests.

---

### Task 1: Package scaffold

**Files:**
- Create: `packages/broadcast/package.json`
- Create: `packages/broadcast/tsconfig.json`
- Create: `packages/broadcast/tsconfig.test.json`
- Create: `packages/broadcast/src/index.ts`
- Test: `packages/broadcast/test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `@enkaku/broadcast` workspace package; later tasks add modules and re-export them from `src/index.ts`.

- [ ] **Step 1: Write the package manifest**

Create `packages/broadcast/package.json`:

```json
{
  "name": "@enkaku/broadcast",
  "version": "0.17.0",
  "license": "MIT",
  "homepage": "https://enkaku.dev",
  "description": "Generic fan-out broadcast transport and anycast client for Enkaku RPC",
  "keywords": ["broadcast", "pubsub", "fanout", "anycast", "rpc"],
  "repository": {
    "type": "git",
    "url": "https://github.com/TairuFramework/enkaku",
    "directory": "packages/broadcast"
  },
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "exports": {
    ".": "./lib/index.js"
  },
  "files": ["lib/*"],
  "sideEffects": false,
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit --skipLibCheck -p tsconfig.test.json",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@enkaku/async": "workspace:^",
    "@enkaku/codec": "workspace:^",
    "@enkaku/protocol": "workspace:^",
    "@enkaku/transport": "workspace:^",
    "@noble/hashes": "catalog:"
  },
  "devDependencies": {
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Write the tsconfig files**

Create `packages/broadcast/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "lib": ["es2025", "dom"],
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

Create `packages/broadcast/tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["./src/**/*", "./test/**/*"]
}
```

- [ ] **Step 3: Write a placeholder barrel and a smoke test**

Create `packages/broadcast/src/index.ts`:

```ts
/**
 * Generic fan-out broadcast primitives for Enkaku RPC.
 *
 * @module broadcast
 */

export const PACKAGE_NAME = '@enkaku/broadcast'
```

Create `packages/broadcast/test/smoke.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { PACKAGE_NAME } from '../src/index.js'

describe('@enkaku/broadcast', () => {
  test('package barrel is importable', () => {
    expect(PACKAGE_NAME).toBe('@enkaku/broadcast')
  })
})
```

- [ ] **Step 4: Install and verify the workspace builds**

Run: `pnpm install`
Then: `pnpm --filter @enkaku/broadcast run test`
Expected: type check passes, the smoke test passes (1 passed).

- [ ] **Step 5: Commit**

```bash
git add packages/broadcast pnpm-lock.yaml
git commit -m "feat(broadcast): scaffold @enkaku/broadcast package"
```

---

### Task 2: `deriveTopicID` (HKDF topic derivation)

**Files:**
- Create: `packages/broadcast/src/topic.ts`
- Modify: `packages/broadcast/src/index.ts`
- Test: `packages/broadcast/test/topic.test.ts`

**Interfaces:**
- Consumes: `hkdf` from `@noble/hashes/hkdf.js`, `sha256` from `@noble/hashes/sha2.js`, `fromUTF`/`toB64U` from `@enkaku/codec`.
- Produces: `deriveTopicID(secret: Uint8Array, epoch: number, label: string, scope?: string): string` — returns a base64url-encoded 32-byte opaque topic ID. Deterministic; distinct for any differing `(secret, epoch, label, scope)`.

- [ ] **Step 1: Write the failing test**

Create `packages/broadcast/test/topic.test.ts`:

```ts
import { fromUTF } from '@enkaku/codec'
import { describe, expect, test } from 'vitest'

import { deriveTopicID } from '../src/topic.js'

const secret = fromUTF('test-group-secret-material')

describe('deriveTopicID', () => {
  test('is deterministic for identical inputs', () => {
    expect(deriveTopicID(secret, 1, 'control')).toBe(deriveTopicID(secret, 1, 'control'))
  })

  test('returns a non-empty base64url string', () => {
    const id = deriveTopicID(secret, 1, 'control')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(id).toMatch(/^[A-Za-z0-9_-]+={0,2}$/)
  })

  test('differs by epoch', () => {
    expect(deriveTopicID(secret, 1, 'control')).not.toBe(deriveTopicID(secret, 2, 'control'))
  })

  test('differs by label', () => {
    expect(deriveTopicID(secret, 1, 'control')).not.toBe(deriveTopicID(secret, 1, 'sync'))
  })

  test('differs by scope', () => {
    expect(deriveTopicID(secret, 1, 'sync')).not.toBe(deriveTopicID(secret, 1, 'sync', 'subgroup-a'))
    expect(deriveTopicID(secret, 1, 'sync', 'a')).not.toBe(deriveTopicID(secret, 1, 'sync', 'b'))
  })

  test('differs by secret', () => {
    expect(deriveTopicID(secret, 1, 'control')).not.toBe(
      deriveTopicID(fromUTF('other-secret'), 1, 'control'),
    )
  })

  test('label/scope boundary is unambiguous', () => {
    // 'ab' + '' must not collide with 'a' + 'b'
    expect(deriveTopicID(secret, 1, 'ab', '')).not.toBe(deriveTopicID(secret, 1, 'a', 'b'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/topic.test.ts`
Expected: FAIL — cannot resolve `../src/topic.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/broadcast/src/topic.ts`:

```ts
import { fromUTF, toB64U } from '@enkaku/codec'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'

const TOPIC_INFO_PREFIX = 'enkaku/topic/v1'
const SEP = ' '
const TOPIC_ID_BYTES = 32

function encodeEpoch(epoch: number): Uint8Array {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, BigInt(epoch), true)
  return bytes
}

/**
 * Derive an opaque, secret-gated, epoch-rotating topic ID.
 *
 * `secret` is any keying material, `epoch` a rotation counter, `label` a
 * channel name, `scope` an optional subgroup/target discriminator. NUL
 * separators make the `label`/`scope` boundary unambiguous.
 */
export function deriveTopicID(
  secret: Uint8Array,
  epoch: number,
  label: string,
  scope = '',
): string {
  const info = fromUTF(`${TOPIC_INFO_PREFIX}${SEP}${label}${SEP}${scope}`)
  const okm = hkdf(sha256, secret, encodeEpoch(epoch), info, TOPIC_ID_BYTES)
  return toB64U(okm)
}
```

- [ ] **Step 4: Re-export from the barrel**

Edit `packages/broadcast/src/index.ts` — append after the existing `PACKAGE_NAME` export:

```ts
export { deriveTopicID } from './topic.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/topic.test.ts`
Expected: PASS (7 passed).

- [ ] **Step 6: Commit**

```bash
git add packages/broadcast/src/topic.ts packages/broadcast/src/index.ts packages/broadcast/test/topic.test.ts
git commit -m "feat(broadcast): add deriveTopicID HKDF topic derivation"
```

---

### Task 3: `BroadcastBus` interface + `createMemoryBus`

**Files:**
- Create: `packages/broadcast/src/bus.ts`
- Modify: `packages/broadcast/src/index.ts`
- Test: `packages/broadcast/test/bus.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type BroadcastBus = { publish(topicID: string, payload: Uint8Array): void | Promise<void>; subscribe(topicID: string, onMessage: (payload: Uint8Array) => void): () => void }` — `subscribe` returns an unsubscribe function.
  - `createMemoryBus(): BroadcastBus` — an in-process fan-out bus for tests; `publish` delivers to all current subscribers of the topic (and only that topic).

- [ ] **Step 1: Write the failing test**

Create `packages/broadcast/test/bus.test.ts`:

```ts
import { fromUTF } from '@enkaku/codec'
import { describe, expect, test } from 'vitest'

import { createMemoryBus } from '../src/bus.js'

describe('createMemoryBus', () => {
  test('fans a publish out to all subscribers of the topic', () => {
    const bus = createMemoryBus()
    const a: Array<string> = []
    const b: Array<string> = []
    bus.subscribe('t1', (p) => a.push(new TextDecoder().decode(p)))
    bus.subscribe('t1', (p) => b.push(new TextDecoder().decode(p)))

    bus.publish('t1', fromUTF('hello'))

    expect(a).toEqual(['hello'])
    expect(b).toEqual(['hello'])
  })

  test('does not deliver across topics', () => {
    const bus = createMemoryBus()
    const received: Array<string> = []
    bus.subscribe('t1', (p) => received.push(new TextDecoder().decode(p)))

    bus.publish('t2', fromUTF('nope'))

    expect(received).toEqual([])
  })

  test('unsubscribe stops delivery', () => {
    const bus = createMemoryBus()
    const received: Array<string> = []
    const unsub = bus.subscribe('t1', (p) => received.push(new TextDecoder().decode(p)))

    bus.publish('t1', fromUTF('first'))
    unsub()
    bus.publish('t1', fromUTF('second'))

    expect(received).toEqual(['first'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/bus.test.ts`
Expected: FAIL — cannot resolve `../src/bus.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/broadcast/src/bus.ts`:

```ts
/**
 * Abstraction over a 1→N publish/subscribe bus addressed by opaque topic IDs.
 * The hub implements this in Phase 2; `createMemoryBus` is the in-process fake.
 */
export type BroadcastBus = {
  publish(topicID: string, payload: Uint8Array): void | Promise<void>
  subscribe(topicID: string, onMessage: (payload: Uint8Array) => void): () => void
}

/** In-memory fan-out bus for tests and in-process use. */
export function createMemoryBus(): BroadcastBus {
  const topics = new Map<string, Set<(payload: Uint8Array) => void>>()
  return {
    publish(topicID, payload) {
      const subscribers = topics.get(topicID)
      if (subscribers == null) {
        return
      }
      for (const onMessage of [...subscribers]) {
        onMessage(payload)
      }
    },
    subscribe(topicID, onMessage) {
      let subscribers = topics.get(topicID)
      if (subscribers == null) {
        subscribers = new Set()
        topics.set(topicID, subscribers)
      }
      subscribers.add(onMessage)
      return () => {
        subscribers?.delete(onMessage)
        if (subscribers?.size === 0) {
          topics.delete(topicID)
        }
      }
    },
  }
}
```

- [ ] **Step 4: Re-export from the barrel**

Edit `packages/broadcast/src/index.ts` — append:

```ts
export { type BroadcastBus, createMemoryBus } from './bus.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/bus.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add packages/broadcast/src/bus.ts packages/broadcast/src/index.ts packages/broadcast/test/bus.test.ts
git commit -m "feat(broadcast): add BroadcastBus interface and createMemoryBus fake"
```

---

### Task 4: `createBroadcastTransport`

**Files:**
- Create: `packages/broadcast/src/transport.ts`
- Modify: `packages/broadcast/src/index.ts`
- Test: `packages/broadcast/test/transport.test.ts`

**Interfaces:**
- Consumes: `Transport`, `TransportType` from `@enkaku/transport`; `fromUTF`/`toUTF` from `@enkaku/codec`; `BroadcastBus` from `./bus.js`.
- Produces:
  - `type BroadcastMessage = { payload: { typ: string; prc?: string; data?: unknown; [key: string]: unknown } }` — the message shape carried on the bus.
  - `type ByteTransform = (bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>`.
  - `type BroadcastTransportParams = { topicID: string; bus: BroadcastBus; wrap?: ByteTransform; unwrap?: ByteTransform; signal?: AbortSignal }`.
  - `createBroadcastTransport<R = BroadcastMessage, W = BroadcastMessage>(params: BroadcastTransportParams): TransportType<R, W>` — a `TransportType` bound to one topic: `write` JSON-encodes the value, applies `wrap`, publishes to the topic; inbound bytes are `unwrap`-ed then JSON-decoded and surfaced via `read()`/async-iteration. `wrap`/`unwrap` default to identity.

- [ ] **Step 1: Write the failing test**

Create `packages/broadcast/test/transport.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { createMemoryBus } from '../src/bus.js'
import { type BroadcastMessage, createBroadcastTransport } from '../src/transport.js'

function makeMessage(prc: string, data: Record<string, unknown>): BroadcastMessage {
  return { payload: { typ: 'event', prc, data } }
}

describe('createBroadcastTransport', () => {
  test('fans written messages to other transports on the same topic', async () => {
    const bus = createMemoryBus()
    const sender = createBroadcastTransport({ topicID: 'topic-x', bus })
    const receiverA = createBroadcastTransport({ topicID: 'topic-x', bus })
    const receiverB = createBroadcastTransport({ topicID: 'topic-x', bus })

    await sender.write(makeMessage('greet', { hello: 'world' }))

    const a = await receiverA.read()
    const b = await receiverB.read()
    expect(a.value).toEqual(makeMessage('greet', { hello: 'world' }))
    expect(b.value).toEqual(makeMessage('greet', { hello: 'world' }))

    await sender.dispose()
    await receiverA.dispose()
    await receiverB.dispose()
  })

  test('does not deliver across topics', async () => {
    const bus = createMemoryBus()
    const sender = createBroadcastTransport({ topicID: 'topic-x', bus })
    const other = createBroadcastTransport({ topicID: 'topic-y', bus })

    await sender.write(makeMessage('greet', { hello: 'world' }))
    const result = await Promise.race([
      other.read(),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
    ])
    expect(result).toBe('timeout')

    await sender.dispose()
    await other.dispose()
  })

  test('applies wrap on write and unwrap on read (round-trip)', async () => {
    const bus = createMemoryBus()
    // XOR transform proves the bytes pass through wrap/unwrap, not raw JSON.
    const mask = (bytes: Uint8Array) => bytes.map((byte) => byte ^ 0x5a)
    const sender = createBroadcastTransport({ topicID: 't', bus, wrap: mask })
    const receiver = createBroadcastTransport({ topicID: 't', bus, unwrap: mask })

    await sender.write(makeMessage('m', { n: 42 }))
    const got = await receiver.read()
    expect(got.value).toEqual(makeMessage('m', { n: 42 }))

    await sender.dispose()
    await receiver.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/transport.test.ts`
Expected: FAIL — cannot resolve `../src/transport.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/broadcast/src/transport.ts`:

```ts
import { fromUTF, toUTF } from '@enkaku/codec'
import { Transport, type TransportType } from '@enkaku/transport'

import type { BroadcastBus } from './bus.js'

/** Message shape carried on a broadcast topic. */
export type BroadcastMessage = {
  payload: { typ: string; prc?: string; data?: unknown; [key: string]: unknown }
}

export type ByteTransform = (bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>

export type BroadcastTransportParams = {
  topicID: string
  bus: BroadcastBus
  wrap?: ByteTransform
  unwrap?: ByteTransform
  signal?: AbortSignal
}

const identity: ByteTransform = (bytes) => bytes

function encode(value: unknown): Uint8Array {
  return fromUTF(JSON.stringify(value))
}

function decode<R>(bytes: Uint8Array): R {
  return JSON.parse(toUTF(bytes)) as R
}

/**
 * Create a `TransportType` bound to a single broadcast topic. Writes fan out to
 * every transport subscribed to the topic; reads merge inbound topic messages.
 * Only fire-and-forget event traffic is meaningful here — request/stream/channel
 * `rid` correlation does not survive 1→N fan-out (the `BroadcastClient` models
 * anycast on top of events instead).
 */
export function createBroadcastTransport<R = BroadcastMessage, W = BroadcastMessage>(
  params: BroadcastTransportParams,
): TransportType<R, W> {
  const { topicID, bus, wrap = identity, unwrap = identity, signal } = params

  let unsubscribe: (() => void) | undefined
  const readable = new ReadableStream<R>({
    start(controller) {
      unsubscribe = bus.subscribe(topicID, (payload) => {
        Promise.resolve(unwrap(payload))
          .then((bytes) => controller.enqueue(decode<R>(bytes)))
          .catch((error) => controller.error(error))
      })
    },
    cancel() {
      unsubscribe?.()
    },
  })

  const writable = new WritableStream<W>({
    async write(value) {
      const bytes = await wrap(encode(value))
      await bus.publish(topicID, bytes)
    },
    close() {
      unsubscribe?.()
    },
  })

  return new Transport<R, W>({ stream: { readable, writable }, signal })
}
```

- [ ] **Step 4: Re-export from the barrel**

Edit `packages/broadcast/src/index.ts` — append:

```ts
export {
  type BroadcastMessage,
  type BroadcastTransportParams,
  type ByteTransform,
  createBroadcastTransport,
} from './transport.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/transport.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add packages/broadcast/src/transport.ts packages/broadcast/src/index.ts packages/broadcast/test/transport.test.ts
git commit -m "feat(broadcast): add createBroadcastTransport over a bus topic"
```

---

### Task 5: `BroadcastClient` — `dispatch`, `request`, `gather`

**Files:**
- Create: `packages/broadcast/src/client.ts`
- Modify: `packages/broadcast/src/index.ts`
- Test: `packages/broadcast/test/client.test.ts`

**Interfaces:**
- Consumes: `Disposer` from `@enkaku/async`; `TransportType` from `@enkaku/transport`; `BroadcastMessage` from `./transport.js`.
- Produces:
  - `type RequestData = { kind: 'req'; rid: string; prm: unknown }`.
  - `type ReplyData = { kind: 'res'; rid: string; from: string; ok?: unknown; err?: string }`.
  - `type RequestOptions = { errorThreshold?: number; timeoutMs?: number }`.
  - `type GatherOptions = { quorum?: number; timeoutMs?: number }`.
  - `type GatheredReply = { from: string; value: unknown }`.
  - `class BroadcastClient extends Disposer` with constructor `{ transport: TransportType<BroadcastMessage, BroadcastMessage>; getRandomID?: () => string }` and methods:
    - `dispatch(prc: string, data?: Record<string, unknown>): Promise<void>` — fire-and-forget event.
    - `request(prc: string, prm?: unknown, options?: RequestOptions): Promise<unknown>` — broadcast a request-event; resolve with the first non-error reply's `ok`; reject once `errorThreshold` error replies arrive (default `Infinity`); reject on `timeoutMs` (default `5000`).
    - `gather(prc: string, prm?: unknown, options?: GatherOptions): Promise<Array<GatheredReply>>` — collect distinct-`from` non-error replies until `quorum` (default `Infinity`) or `timeoutMs` (default `5000`); resolve with the collected replies.
  - The reply envelope (`{ kind: 'res', rid, from, ok?/err? }`) is the contract the responder (Task 6) produces.

- [ ] **Step 1: Write the failing test**

Create `packages/broadcast/test/client.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { createMemoryBus } from '../src/bus.js'
import { BroadcastClient } from '../src/client.js'
import { type BroadcastMessage, createBroadcastTransport } from '../src/transport.js'

const TOPIC = 'group-topic'

// Minimal responder used only to exercise the client: replies to 'req' events.
function startResponder(
  bus: ReturnType<typeof createMemoryBus>,
  from: string,
  reply: (prm: unknown) => { ok?: unknown; err?: string },
): TransportTypeHandle {
  const transport = createBroadcastTransport({ topicID: TOPIC, bus })
  let running = true
  ;(async () => {
    for await (const msg of transport as AsyncIterable<BroadcastMessage>) {
      if (!running) break
      const data = msg.payload.data as { kind?: string; rid?: string; prm?: unknown } | undefined
      if (msg.payload.typ !== 'event' || data?.kind !== 'req') continue
      const out = reply(data.prm)
      await transport.write({
        payload: {
          typ: 'event',
          prc: msg.payload.prc,
          data: { kind: 'res', rid: data.rid, from, ...out },
        },
      })
    }
  })()
  return {
    dispose: async () => {
      running = false
      await transport.dispose()
    },
  }
}

type TransportTypeHandle = { dispose: () => Promise<void> }

describe('BroadcastClient.request', () => {
  test('resolves with the first non-error reply', async () => {
    const bus = createMemoryBus()
    const r1 = startResponder(bus, 'peer-1', () => ({ ok: { value: 'from-1' } }))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const result = await client.request('catchup', { since: 0 }, { timeoutMs: 1000 })
    expect(result).toEqual({ value: 'from-1' })

    await client.dispose()
    await r1.dispose()
  })

  test('rejects after errorThreshold error replies', async () => {
    const bus = createMemoryBus()
    const r1 = startResponder(bus, 'peer-1', () => ({ err: 'nope' }))
    const r2 = startResponder(bus, 'peer-2', () => ({ err: 'nope' }))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    await expect(
      client.request('catchup', {}, { errorThreshold: 2, timeoutMs: 1000 }),
    ).rejects.toThrow(/error/i)

    await client.dispose()
    await r1.dispose()
    await r2.dispose()
  })

  test('rejects on timeout when no reply arrives', async () => {
    const bus = createMemoryBus()
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    await expect(client.request('catchup', {}, { timeoutMs: 50 })).rejects.toThrow(/timed out/i)

    await client.dispose()
  })
})

describe('BroadcastClient.gather', () => {
  test('collects distinct replies up to quorum', async () => {
    const bus = createMemoryBus()
    const r1 = startResponder(bus, 'peer-1', () => ({ ok: 1 }))
    const r2 = startResponder(bus, 'peer-2', () => ({ ok: 2 }))
    const r3 = startResponder(bus, 'peer-3', () => ({ ok: 3 }))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const replies = await client.gather('census', {}, { quorum: 2, timeoutMs: 1000 })
    expect(replies).toHaveLength(2)
    expect(replies.every((r) => typeof r.from === 'string')).toBe(true)

    await client.dispose()
    await r1.dispose()
    await r2.dispose()
    await r3.dispose()
  })

  test('returns whatever arrived before timeout when quorum not reached', async () => {
    const bus = createMemoryBus()
    const r1 = startResponder(bus, 'peer-1', () => ({ ok: 'a' }))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const replies = await client.gather('census', {}, { quorum: 5, timeoutMs: 100 })
    expect(replies).toEqual([{ from: 'peer-1', value: 'a' }])

    await client.dispose()
    await r1.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/client.test.ts`
Expected: FAIL — cannot resolve `../src/client.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/broadcast/src/client.ts`:

```ts
import { Disposer } from '@enkaku/async'
import type { TransportType } from '@enkaku/transport'

import type { BroadcastMessage } from './transport.js'

export type RequestData = { kind: 'req'; rid: string; prm: unknown }
export type ReplyData = { kind: 'res'; rid: string; from: string; ok?: unknown; err?: string }

export type RequestOptions = { errorThreshold?: number; timeoutMs?: number }
export type GatherOptions = { quorum?: number; timeoutMs?: number }
export type GatheredReply = { from: string; value: unknown }

export type BroadcastClientParams = {
  transport: TransportType<BroadcastMessage, BroadcastMessage>
  getRandomID?: () => string
}

const DEFAULT_TIMEOUT_MS = 5000

function defaultRandomID(): string {
  return globalThis.crypto.randomUUID()
}

type Collector = (reply: ReplyData) => void

export class BroadcastClient extends Disposer {
  #transport: TransportType<BroadcastMessage, BroadcastMessage>
  #getRandomID: () => string
  #pending: Map<string, Collector> = new Map()

  constructor(params: BroadcastClientParams) {
    super({
      dispose: async (reason?: unknown) => {
        await this.#transport.dispose(reason)
      },
    })
    this.#transport = params.transport
    this.#getRandomID = params.getRandomID ?? defaultRandomID
    this.#read()
  }

  async #read(): Promise<void> {
    for await (const msg of this.#transport) {
      const payload = msg?.payload
      if (payload?.typ !== 'event') {
        continue
      }
      const data = payload.data as Partial<ReplyData> | undefined
      if (data?.kind === 'res' && typeof data.rid === 'string') {
        this.#pending.get(data.rid)?.(data as ReplyData)
      }
    }
  }

  async dispatch(prc: string, data: Record<string, unknown> = {}): Promise<void> {
    await this.#transport.write({ payload: { typ: 'event', prc, data } })
  }

  async request(prc: string, prm: unknown = {}, options: RequestOptions = {}): Promise<unknown> {
    const rid = this.#getRandomID()
    const errorThreshold = options.errorThreshold ?? Number.POSITIVE_INFINITY
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

    return new Promise<unknown>((resolve, reject) => {
      let errorCount = 0
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Broadcast request "${prc}" timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      const cleanup = () => {
        clearTimeout(timer)
        this.#pending.delete(rid)
      }
      this.#pending.set(rid, (reply) => {
        if (reply.err != null) {
          errorCount += 1
          if (errorCount >= errorThreshold) {
            cleanup()
            reject(new Error(`Broadcast request "${prc}" failed after ${errorCount} errors`))
          }
          return
        }
        cleanup()
        resolve(reply.ok)
      })
      this.#transport
        .write({ payload: { typ: 'event', prc, data: { kind: 'req', rid, prm } } })
        .catch((error) => {
          cleanup()
          reject(error)
        })
    })
  }

  async gather(
    prc: string,
    prm: unknown = {},
    options: GatherOptions = {},
  ): Promise<Array<GatheredReply>> {
    const rid = this.#getRandomID()
    const quorum = options.quorum ?? Number.POSITIVE_INFINITY
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

    return new Promise<Array<GatheredReply>>((resolve) => {
      const replies: Array<GatheredReply> = []
      const seen = new Set<string>()
      const finish = () => {
        clearTimeout(timer)
        this.#pending.delete(rid)
        resolve(replies)
      }
      const timer = setTimeout(finish, timeoutMs)
      this.#pending.set(rid, (reply) => {
        if (reply.err != null || seen.has(reply.from)) {
          return
        }
        seen.add(reply.from)
        replies.push({ from: reply.from, value: reply.ok })
        if (replies.length >= quorum) {
          finish()
        }
      })
      this.#transport
        .write({ payload: { typ: 'event', prc, data: { kind: 'req', rid, prm } } })
        .catch(() => finish())
    })
  }
}
```

- [ ] **Step 4: Re-export from the barrel**

Edit `packages/broadcast/src/index.ts` — append:

```ts
export {
  BroadcastClient,
  type BroadcastClientParams,
  type GatherOptions,
  type GatheredReply,
  type ReplyData,
  type RequestData,
  type RequestOptions,
} from './client.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/client.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit**

```bash
git add packages/broadcast/src/client.ts packages/broadcast/src/index.ts packages/broadcast/test/client.test.ts
git commit -m "feat(broadcast): add BroadcastClient with dispatch/request/gather"
```

---

### Task 6: `createBroadcastResponder` + `suppressible`

**Files:**
- Create: `packages/broadcast/src/responder.ts`
- Modify: `packages/broadcast/src/index.ts`
- Test: `packages/broadcast/test/responder.test.ts`

**Interfaces:**
- Consumes: `TransportType` from `@enkaku/transport`; `BroadcastMessage` from `./transport.js`; `ReplyData`/`RequestData` from `./client.js`.
- Produces:
  - `type BroadcastHandler = (prm: unknown) => unknown | Promise<unknown>`.
  - `type SuppressConfig = { jitterMs?: number; suppressTtlMs?: number }`.
  - `type SuppressibleHandler = BroadcastHandler & { suppress: SuppressConfig }`.
  - `suppressible(handler: BroadcastHandler, config?: SuppressConfig): SuppressibleHandler` — tags a handler so the responder applies jitter + observe-and-suppress storm-collapse.
  - `type BroadcastResponderParams = { transport: TransportType<BroadcastMessage, BroadcastMessage>; from: string; handlers: Record<string, BroadcastHandler | SuppressibleHandler>; sleep?: (ms: number) => Promise<void>; getJitterMs?: (maxMs: number) => number }`.
  - `createBroadcastResponder(params: BroadcastResponderParams): { dispose: () => Promise<void> }` — reads request-events for known procedures, runs the handler, and writes a reply-event `{ kind: 'res', rid, from, ok|err }`. For `suppressible` handlers it first waits a jitter and suppresses its reply if it has already observed any reply for that `rid` on the topic.

- [ ] **Step 1: Write the failing test**

Create `packages/broadcast/test/responder.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'

import { createMemoryBus } from '../src/bus.js'
import { BroadcastClient } from '../src/client.js'
import { createBroadcastResponder, suppressible } from '../src/responder.js'
import { type BroadcastMessage, createBroadcastTransport } from '../src/transport.js'

const TOPIC = 'group-topic'

describe('createBroadcastResponder', () => {
  test('answers a request from the client', async () => {
    const bus = createMemoryBus()
    const responder = createBroadcastResponder({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
      from: 'peer-1',
      handlers: { add: (prm) => (prm as { n: number }).n + 1 },
    })
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const result = await client.request('add', { n: 41 }, { timeoutMs: 1000 })
    expect(result).toBe(42)

    await client.dispose()
    await responder.dispose()
  })

  test('reports a thrown handler error as an error reply', async () => {
    const bus = createMemoryBus()
    const responder = createBroadcastResponder({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
      from: 'peer-1',
      handlers: {
        boom: () => {
          throw new Error('kaboom')
        },
      },
    })
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    await expect(
      client.request('boom', {}, { errorThreshold: 1, timeoutMs: 1000 }),
    ).rejects.toThrow(/error/i)

    await client.dispose()
    await responder.dispose()
  })

  test('suppressible: a slow responder stays silent once it sees another reply', async () => {
    const bus = createMemoryBus()
    // Deterministic jitter: peer-1 replies immediately, peer-2 waits long enough
    // to observe peer-1's reply and suppress itself.
    const fast = createBroadcastResponder({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
      from: 'peer-1',
      handlers: { catchup: suppressible(() => 'answer', { jitterMs: 100 }) },
      getJitterMs: () => 0,
    })
    const slowHandler = vi.fn(() => 'answer')
    const slow = createBroadcastResponder({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
      from: 'peer-2',
      handlers: { catchup: suppressible(slowHandler, { jitterMs: 100 }) },
      getJitterMs: () => 50,
    })
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const replies = await client.gather('catchup', {}, { timeoutMs: 200 })
    expect(replies).toEqual([{ from: 'peer-1', value: 'answer' }])
    expect(slowHandler).not.toHaveBeenCalled()

    await client.dispose()
    await fast.dispose()
    await slow.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/responder.test.ts`
Expected: FAIL — cannot resolve `../src/responder.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/broadcast/src/responder.ts`:

```ts
import type { TransportType } from '@enkaku/transport'

import type { ReplyData, RequestData } from './client.js'
import type { BroadcastMessage } from './transport.js'

export type BroadcastHandler = (prm: unknown) => unknown | Promise<unknown>
export type SuppressConfig = { jitterMs?: number; suppressTtlMs?: number }
export type SuppressibleHandler = BroadcastHandler & { suppress: SuppressConfig }

const DEFAULT_JITTER_MS = 250
const DEFAULT_SUPPRESS_TTL_MS = 30_000

/** Tag a handler for jitter + observe-and-suppress storm-collapse. */
export function suppressible(
  handler: BroadcastHandler,
  config: SuppressConfig = {},
): SuppressibleHandler {
  return Object.assign(handler.bind(null) as BroadcastHandler, { suppress: config })
}

function isSuppressible(handler: BroadcastHandler): handler is SuppressibleHandler {
  return (handler as SuppressibleHandler).suppress != null
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function defaultJitter(maxMs: number): number {
  return Math.floor(Math.random() * (maxMs + 1))
}

export type BroadcastResponderParams = {
  transport: TransportType<BroadcastMessage, BroadcastMessage>
  from: string
  handlers: Record<string, BroadcastHandler | SuppressibleHandler>
  sleep?: (ms: number) => Promise<void>
  getJitterMs?: (maxMs: number) => number
}

export function createBroadcastResponder(params: BroadcastResponderParams): {
  dispose: () => Promise<void>
} {
  const { transport, from, handlers } = params
  const sleep = params.sleep ?? defaultSleep
  const getJitterMs = params.getJitterMs ?? defaultJitter

  // Request IDs for which any reply (ours or another peer's) has been observed.
  const repliedTo = new Set<string>()
  let running = true

  const markReplied = (rid: string, ttlMs: number) => {
    repliedTo.add(rid)
    setTimeout(() => repliedTo.delete(rid), ttlMs)
  }

  const handleRequest = async (
    prc: string,
    request: RequestData,
    handler: BroadcastHandler | SuppressibleHandler,
  ): Promise<void> => {
    if (isSuppressible(handler)) {
      const { jitterMs = DEFAULT_JITTER_MS } = handler.suppress
      await sleep(getJitterMs(jitterMs))
      if (repliedTo.has(request.rid)) {
        return
      }
    }

    let reply: ReplyData
    try {
      const ok = await handler(request.prm)
      reply = { kind: 'res', rid: request.rid, from, ok }
    } catch (error) {
      reply = {
        kind: 'res',
        rid: request.rid,
        from,
        err: error instanceof Error ? error.message : String(error),
      }
    }
    const ttlMs = isSuppressible(handler)
      ? (handler.suppress.suppressTtlMs ?? DEFAULT_SUPPRESS_TTL_MS)
      : DEFAULT_SUPPRESS_TTL_MS
    markReplied(request.rid, ttlMs)
    await transport.write({ payload: { typ: 'event', prc, data: reply } })
  }

  ;(async () => {
    for await (const msg of transport) {
      if (!running) {
        break
      }
      const payload = msg?.payload
      if (payload?.typ !== 'event') {
        continue
      }
      const data = payload.data as Partial<ReplyData & RequestData> | undefined
      if (data?.kind === 'res' && typeof data.rid === 'string') {
        markReplied(data.rid, DEFAULT_SUPPRESS_TTL_MS)
        continue
      }
      if (data?.kind !== 'req' || typeof data.rid !== 'string' || typeof payload.prc !== 'string') {
        continue
      }
      const handler = handlers[payload.prc]
      if (handler != null) {
        void handleRequest(payload.prc, data as RequestData, handler)
      }
    }
  })()

  return {
    dispose: async () => {
      running = false
      await transport.dispose()
    },
  }
}
```

- [ ] **Step 4: Re-export from the barrel**

Edit `packages/broadcast/src/index.ts` — append:

```ts
export {
  type BroadcastHandler,
  type BroadcastResponderParams,
  createBroadcastResponder,
  type SuppressConfig,
  type SuppressibleHandler,
  suppressible,
} from './responder.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/responder.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add packages/broadcast/src/responder.ts packages/broadcast/src/index.ts packages/broadcast/test/responder.test.ts
git commit -m "feat(broadcast): add createBroadcastResponder with suppressible storm-collapse"
```

---

### Task 7: Group-protocol scaffold types

**Files:**
- Create: `packages/broadcast/src/protocol.ts`
- Modify: `packages/broadcast/src/index.ts`
- Test: `packages/broadcast/test/protocol.test.ts`

**Interfaces:**
- Consumes: `ProtocolDefinition` from `@enkaku/protocol`.
- Produces:
  - `type GroupProtocolDefinition = ProtocolDefinition` — alias marking a protocol used over a group substrate (all four call types allowed; routing happens in `@enkaku/group-rpc`, Phase 3).
  - `defineGroupProtocol<Definition extends GroupProtocolDefinition>(definition: Definition): Definition` — identity helper that preserves the literal type for downstream inference.

- [ ] **Step 1: Write the failing test**

Create `packages/broadcast/test/protocol.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { defineGroupProtocol } from '../src/protocol.js'

describe('defineGroupProtocol', () => {
  test('returns the protocol definition unchanged and preserves keys', () => {
    const protocol = defineGroupProtocol({
      'group/ping': { type: 'event' },
      'group/catchup': {
        type: 'request',
        param: { type: 'object', properties: { since: { type: 'number' } } },
        result: { type: 'object' },
      },
    })
    expect(Object.keys(protocol)).toEqual(['group/ping', 'group/catchup'])
    expect(protocol['group/ping'].type).toBe('event')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/protocol.test.ts`
Expected: FAIL — cannot resolve `../src/protocol.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/broadcast/src/protocol.ts`:

```ts
import type { ProtocolDefinition } from '@enkaku/protocol'

/**
 * A protocol run over a group broadcast substrate. Any of the four Enkaku call
 * types (event / request / stream / channel) may be declared; the addressing
 * that decides bus vs directed delivery is applied by `@enkaku/group-rpc`
 * (Phase 3), not here. This is a scaffold type, mirroring `@enkaku/hub-protocol`.
 */
export type GroupProtocolDefinition = ProtocolDefinition

/**
 * Identity helper that returns the protocol definition unchanged while
 * preserving its literal type for downstream type inference.
 */
export function defineGroupProtocol<Definition extends GroupProtocolDefinition>(
  definition: Definition,
): Definition {
  return definition
}
```

- [ ] **Step 4: Re-export from the barrel**

Edit `packages/broadcast/src/index.ts` — append:

```ts
export { defineGroupProtocol, type GroupProtocolDefinition } from './protocol.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/broadcast exec vitest run test/protocol.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 6: Commit**

```bash
git add packages/broadcast/src/protocol.ts packages/broadcast/src/index.ts packages/broadcast/test/protocol.test.ts
git commit -m "feat(broadcast): add group-protocol scaffold types"
```

---

### Task 8: Full package verification + docs

**Files:**
- Modify: `packages/broadcast/src/index.ts` (verify exports only)
- Create: `packages/broadcast/README.md`

**Interfaces:**
- Consumes: every module from Tasks 2–7.
- Produces: a fully building, fully tested `@enkaku/broadcast` package.

- [ ] **Step 1: Run the full package test suite (types + unit)**

Run: `pnpm --filter @enkaku/broadcast run test`
Expected: `test:types` passes with no errors; all unit suites pass (smoke + topic + bus + transport + client + responder + protocol).

- [ ] **Step 2: Build the package**

Run: `pnpm --filter @enkaku/broadcast run build`
Expected: builds `lib/` with no errors.

- [ ] **Step 3: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no lint errors in `packages/broadcast`.

- [ ] **Step 4: Write the README**

Create `packages/broadcast/README.md`:

```md
# @enkaku/broadcast

Generic fan-out broadcast primitives for Enkaku RPC: a topic-addressed
broadcast transport, an anycast/gather client, a responder with storm-collapse,
and opaque topic-ID derivation. No MLS, hub, or DID coupling — the consumer
supplies a `BroadcastBus`, a `wrap`/`unwrap` byte transform, and the keying
material fed to `deriveTopicID`.

## Installation

\```sh
npm install @enkaku/broadcast
\```

## Exports

- `deriveTopicID(secret, epoch, label, scope?)` — opaque HKDF-SHA256 topic ID.
- `createBroadcastTransport({ topicID, bus, wrap?, unwrap? })` — `TransportType` over one topic.
- `BroadcastClient` — `dispatch` (event), `request` (anycast first-wins), `gather` (collect).
- `createBroadcastResponder` + `suppressible` — the responding side with jitter/suppression.
- `defineGroupProtocol` / `GroupProtocolDefinition` — protocol scaffold types.
- `BroadcastBus` / `createMemoryBus` — the bus interface and an in-process fake.
```

- [ ] **Step 5: Commit**

```bash
git add packages/broadcast/README.md
git commit -m "docs(broadcast): add package README"
```

---

## Self-Review

**Spec coverage (Phase 1 section):**
- BroadcastTransport (one topic, events bus, `wrap`/`unwrap`) → Task 4. ✓
- BroadcastClient (`dispatch`/`request` first-wins+threshold+timeout / `gather` quorum) → Task 5. ✓
- Reply-on-bus correlation by `(requestID, senderDID/from)` → Tasks 5 + 6 (`ReplyData.from`). ✓
- `suppressible` responder helper (jitter + observe-and-suppress) → Task 6. ✓
- Group-protocol scaffold types → Task 7. ✓
- `deriveTopicID(secret, epoch, label[, scope])` HKDF-SHA256, generic param names → Task 2. ✓
- Inbox/discovery topics intentionally absent (moved to Phase 3 group-rpc) — confirmed not in this plan. ✓
- Zero MLS/hub/DID deps → manifest in Task 1 (no `@enkaku/group`, no hub packages). ✓
- In-process testable against fakes → `createMemoryBus` (Task 3) used throughout. ✓
- Directed stream/channel via plain `Client` is a Phase 3 concern → correctly out of scope here. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code; every run step has an exact command + expected outcome.

**Type consistency:** `BroadcastMessage` (Task 4) is consumed by Tasks 5–6. `ReplyData`/`RequestData` (Task 5) are consumed by Task 6. `BroadcastBus` (Task 3) is consumed by Task 4. `deriveTopicID` signature matches the spec. Reply envelope `{ kind: 'res', rid, from, ok?, err? }` is produced by Task 6's responder and consumed by Task 5's client — identical field names.

**Note for the executor:** Tasks are strictly ordered; each builds on the previous module and its exports. Run `pnpm install` once (Task 1, Step 4) before later tasks resolve workspace imports.
