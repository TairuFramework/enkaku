# Handler Error Discriminator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** reviewing

**Goal:** Extend `Server.events.handlerError` with `category` and `messageType` discriminators, emit it from every handler-failure site (including the four auth-denial sites that currently emit nothing), and remove `eventAuthError`.

**Architecture:** Single observation event for all handler failures. Two new required payload fields (`category: 'auth' | 'limit' | 'encryption' | 'handler'`, `messageType: 'event' | 'request' | 'channel' | 'stream' | 'send'`) classify each emission. Client-visible error payloads are unchanged; the change is observation-only.

**Tech Stack:** TypeScript, Vitest, `@enkaku/event` EventEmitter, `pnpm` workspace.

**Spec:** `docs/superpowers/specs/2026-05-08-handler-error-discriminator-design.md`

---

## File Structure

**Modified files:**

- `packages/server/src/types.ts` — add `HandlerErrorCategory`, `HandlerErrorMessageType` types; extend `handlerError` payload with required `category` + `messageType`; remove `eventAuthError` from `ServerEvents`.
- `packages/server/src/server.ts` — add `category` + `messageType` to all 7 existing `handlerError` emit calls in this file; add 4 new emit calls (request/channel/stream auth-deny, send unsigned, send issuer-mismatch, encryption-violation non-event); remove the `eventAuthError` emit.
- `packages/server/src/utils.ts` — add `category:'handler'` + `messageType` to the existing emit at line 79.
- `packages/server/src/handlers/event.ts` — add `category:'handler'`, `messageType:'event'` to the existing emit at line 55.

**Modified test files (existing assertions extended):**

- `packages/server/test/event-auth.test.ts` — drop `eventAuthError` listener; assert `handlerError` fires with `category:'auth'`, `messageType:'event'`. The "does not emit eventAuthError for valid signed events" test becomes "does not emit handlerError for valid signed events".
- `packages/server/test/access-control.test.ts` — for each of request/channel/stream denial paths, assert `handlerError` fires with `category:'auth'` and the matching `messageType`.
- `packages/server/test/channel-send-auth.test.ts` — for unsigned-send and issuer-mismatch tests, assert `handlerError` fires with `category:'auth'`, `messageType:'send'`.
- `packages/server/test/encryption-policy.test.ts` — extend the EK07 event-path test with `category:'encryption'`, `messageType:'event'`. Add a new test for the request-path encryption violation asserting `category:'encryption'`, `messageType:'request'`.
- `packages/server/test/buffer-limits.test.ts` — extend the EK06 size-limit test to assert `category:'limit'` and the matching `messageType`.
- `packages/server/test/limits.test.ts` — extend EK03/EK04 limit tests (if they assert on `handlerError`) with `category:'limit'`.
- `packages/server/test/event-handler.test.ts` — extend the existing handler-exception test with `category:'handler'`, `messageType:'event'`.
- `packages/server/test/utils.test.ts` — extend the existing `handlerError` assertions with `category:'handler'` and the matching `messageType`.
- `packages/server/test/stream-crash.test.ts` — extend the existing `handlerError` assertions with `category:'handler'`, `messageType:'stream'`.

No new files. No production-code reorganization beyond the field additions.

---

## Phase A: Type changes

### Task 1: Add discriminator types and update `handlerError` payload type; remove `eventAuthError`

**Files:**
- Modify: `packages/server/src/types.ts:164-189`

This is a pure type change. It will surface compile errors at every emit site, which the next phase fixes. We do NOT split this across tasks because the type and emit changes must compile together for tests to run.

- [ ] **Step 1: Edit `packages/server/src/types.ts`**

Replace the `ServerEvents` block (currently lines 164-187) and `ServerEmitter` line 189 with:

