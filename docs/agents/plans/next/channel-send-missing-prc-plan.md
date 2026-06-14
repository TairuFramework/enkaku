# Channel `send` missing `prc` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Client.createChannel().send()` include `prc` so protocol-validating servers stop silently discarding channel sends, and surface send-validation failures instead of dropping them.

**Architecture:** Three production edits — (1) client send payload gains `prc`, (2) `SendCallPayload` type gains `prc`, (3) server validation-failure branch emits an error reply for `send`. Each is TDD'd; a hub regression test locks in the original downstream symptom.

**Tech Stack:** TypeScript, vitest, pnpm workspace. Tests use `@enkaku/transport`'s `DirectTransports` and (for round-trip) `@enkaku/standalone`.

**Design:** `docs/agents/plans/next/channel-send-missing-prc-design.md`

**Ground truth established before writing this plan (current HEAD, unfixed):**
- Standalone channel with a `protocol` passed (validator on): a `send(42)` never reaches the handler — received `[]`. (Task 1 RED, proven.)
- Hub `hub/receive` ack: `store.ack` is called **0 times** after `channel.send({ ack })`. (Task 4 RED, proven.)
- The existing `hub/receive ack flow` test (hub.test.ts:309) passes anyway — its assertion is too weak to catch the dropped ack; Task 4 adds the precise `store.ack` spy.

**Conventions (repo guardrails):**
- `type` not `interface`; `Array<T>` not `T[]`; no `any` (`unknown`/`Record<string, unknown>`); `ID`/`HTTP` casing.
- `pnpm` only. Lint via `rtk proxy pnpm run lint` (not bare `pnpm run lint`).
- Run a single package's tests with: `pnpm --filter <pkg> exec vitest run <pattern>`.

---

### Task 1: Client send payload includes `prc` (core fix)

**Files:**
- Create: `packages/standalone/test/channel-send-validated.test.ts`
- Modify: `packages/client/src/client.ts:809`

- [ ] **Step 1: Write the failing round-trip test**

The existing standalone channel test (`packages/standalone/test/lib.test.ts:115`) passes **no** `protocol`, so the server validator is off and the bug is masked. This new test passes `protocol`, turning the validator on.

Create `packages/standalone/test/channel-send-validated.test.ts`:

```ts
import type { ProtocolDefinition } from '@enkaku/protocol'
import type { ChannelHandler } from '@enkaku/server'
import { describe, expect, test, vi } from 'vitest'

import { standalone } from '../src/index.js'

describe('channel send with validation enabled', () => {
  test('real client send reaches the handler when the server has a protocol', async () => {
    const protocol = {
      test: {
        type: 'channel',
        param: { type: 'number' },
        send: { type: 'number' },
        receive: { type: 'number' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const received: Array<number> = []
    const handler = vi.fn<ChannelHandler<Protocol, 'test'>>(async (ctx) => {
      const reader = ctx.readable.getReader()
      const { value } = await reader.read()
      if (value != null) {
        received.push(value)
      }
      return 'END'
    })

    // Passing `protocol` makes the server build a validator.
    const client = standalone<Protocol>({ test: handler }, { requireAuth: false, protocol })

    const channel = client.createChannel('test', { param: 5 })
    await channel.send(42)
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(received).toEqual([42])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @enkaku/standalone exec vitest run channel-send-validated`
Expected: FAIL — `expected [] to deeply equal [ 42 ]` (send dropped by the validator).

- [ ] **Step 3: Add `prc` to the client send payload**

In `packages/client/src/client.ts`, the `send` closure inside `createChannel` (line ~808). `procedure` is the `createChannel` parameter and is in scope. Change:

```ts
      await this.#write(
        { typ: 'send', rid, val } as unknown as AnyClientPayloadOf<Protocol>,
        config.header,
        rid,
      )
```

to:

```ts
      await this.#write(
        { typ: 'send', prc: procedure, rid, val } as unknown as AnyClientPayloadOf<Protocol>,
        config.header,
        rid,
      )
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @enkaku/standalone exec vitest run channel-send-validated`
Expected: PASS.

- [ ] **Step 5: Run the existing standalone + client suites (no regressions)**