```ts
export type HandlerErrorCategory = 'auth' | 'limit' | 'encryption' | 'handler'

export type HandlerErrorMessageType = 'event' | 'request' | 'channel' | 'stream' | 'send'

export type ServerEvents = {
  disposed: { reason?: unknown }
  disposing: { reason?: unknown }
  handlerAbort: {
    rid: string
    reason: 'Close' | 'Timeout' | 'Transport' | DisposeInterruption | string | undefined
  }
  handlerEnd: { rid: string; procedure: string }
  handlerError: {
    error: HandlerError<string>
    payload: Record<string, unknown>
    category: HandlerErrorCategory
    messageType: HandlerErrorMessageType
  }
  handlerStart: { rid: string; procedure: string; type: string }
  handlerTimeout: { rid: string }
  invalidMessage: { error: Error; message: unknown }
  transportAdded: { transportID: string }
  transportRemoved: { transportID: string; reason?: unknown }
  writeDropped: { rid?: string; reason: unknown; error: Error }
  writeFailed: { error: Error; rid?: string }
}

export type ServerEmitter = EventEmitter<ServerEvents>
```

(Confirm: `eventAuthError` removed; `HandlerErrorCategory` and `HandlerErrorMessageType` exported.)

- [ ] **Step 2: Run type check (must fail)**

Run: `pnpm --filter @enkaku/server run build:types 2>&1 | head -50`

Expected: TypeScript errors at every `events.emit('handlerError', ...)` call site (missing `category` and `messageType`) and at the `events.emit('eventAuthError', ...)` site (no such event).

Do NOT commit yet — Task 2 fixes the compile errors.

---

## Phase B: Production-code emissions

### Task 2: Add `category` + `messageType` to existing `handlerError` emits; add new emits; remove `eventAuthError` emit

**Files:**
- Modify: `packages/server/src/server.ts` (multiple sites)
- Modify: `packages/server/src/utils.ts:79`
- Modify: `packages/server/src/handlers/event.ts:55`

Order: every existing emit gets the two new fields; new emit sites are added; the `eventAuthError` emit is deleted. Implemented as one task because the type changes from Task 1 must resolve before tests can run.

For convenience we use a helper expression `message.payload.typ as HandlerErrorMessageType` (or `msg.payload.typ`) wherever a generic emit covers multiple types. `'abort'` is already excluded by upstream control flow — these emits never fire on abort messages.

- [ ] **Step 1: `packages/server/src/server.ts:179` — controller-limit (EK03)**

Replace lines around 179:

```ts
events.emit('handlerError', {
  error,
  payload: message.payload,
  category: 'limit',
  messageType: message.payload.typ as HandlerErrorMessageType,
})
```

Add the import at the top of the file (alongside the existing `HandlerError` import):

```ts
import type { HandlerErrorMessageType } from './types.js'
```

- [ ] **Step 2: `packages/server/src/server.ts:192` — concurrency-limit (EK04)**

Same shape, `category: 'limit'`, `messageType: message.payload.typ as HandlerErrorMessageType`.

- [ ] **Step 3: `packages/server/src/server.ts:209` — sync handler exception (EK01)**

```ts
events.emit('handlerError', {
  error: HandlerError.from(returned, { code: 'EK01' }),
  payload: message.payload,
  category: 'handler',
  messageType: message.payload.typ as HandlerErrorMessageType,
})
```

- [ ] **Step 4: `packages/server/src/server.ts:238` — async handler exception (EK01)**

Same as Step 3 but inside the `.catch` block:

```ts
events.emit('handlerError', {
  error: HandlerError.from(err, { code: 'EK01' }),
  payload: message.payload,
  category: 'handler',
  messageType: message.payload.typ as HandlerErrorMessageType,
})
```

- [ ] **Step 5: `packages/server/src/server.ts:267-279` — encryption violation**

Rewrite `handleEncryptionViolation` to always emit (currently emits only on event-path):

```ts
function handleEncryptionViolation(message: ProcessMessageOf<Protocol>): void {
  const error = new HandlerError({
    code: 'EK07',
    message: 'Encryption required but message is not encrypted',
  })
  if (message.payload.typ !== 'event') {
    context.send(error.toPayload(message.payload.rid) as AnyServerPayloadOf<Protocol>, {
      rid: message.payload.rid,
    })
  }
  events.emit('handlerError', {
    error,
    payload: message.payload,
    category: 'encryption',
    messageType: message.payload.typ as HandlerErrorMessageType,
  })
}
```

(Both branches now emit; the only branch-specific behavior is the client `send`.)

- [ ] **Step 6: `packages/server/src/server.ts:472-480` — auth-deny block**

Rewrite the if/else:

```ts
if (message.payload.typ !== 'event') {
  context.send(error.toPayload(message.payload.rid) as AnyServerPayloadOf<Protocol>, {
    rid: message.payload.rid,
  })
}
events.emit('handlerError', {
  error,
  payload: message.payload,
  category: 'auth',
  messageType: message.payload.typ as HandlerErrorMessageType,
})
return
```

(The previous `eventAuthError` and event-path-only `handlerError` emits are removed; the new emit fires for every type, including `'event'`.)

- [ ] **Step 7: `packages/server/src/server.ts:506-518` — message-size limit (EK06)**

```ts
events.emit('handlerError', {
  error,
  payload: msg.payload,
  category: 'limit',
  messageType: msg.payload.typ as HandlerErrorMessageType,
})
```

- [ ] **Step 8: `packages/server/src/server.ts:553-575` — send-message auth checks**

Both inner branches (unsigned send, issuer mismatch) currently call `context.send` without emitting. Add an emit immediately after each `context.send`:

```ts
if (!isSignedToken(msg as Token)) {
  const error = new HandlerError({
    code: 'EK02',
    message: 'Channel send message must be signed',
  })
  context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
    rid: msg.payload.rid,
  })
  events.emit('handlerError', {
    error,
    payload: msg.payload,
    category: 'auth',
    messageType: 'send',
  })
  break
}
const sendIssuer = (msg as unknown as SignedToken).payload.iss
if (controller.issuer != null && sendIssuer !== controller.issuer) {
  const error = new HandlerError({
    code: 'EK02',
    message: 'Send issuer does not match channel owner',
  })
  context.send(error.toPayload(msg.payload.rid) as AnyServerPayloadOf<Protocol>, {
    rid: msg.payload.rid,
  })
  events.emit('handlerError', {
    error,
    payload: msg.payload,
    category: 'auth',
    messageType: 'send',
  })
  break
}
```

- [ ] **Step 9: `packages/server/src/utils.ts:79`**

Replace the existing emit:

```ts
context.events.emit('handlerError', {
  error,
  payload,
  category: 'handler',
  messageType: payload.typ as HandlerErrorMessageType,
})
```

Add the import at the top:

```ts
import type { HandlerErrorMessageType } from './types.js'
```

- [ ] **Step 10: `packages/server/src/handlers/event.ts:55`**

Replace:

```ts
ctx.events.emit('handlerError', {
  error,
  payload: msg.payload,
  category: 'handler',
  messageType: 'event',
})
```

(No new import needed — `'event'` is a string literal.)

- [ ] **Step 11: Verify type check passes**

Run: `pnpm --filter @enkaku/server run build:types`

Expected: success, no errors.

- [ ] **Step 12: Run unit tests (will mostly pass; `event-auth` will fail)**

Run: `pnpm --filter @enkaku/server run test:unit 2>&1 | tail -40`

Expected: most tests pass. `event-auth.test.ts` will fail because its `eventAuthHandler` is wired to `'eventAuthError'`, which is no longer emitted. `pnpm run test:types` (which type-checks tests) will also fail because `server.events.on('eventAuthError', ...)` is now a type error. Both are fixed in Task 3.

Do NOT run `pnpm run test:types` at this point — its failure is expected and noisy.

- [ ] **Step 13: Commit**

```bash
git add packages/server/src/types.ts packages/server/src/server.ts packages/server/src/utils.ts packages/server/src/handlers/event.ts
git commit -m "feat(server): add category + messageType to handlerError, drop eventAuthError"
```

---

## Phase C: Test updates