Run: `pnpm --filter @enkaku/standalone exec vitest run && pnpm --filter @enkaku/client exec vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/standalone/test/channel-send-validated.test.ts packages/client/src/client.ts
git commit -m "fix(client): include prc in channel send payload

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `SendCallPayload` type requires `prc`

Removes the blindness the `as unknown as AnyClientPayloadOf` cast relied on, so the type now enforces what the schema requires. There is no runtime test for a type; verification is `tsc` via `build:types`.

**Files:**
- Modify: `packages/protocol/src/types/calls.ts:27-31` and `:33-37`
- Modify: `packages/protocol/src/types/payloads.ts:50-52` and `:63-67`

- [ ] **Step 1: Add the `Procedure` generic + `prc` to `SendCallPayload`**

In `packages/protocol/src/types/calls.ts`, change:

```ts
export type SendCallPayload<Value> = {
  typ: 'send'
  rid: string
  val: Value
}
```

to:

```ts
export type SendCallPayload<Procedure extends string, Value> = {
  typ: 'send'
  prc: Procedure
  rid: string
  val: Value
}
```

- [ ] **Step 2: Update `UnknownCallPayload` in the same file**

In `packages/protocol/src/types/calls.ts`, change the `SendCallPayload<unknown>` member of `UnknownCallPayload`:

```ts
  | SendCallPayload<unknown>
```

to:

```ts
  | SendCallPayload<string, unknown>
```

- [ ] **Step 3: Thread the generic through `payloads.ts`**

In `packages/protocol/src/types/payloads.ts`:

`SendPayloadOf` (line ~50) — there is no `Procedure` in scope here, so type `prc` as `string`:

```ts
export type SendPayloadOf<Definition> = Definition extends ChannelProcedureDefinition
  ? SendCallPayload<string, DataOf<Definition['send']>>
  : never
```

`ClientPayloadOf` channel branch (line ~66) — `Procedure` IS in scope, so pass it:

```ts
        ?
            | RequestCallPayload<'channel', Procedure, DataOf<Definition['param']>>
            | SendCallPayload<Procedure, DataOf<Definition['send']>>
            | AbortCallPayload
```

- [ ] **Step 4: Type-check the protocol package and its dependents**

Run: `pnpm run -r build:types`
Expected: completes with no errors (every package's `build:types` prints `Done`). This compiles `protocol`, `client`, `server`, `standalone`, `hub-*` against the new type.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src/types/calls.ts packages/protocol/src/types/payloads.ts
git commit -m "fix(protocol): require prc on SendCallPayload

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Server replies with an error for an invalid `send` (ergonomics)

Today the validation-failure branch only emits an error reply for `request | stream | channel`; `send` is dropped with no reply (only an `invalidMessage` event). A send shares the channel's `rid`, so the reply routes through the client's existing `'error'` path and tears the channel down — the intended, accepted behavior (loud beats silent).

**Files:**
- Create: `packages/server/test/channel-send-invalid.test.ts`
- Modify: `packages/server/src/server.ts:186`

- [ ] **Step 1: Write the failing test**

Mirrors `packages/server/test/invalid-message-reply.test.ts` (which asserts code `EK08` = `ErrorCodes.INVALID_MESSAGE`). The handler reads `ctx.readable` forever to keep the channel open so a controller exists for the send's `rid`.

Create `packages/server/test/channel-send-invalid.test.ts`:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  chat: {
    type: 'channel',
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Invalid channel send', () => {
  test('replies EK08 and emits invalidMessage for a send with an invalid value', async () => {
    const handler = vi.fn(async (ctx: { readable: ReadableStream<string> }) => {
      // Keep the channel open so a controller exists for the send's rid.
      for await (const _value of ctx.readable) {
        // drain
      }
      return 'done'
    })
    const handlers = { chat: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers,
      protocol,
      transport: transports.server,
    })

    const invalidEvents: Array<unknown> = []
    server.events.on('invalidMessage', (event) => {
      invalidEvents.push(event)
    })

    // Open the channel so a controller is registered for rid 'c1'.
    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'chat',
        rid: 'c1',
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Send a value that violates the send schema (number, not string).
    await transports.client.write(
      createUnsignedToken({
        typ: 'send',
        prc: 'chat',
        rid: 'c1',
        val: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('c1')
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')
    expect(invalidEvents.length).toBe(1)

    await server.dispose()
    await transports.dispose()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @enkaku/server exec vitest run channel-send-invalid`