### Task 3: Update `event-auth.test.ts` for new event surface

**Files:**
- Modify: `packages/server/test/event-auth.test.ts`

- [ ] **Step 1: Rewrite the failing-auth test**

Replace the body of the first test (`'emits eventAuthError when event authorization fails'`) with a renamed version (`'emits handlerError with category auth when event authorization fails'`):

```ts
test('emits handlerError with category auth when event authorization fails', async () => {
  const protocol = {
    notify: {
      type: 'event',
      data: { type: 'object' },
    },
  } as const satisfies ProtocolDefinition
  type Protocol = typeof protocol

  const signer = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>

  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const handlerErrorHandler = vi.fn()

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { notify: { allow: true } },
    transport: transports.server,
  })
  server.events.on('handlerError', handlerErrorHandler)

  await transports.client.write(
    createUnsignedToken({
      typ: 'event',
      prc: 'notify',
      data: 'hello',
    }) as unknown as AnyClientMessageOf<Protocol>,
  )

  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(handler).not.toHaveBeenCalled()
  expect(handlerErrorHandler).toHaveBeenCalledWith(
    expect.objectContaining({
      error: expect.objectContaining({ code: 'EK02' }),
      category: 'auth',
      messageType: 'event',
    }),
  )

  await server.dispose()
  await transports.dispose()
})
```

- [ ] **Step 2: Rewrite the success test**

Replace the second test body (`'does not emit eventAuthError for valid signed events'`) with the renamed version (`'does not emit handlerError for valid signed events'`). Body is identical except listener target and final assertion:

```ts
test('does not emit handlerError for valid signed events', async () => {
  // ... unchanged setup ...
  const handlerErrorHandler = vi.fn()
  // ... unchanged server setup ...
  server.events.on('handlerError', handlerErrorHandler)
  // ... unchanged dispatch and dispose ...
  expect(handler).toHaveBeenCalled()
  expect(handlerErrorHandler).not.toHaveBeenCalled()
})
```

(Substitute `eventAuthHandler` → `handlerErrorHandler`, listener key `'eventAuthError'` → `'handlerError'`, comment `// No auth error should have been emitted` → `// No handlerError should have been emitted`.)

- [ ] **Step 3: Run the test file**

Run: `pnpm --filter @enkaku/server run test:unit -- event-auth`

Expected: both tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server/test/event-auth.test.ts
git commit -m "test(server): handlerError replaces eventAuthError on event auth failure"
```

---

### Task 4: Integration tests for request/channel/stream auth-denials

**Files:**
- Create: `packages/server/test/access-control-deny.test.ts`

**Premise correction:** `access-control*.test.ts` files are unit tests of `checkClientToken`, not integration tests via `serve()`. There is no existing coverage for request/channel/stream auth-denial through the server pipeline. This task creates a new file with three integration tests covering the three message types.

Use `encryption-policy.test.ts` as the structural reference — it uses `DirectTransports` + `serve()` and reads error payloads off the wire.

- [ ] **Step 1: Create `packages/server/test/access-control-deny.test.ts`**

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

describe('access-control denial emits handlerError', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 300

  const protocol = {
    req: { type: 'request', result: { type: 'string' } },
    chan: {
      type: 'channel',
      send: { type: 'string' },
      receive: { type: 'string' },
      result: { type: 'string' },
    },
    str: {
      type: 'stream',
      receive: { type: 'string' },
      result: { type: 'string' },
    },
  } as const satisfies ProtocolDefinition
  type Protocol = typeof protocol

  test('request denial emits handlerError with category auth, messageType request', async () => {
    const handler = vi.fn(() => 'OK')
    const handlers = { req: handler } as unknown as ProcedureHandlers<Protocol>

    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const handlerErrorHandler = vi.fn()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { req: { allow: () => false } },
      transport: transports.server,
    })
    server.events.on('handlerError', handlerErrorHandler)

    const message = await clientSigner.signToken({
      typ: 'request',
      aud: serverSigner.id,
      prc: 'req',
      rid: 'r1',
      prm: undefined,
      exp: expiresAt,
    } as const)
    await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

    const read = await transports.client.read()
    expect(read.value?.payload.typ).toBe('error')
    expect((read.value?.payload as Record<string, unknown>).code).toBe('EK02')

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(handler).not.toHaveBeenCalled()
    expect(handlerErrorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
        messageType: 'request',
      }),
    )

    await server.dispose()
    await transports.dispose()
  })

  test('channel denial emits handlerError with category auth, messageType channel', async () => {
    const handler = vi.fn(async () => 'OK')
    const handlers = { chan: handler } as unknown as ProcedureHandlers<Protocol>

    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const handlerErrorHandler = vi.fn()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { chan: { allow: () => false } },
      transport: transports.server,
    })
    server.events.on('handlerError', handlerErrorHandler)

    const message = await clientSigner.signToken({
      typ: 'channel',
      aud: serverSigner.id,
      prc: 'chan',
      rid: 'c1',
      prm: undefined,
      exp: expiresAt,
    } as const)
    await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

    const read = await transports.client.read()
    expect(read.value?.payload.typ).toBe('error')
    expect((read.value?.payload as Record<string, unknown>).code).toBe('EK02')

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(handler).not.toHaveBeenCalled()
    expect(handlerErrorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
        messageType: 'channel',
      }),
    )

    await server.dispose()
    await transports.dispose()
  })

  test('stream denial emits handlerError with category auth, messageType stream', async () => {
    const handler = vi.fn(async () => 'OK')
    const handlers = { str: handler } as unknown as ProcedureHandlers<Protocol>

    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const handlerErrorHandler = vi.fn()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { str: { allow: () => false } },
      transport: transports.server,
    })
    server.events.on('handlerError', handlerErrorHandler)

    const message = await clientSigner.signToken({
      typ: 'stream',
      aud: serverSigner.id,
      prc: 'str',
      rid: 's1',
      prm: undefined,
      exp: expiresAt,
    } as const)
    await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

    const read = await transports.client.read()
    expect(read.value?.payload.typ).toBe('error')
    expect((read.value?.payload as Record<string, unknown>).code).toBe('EK02')

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(handler).not.toHaveBeenCalled()
    expect(handlerErrorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
        messageType: 'stream',
      }),
    )

    await server.dispose()
    await transports.dispose()
  })
})
```

If `prm: undefined` causes a token-signing rejection or AJV validation failure, drop the field — payload shapes for request/channel/stream may differ. Verify the protocol message shape against `@enkaku/protocol` if the tokens fail to construct.

- [ ] **Step 2: Run**

Run: `pnpm --filter @enkaku/server run test:unit -- access-control-deny`

Expected: all 3 tests pass. If any test fails because of token shape (e.g., AJV rejects the message), inspect the existing `event-auth.test.ts` and `channel-send-auth.test.ts` for the canonical signed-token shapes per type, and align.

- [ ] **Step 3: Commit**

```bash
git add packages/server/test/access-control-deny.test.ts
git commit -m "test(server): integration coverage for handlerError on req/channel/stream auth deny"
```

---

### Task 5: Add auth-denial assertions to `channel-send-auth.test.ts`

**Files:**
- Modify: `packages/server/test/channel-send-auth.test.ts`

- [ ] **Step 1: Extend the unsigned-send test (line 57)**

Add inside `test('send messages require signing in non-public mode', ...)` after the `serve(...)` call:

```ts
const handlerErrorHandler = vi.fn()
server.events.on('handlerError', handlerErrorHandler)
```

After the existing `expect((errorMsg.value?.payload as Record<string, unknown>).msg).toContain('signed')` line, add:

```ts
await new Promise((resolve) => setTimeout(resolve, 20))
expect(handlerErrorHandler).toHaveBeenCalledWith(
  expect.objectContaining({
    error: expect.objectContaining({ code: 'EK02' }),
    category: 'auth',
    messageType: 'send',
  }),
)
```

- [ ] **Step 2: Extend the issuer-mismatch test (line 174)**