Expected: FAIL — `transports.client.read()` never yields an `error` payload (the send is silently dropped), so the assertion times out / `response.value` is undefined.

- [ ] **Step 3: Add `send` to the reply-capable types**

In `packages/server/src/server.ts` (line ~186), change:

```ts
            if (
              typeof rid === 'string' &&
              (typ === 'request' || typ === 'stream' || typ === 'channel')
            ) {
```

to:

```ts
            if (
              typeof rid === 'string' &&
              (typ === 'request' || typ === 'stream' || typ === 'channel' || typ === 'send')
            ) {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @enkaku/server exec vitest run channel-send-invalid`
Expected: PASS.

- [ ] **Step 5: Run the full server suite (no regressions)**

Run: `pnpm --filter @enkaku/server exec vitest run`
Expected: all PASS (including `invalid-message-reply` and `channel-send-auth`).

- [ ] **Step 6: Commit**

```bash
git add packages/server/test/channel-send-invalid.test.ts packages/server/src/server.ts
git commit -m "fix(server): reply with error for invalid channel send instead of dropping

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Hub regression — ack drains the store

Locks in the original downstream symptom (kubun hub mailboxes never drained). The existing `hub/receive ack flow` test passes even with the bug because it only checks reconnect ordering; this test spies `store.ack` directly. With Task 1 applied this test passes; before Task 1 it failed (proven: `store.ack` called 0 times).

**Files:**
- Modify: `packages/hub-server/test/hub.test.ts` (add `vi` to the vitest import; append one test)

- [ ] **Step 1: Add `vi` to the vitest import**

In `packages/hub-server/test/hub.test.ts:8`, change:

```ts
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
```

to:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
```

- [ ] **Step 2: Append the regression test**

Add this test inside the same `describe` block that contains `hub/receive ack flow` (after that test, before the closing `})` of the block). It reuses the file's `createTestHub`, `encodePayload`, `delay`, `createMemoryStore`, and `randomIdentity` helpers:

```ts
  test('hub/receive ack drains the store (store.ack is called)', async () => {
    const store = createMemoryStore()
    const ackSpy = vi.spyOn(store, 'ack')
    const ctx = createTestHub({ store })
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()

    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('msg-1') },
    })
    await delay(50)

    const { client: bob } = ctx.connect(bobIdentity)
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg1 = await reader.read()
    const sequenceID = msg1.value?.sequenceID
    expect(sequenceID).toBeDefined()

    await channel.send({ ack: [sequenceID as string] })
    await delay(50)

    expect(ackSpy).toHaveBeenCalledWith({
      recipientDID: bobIdentity.id,
      sequenceIDs: [sequenceID],
    })

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await ctx.dispose()
  })
```

- [ ] **Step 3: Run the hub suite to verify it passes**

Run: `pnpm --filter @enkaku/hub-server exec vitest run hub`
Expected: PASS (new test green; `hub/receive ack flow` still green).

- [ ] **Step 4: Commit**

```bash
git add packages/hub-server/test/hub.test.ts
git commit -m "test(hub-server): assert hub/receive ack drains the store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `pnpm run test`
Expected: type checks + all unit tests PASS.

- [ ] **Step 2: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors (formatting applied if needed).

- [ ] **Step 3: Commit any lint-applied formatting (only if files changed)**

```bash
git add -A
git commit -m "chore: lint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** core client fix → Task 1; type fix → Task 2; ergonomics (Approach A) → Task 3; round-trip test → Task 1; no-silent-drop regression → Task 3; hub end-to-end → Task 4; verification → Task 5. All design sections covered.
- **Type consistency:** `SendCallPayload<Procedure extends string, Value>` defined in Task 2 is used as `SendCallPayload<string, ...>` (SendPayloadOf, UnknownCallPayload) and `SendCallPayload<Procedure, ...>` (ClientPayloadOf) — consistent arity.
- **No placeholders:** every code/test/command step is concrete and was checked against current source line numbers.