Same pattern as Step 1 inside `test('signed send from different identity is rejected in non-public mode', ...)`. Place the listener after `serve(...)` and the assertion after the existing `expect(receivedValues).toEqual([])` line:

```ts
await new Promise((resolve) => setTimeout(resolve, 20))
expect(handlerErrorHandler).toHaveBeenCalledWith(
  expect.objectContaining({
    error: expect.objectContaining({ code: 'EK02' }),
    category: 'auth',
    messageType: 'send',
  }),
)
```

- [ ] **Step 3: Run**

Run: `pnpm --filter @enkaku/server run test:unit -- channel-send-auth`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server/test/channel-send-auth.test.ts
git commit -m "test(server): assert handlerError category=auth on channel send denials"
```

---

### Task 6: Add encryption-violation discriminator assertions

**Files:**
- Modify: `packages/server/test/encryption-policy.test.ts`

- [ ] **Step 1: Extend the existing event-path EK07 test (around line 161)**

Replace the existing `expect(handlerErrorHandler).toHaveBeenCalledWith(...)` block in `test('rejects event when encryptionPolicy is required', ...)` with:

```ts
expect(handlerErrorHandler).toHaveBeenCalledWith(
  expect.objectContaining({
    error: expect.objectContaining({ code: 'EK07' }),
    category: 'encryption',
    messageType: 'event',
  }),
)
```

- [ ] **Step 2: Add a new test for the request-path encryption violation**

Read the file (`packages/server/test/encryption-policy.test.ts`) to find an analogous test or model the new one after the event-path test. Add this inside the `describe(...)` block:

```ts
test('emits handlerError with category encryption on request encryption violation', async () => {
  const handler = vi.fn<RequestHandler<Protocol, 'test'>>(() => 'OK')
  const notifyHandler = vi.fn()
  const handlers = {
    test: handler,
    notify: notifyHandler,
  } as unknown as ProcedureHandlers<Protocol>

  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const signer = randomIdentity()
  const handlerErrorHandler = vi.fn()

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    encryptionPolicy: 'required',
    transport: transports.server,
  })
  server.events.on('handlerError', handlerErrorHandler)

  const message = await signer.signToken({
    typ: 'request',
    aud: signer.id,
    prc: 'test',
    rid: 'r1',
    prm: undefined,
    exp: expiresAt,
  } as const)
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(handler).not.toHaveBeenCalled()
  expect(handlerErrorHandler).toHaveBeenCalledWith(
    expect.objectContaining({
      error: expect.objectContaining({ code: 'EK07' }),
      category: 'encryption',
      messageType: 'request',
    }),
  )

  await server.dispose()
  await transports.dispose()
})
```

(If the existing `Protocol` type does not include a `request`-typed `test` procedure, model the new test on whatever request procedure already exists in the file. Verify by reading the top of `encryption-policy.test.ts` first.)

- [ ] **Step 3: Run**

Run: `pnpm --filter @enkaku/server run test:unit -- encryption-policy`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server/test/encryption-policy.test.ts
git commit -m "test(server): assert handlerError category=encryption + add request-path coverage"
```

---

### Task 7: Add limit + handler discriminator assertions

**Files:**
- Modify: `packages/server/test/buffer-limits.test.ts:151-...`
- Modify: `packages/server/test/limits.test.ts`
- Modify: `packages/server/test/event-handler.test.ts:50-110`
- Modify: `packages/server/test/utils.test.ts` (lines 39, 94, 152)
- Modify: `packages/server/test/stream-crash.test.ts` (lines 33, 82)

- [ ] **Step 1: `buffer-limits.test.ts`**

Find the existing `server.events.on('handlerError', (event) => { ... })` callback (around line 151). Wherever it asserts on the event payload, extend the assertion:

```ts
expect(event).toEqual(
  expect.objectContaining({
    error: expect.objectContaining({ code: 'EK06' }),
    category: 'limit',
    messageType: expect.stringMatching(/^(event|request|channel|stream|send)$/),
  }),
)
```

(Use the actual `messageType` value — read the test to find which message type the test sends, then assert the literal.)

- [ ] **Step 2: `limits.test.ts`**

Read the file. For each test that asserts on `handlerError` (codes EK03, EK04), extend assertions with `category: 'limit'` and the appropriate `messageType` literal. If the test does not currently inspect the emitted payload beyond the `error.code`, add the inspection.

- [ ] **Step 3: `event-handler.test.ts:50-110`**

In the test that captures `handlerError` for a thrown handler, extend the assertion on `emittedError`:

```ts
expect(emittedError).toEqual(
  expect.objectContaining({
    error: expect.objectContaining({ code: 'EK01' }),
    category: 'handler',
    messageType: 'event',
  }),
)
```

(Adjust to match whatever variable the test uses for the captured event.)

- [ ] **Step 4: `utils.test.ts`**

For each of the three `handlerError = events.once('handlerError')` blocks (lines 39, 94, 152), extend the corresponding `emittedError` assertion to also check `category: 'handler'` and the correct `messageType` for the test's procedure type (`'request'`, `'channel'`, or `'stream'` — read the surrounding test to determine which).

- [ ] **Step 5: `stream-crash.test.ts`**

For each of the two error-handler test blocks (lines 33, 82), extend the assertion to include `category: 'handler'` and `messageType: 'stream'`.

- [ ] **Step 6: Run**

Run: `pnpm --filter @enkaku/server run test:unit`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/server/test/buffer-limits.test.ts packages/server/test/limits.test.ts packages/server/test/event-handler.test.ts packages/server/test/utils.test.ts packages/server/test/stream-crash.test.ts
git commit -m "test(server): assert handlerError category + messageType on limit/handler paths"
```

---

## Phase D: Verification

### Task 8: Full server-package test + lint

**Files:**
- None modified.

- [ ] **Step 1: Run the full server test suite**

Run: `pnpm --filter @enkaku/server run test`

Expected: all tests (`test:types` + `test:unit`) pass. `test:types` invokes `tsc --noEmit -p tsconfig.test.json` and catches any straggler `eventAuthError` references in test files.

- [ ] **Step 2: Run lint on the server package**

Run: `pnpm --filter @enkaku/server run lint`

Expected: no errors.

- [ ] **Step 3: Run the workspace build**

Run: `pnpm run build`

Expected: success across all packages. This catches downstream type breakage (e.g., a `kubun`-side consumer that imports from `@enkaku/server` and references `eventAuthError`). If a downstream package in the same monorepo breaks, fix the consumer in a separate task — open the failure for review before continuing.

- [ ] **Step 4: Audit for any straggler `eventAuthError` references**

Run: `grep -rn "eventAuthError" packages/`

Expected: no matches.

If matches exist, remove them (they are leftovers from this refactor).

- [ ] **Step 5: Commit if Step 4 produced changes; otherwise no-op**

```bash
# Only if Step 4 found and removed stragglers:
git add -u packages/
git commit -m "chore(server): remove eventAuthError stragglers"
```

---

## Spec coverage check (for executor)

Each spec acceptance criterion → task that covers it:

- `ServerEvents.handlerError` with required `category` + `messageType` → **Task 1**
- `ServerEvents.eventAuthError` removed → **Task 1** (type) + **Task 2 Step 6** (emit) + **Task 3** (test)
- All four auth-denial sites emit `handlerError` with `category:'auth'` and correct `messageType` → **Task 2 Steps 6 & 8** + **Tasks 3, 4, 5**
- All existing `handlerError` emissions assigned correct `category` → **Task 2 Steps 1, 2, 3, 4, 5, 7, 9, 10**
- Per-site test coverage updated → **Tasks 3-7**
- Client-visible error payloads unchanged → preserved by leaving every existing `context.send` call intact in Task 2

---

## Out of scope (per spec)

- Client-side observation events
- Reason classification beyond `error.message`
- Renaming `handlerError` itself
- Changelog entry
