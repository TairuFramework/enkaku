# Protocol Schema Hardening (H-05, H-06) Implementation Plan

**Status:** complete

**Follow-up items:**
- Signed message path has no direct test coverage (all tests use unsigned tokens). Adding signed token tests requires key/signer setup. Tracked in T-06.
- No `maxLength` on the `data: { type: 'string' }` field in the signed message wrapper. Bounded indirectly by `maxMessageSize`.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden `@enkaku/protocol` message schemas by rejecting unknown properties (H-06) and enforcing string length limits (H-05) to prevent message inflation, hidden data channels, and memory exhaustion.

**Architecture:** Refactor signed message payload composition from `allOf` to explicit property merging, enabling `additionalProperties: false` across all payload and message wrapper schemas. Then add `maxLength` constraints to all free-form string fields. Changes are scoped to the `@enkaku/protocol` package; the `@enkaku/token` package's base schemas remain unchanged.

**Tech Stack:** TypeScript, JSON Schema (draft-07 via AJV), Vitest

---

## Background

### H-06: additionalProperties: true allows arbitrary fields

All protocol message payload schemas (`client.ts`, `server.ts`) and message wrapper schemas (`message.ts`) use `additionalProperties: true`, allowing arbitrary extra fields. This enables:
- Unbounded message inflation via junk properties
- Hidden data channels through non-validated fields
- Bypass of per-field constraints

**Complication:** Signed message payloads currently use `allOf` composition:

```
payload: { allOf: [signedPayloadSchema, payloadSchema] }
```

With AJV, setting `additionalProperties: false` on either sub-schema in `allOf` causes the OTHER schema's properties to be rejected — each schema evaluates `additionalProperties` only against its own `properties` keyword. The fix is to merge both schemas' properties into a single flat schema with `additionalProperties: false`.

### H-05: Missing payload size constraints

No string fields in protocol schemas have `maxLength` constraints. A malicious client can send multi-megabyte strings in `rid`, `jti`, `rsn`, `code`, or `msg` fields, consuming memory before the overall message size limit applies.

### Affected files

| File | Changes |
|------|---------|
| `packages/protocol/src/schemas/message.ts` | Merge signed payload schemas; `additionalProperties: false` on wrappers |
| `packages/protocol/src/schemas/client.ts` | `additionalProperties: false` + `maxLength` on all payload schemas |
| `packages/protocol/src/schemas/server.ts` | `additionalProperties: false` + `maxLength` on all payload schemas |
| `packages/protocol/test/lib.test.ts` | New test cases for both H-06 and H-05 |

### Constraint reference

| Field | maxLength | Rationale |
|-------|-----------|-----------|
| `rid` | 128 | Request IDs (typically UUIDs, 36 chars) |
| `jti` | 128 | JWT IDs (similar to request IDs) |
| `rsn` | 1024 | Abort reason (human-readable text) |
| `code` | 128 | Error codes (short identifiers) |
| `msg` | 4096 | Error messages (longer descriptive text) |
| `signature` | 512 | Base64url signature (Ed25519=88, ES256~96 chars) |
| `iss` | 256 | Issuer DID string |
| `sub` | 256 | Subject DID string |
| `aud` | 256 | Audience DID string |
| Error `data` | maxProperties: 64 | Prevent bloated error data objects |

---

## Phase 1: H-06 — Reject Additional Properties

### Task 1: Write failing tests for additional property rejection

**Files:**
- Modify: `packages/protocol/test/lib.test.ts`

**Step 1: Write the failing tests**

Add a new `describe` block after the existing `'protocol messages validation'` block in `packages/protocol/test/lib.test.ts`:

```typescript
describe('H-06: additional properties rejection', () => {
  test('rejects client payload with extra fields', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'client-h06' })

    const abortWithExtra = createUnsignedToken({ typ: 'abort', rid: '1', extra: 'field' })
    expect(isType(validator, abortWithExtra)).toBe(false)

    const requestWithExtra = createUnsignedToken({
      typ: 'request',
      prc: 'test/request',
      rid: '1',
      extra: 'field',
    })
    expect(isType(validator, requestWithExtra)).toBe(false)

    const eventWithExtra = createUnsignedToken({
      typ: 'event',
      prc: 'test/event',
      data: { foo: 'bar' },
      extra: 'field',
    })
    expect(isType(validator, eventWithExtra)).toBe(false)

    const sendWithExtra = createUnsignedToken({
      typ: 'send',
      prc: 'test/channel',
      rid: '1',
      val: '1',
      extra: 'field',
    })
    expect(isType(validator, sendWithExtra)).toBe(false)
  })

  test('rejects server payload with extra fields', () => {
    const schema = createServerMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'server-h06' })

    const resultWithExtra = createUnsignedToken({
      typ: 'result',
      rid: '1',
      val: 'test',
      extra: 'field',
    })
    expect(isType(validator, resultWithExtra)).toBe(false)

    const receiveWithExtra = createUnsignedToken({
      typ: 'receive',
      rid: '1',
      val: 1,
      extra: 'field',
    })
    expect(isType(validator, receiveWithExtra)).toBe(false)

    const errorWithExtra = createUnsignedToken({
      typ: 'error',
      rid: '1',
      code: 'ERR',
      msg: 'test',
      extra: 'field',
    })
    expect(isType(validator, errorWithExtra)).toBe(false)
  })

  test('rejects unsigned message wrapper with extra fields', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'wrapper-h06' })

    const token = createUnsignedToken({ typ: 'abort', rid: '1' })
    const withExtra = { ...token, extraField: 'value' }
    expect(isType(validator, withExtra)).toBe(false)
  })

  test('still accepts valid messages without extra fields', () => {
    const clientSchema = createClientMessageSchema(protocol)
    const clientValidator = createValidator({ ...clientSchema, $id: 'client-h06-valid' })

    expect(isType(clientValidator, createUnsignedToken({ typ: 'abort', rid: '1' }))).toBe(true)
    expect(
      isType(
        clientValidator,
        createUnsignedToken({ typ: 'request', prc: 'test/request', rid: '1' }),
      ),
    ).toBe(true)
    expect(
      isType(
        clientValidator,
        createUnsignedToken({ typ: 'event', prc: 'test/event', data: { foo: 'bar' } }),
      ),
    ).toBe(true)
    expect(
      isType(
        clientValidator,
        createUnsignedToken({ typ: 'send', prc: 'test/channel', rid: '1', val: '1' }),
      ),
    ).toBe(true)

    const serverSchema = createServerMessageSchema(protocol)
    const serverValidator = createValidator({ ...serverSchema, $id: 'server-h06-valid' })

    expect(
      isType(serverValidator, createUnsignedToken({ typ: 'result', rid: '1', val: 'test' })),
    ).toBe(true)
    expect(
      isType(serverValidator, createUnsignedToken({ typ: 'receive', rid: '1', val: 1 })),
    ).toBe(true)
    expect(
      isType(
        serverValidator,
        createUnsignedToken({ typ: 'error', rid: '1', code: 'ERR', msg: 'test' }),
      ),
    ).toBe(true)
  })

  test('accepts messages with optional jti field', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'client-h06-jti' })

    const abortWithJti = createUnsignedToken({ typ: 'abort', rid: '1', jti: 'abc-123' })
    expect(isType(validator, abortWithJti)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit --filter=@enkaku/protocol`

Expected: FAIL — the "rejects" tests fail because extra fields are currently accepted (`additionalProperties: true`)

**Step 3: Commit**

```bash
git add packages/protocol/test/lib.test.ts
git commit -m "test(protocol): add failing H-06 tests for additional properties rejection"
```

---

### Task 2: Refactor signed message schema to merge properties

**Files:**
- Modify: `packages/protocol/src/schemas/message.ts`

The key change: replace `{ allOf: [signedPayloadSchema, payloadSchema] }` with a single merged schema that contains properties from both, allowing `additionalProperties: false` to work correctly.

**Step 1: Rewrite message.ts**

Replace the full contents of `packages/protocol/src/schemas/message.ts` with:

```typescript
import type { Schema } from '@enkaku/schema'
import { signedHeaderSchema, signedPayloadSchema, unsignedHeaderSchema } from '@enkaku/token'

/** @internal */
function mergeSignedPayload(payloadSchema: Schema): Schema {
  const payloadObj = payloadSchema as {
    type: string
    properties?: Record<string, Schema>
    required?: Array<string>
  }
  return {
    type: 'object',
    properties: {
      ...signedPayloadSchema.properties,
      ...(payloadObj.properties ?? {}),
    },
    required: [...signedPayloadSchema.required, ...(payloadObj.required ?? [])],
    additionalProperties: false,
  } as const satisfies Schema
}

/** @internal */
export function createSignedMessageSchema(payloadSchema: Schema): Schema {
  return {
    type: 'object',
    properties: {
      header: signedHeaderSchema,
      payload: mergeSignedPayload(payloadSchema),
      signature: { type: 'string' },
      data: { type: 'string' },
    },
    required: ['header', 'payload', 'signature'],
    additionalProperties: false,
  } as const satisfies Schema
}

/** @internal */
export function createUnsignedMessageSchema(payloadSchema: Schema): Schema {
  return {
    type: 'object',
    properties: {
      header: unsignedHeaderSchema,
      payload: payloadSchema,
    },
    required: ['header', 'payload'],
    additionalProperties: false,
  } as const
}

export type MessageType = 'signed' | 'unsigned' | 'any'

/** @internal */
export function createMessageSchema(payloadSchema: Schema, type: MessageType = 'any'): Schema {
  switch (type) {
    case 'signed':
      return createSignedMessageSchema(payloadSchema)
    case 'unsigned':
      return createUnsignedMessageSchema(payloadSchema)
    default:
      return {
        anyOf: [
          createSignedMessageSchema(payloadSchema),
          createUnsignedMessageSchema(payloadSchema),
        ],
      } as const
  }
}
```

Key changes:
- New `mergeSignedPayload()` — spreads `signedPayloadSchema.properties` (JWT claims: iss, sub, aud, cap, exp, nbf, iat) and protocol payload properties into one flat schema with `additionalProperties: false`
- `createSignedMessageSchema` — uses merged payload instead of `allOf`, adds `data: { type: 'string' }` for the base64url-encoded header.payload, sets `additionalProperties: false` on the wrapper
- `createUnsignedMessageSchema` — sets `additionalProperties: false` on the wrapper

**Step 2: Run the type checker**

Run: `pnpm run test:types --filter=@enkaku/protocol`

Expected: PASS

**Step 3: Commit**

```bash
git add packages/protocol/src/schemas/message.ts
git commit -m "refactor(protocol): merge signed payload schemas instead of allOf composition

Replaces allOf composition with explicit property merging to enable
additionalProperties: false without AJV allOf conflicts."
```

---

### Task 3: Set additionalProperties: false on all payload schemas

**Files:**
- Modify: `packages/protocol/src/schemas/client.ts`
- Modify: `packages/protocol/src/schemas/server.ts`

**Step 1: Update client.ts**

In `packages/protocol/src/schemas/client.ts`, change `additionalProperties: true` to `additionalProperties: false` in all 6 locations:

1. `abortMessagePayload` (line 23)
2. `createEventPayloadWithData` return value (line 42)
3. `createEventPayloadWithoutData` return value (line 56)
4. `createRequestPayloadWithParam` return value (line 88)
5. `createRequestPayloadWithoutParam` return value (line 103)
6. `createSendMessageSchema` payloadSchema (line 135)

Use find-and-replace: `additionalProperties: true` -> `additionalProperties: false` (all 6 occurrences in the file).

**Step 2: Update server.ts**

In `packages/protocol/src/schemas/server.ts`, change `additionalProperties: true` to `additionalProperties: false` in all 4 locations:

1. `errorMessagePayload` (line 24)
2. `createReceiveMessageSchema` payloadSchema (line 46)
3. `createResultMessageWithValueSchema` inline schema (line 66)
4. `resultMessageWithoutValuePayload` (line 81)

Use find-and-replace: `additionalProperties: true` -> `additionalProperties: false` (all 4 occurrences in the file).

**Step 3: Run unit tests**

Run: `pnpm run test:unit --filter=@enkaku/protocol`

Expected: PASS — all H-06 rejection tests now pass, all existing valid-message tests still pass

**Step 4: Commit**

```bash
git add packages/protocol/src/schemas/client.ts packages/protocol/src/schemas/server.ts
git commit -m "fix(protocol): set additionalProperties: false on all payload schemas (H-06)

Reject arbitrary extra fields in protocol message payloads to prevent
message inflation and hidden data channels."
```

---

## Phase 2: H-05 — Enforce String Length Limits

### Task 4: Write failing tests for maxLength enforcement

**Files:**
- Modify: `packages/protocol/test/lib.test.ts`

**Step 1: Write the failing tests**

Add a new `describe` block after the H-06 block:

```typescript
describe('H-05: string length constraints', () => {
  test('rejects client messages with oversized rid', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'client-h05-rid' })

    const oversizedRid = 'x'.repeat(200)

    const abortOversized = createUnsignedToken({ typ: 'abort', rid: oversizedRid })
    expect(isType(validator, abortOversized)).toBe(false)

    const requestOversized = createUnsignedToken({
      typ: 'request',
      prc: 'test/request',
      rid: oversizedRid,
    })
    expect(isType(validator, requestOversized)).toBe(false)
  })

  test('rejects client messages with oversized jti', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'client-h05-jti' })

    const oversizedJti = 'x'.repeat(200)
    const abort = createUnsignedToken({ typ: 'abort', rid: '1', jti: oversizedJti })
    expect(isType(validator, abort)).toBe(false)
  })

  test('rejects abort with oversized rsn', () => {
    const schema = createClientMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'client-h05-rsn' })

    const oversizedRsn = 'x'.repeat(2000)
    const abort = createUnsignedToken({ typ: 'abort', rid: '1', rsn: oversizedRsn })
    expect(isType(validator, abort)).toBe(false)
  })

  test('rejects error messages with oversized code or msg', () => {
    const schema = createServerMessageSchema(protocol)
    const validator = createValidator({ ...schema, $id: 'server-h05-error' })

    const errorOversizedCode = createUnsignedToken({
      typ: 'error',
      rid: '1',
      code: 'x'.repeat(200),
      msg: 'test',
    })
    expect(isType(validator, errorOversizedCode)).toBe(false)

    const errorOversizedMsg = createUnsignedToken({
      typ: 'error',
      rid: '1',
      code: 'ERR',
      msg: 'x'.repeat(5000),
    })
    expect(isType(validator, errorOversizedMsg)).toBe(false)
  })

  test('accepts messages within length limits', () => {
    const clientSchema = createClientMessageSchema(protocol)
    const clientValidator = createValidator({ ...clientSchema, $id: 'client-h05-valid' })

    expect(
      isType(
        clientValidator,
        createUnsignedToken({
          typ: 'abort',
          rid: 'abc-123',
          jti: 'jti-456',
          rsn: 'user cancelled',
        }),
      ),
    ).toBe(true)

    const serverSchema = createServerMessageSchema(protocol)
    const serverValidator = createValidator({ ...serverSchema, $id: 'server-h05-valid' })

    expect(
      isType(
        serverValidator,
        createUnsignedToken({
          typ: 'error',
          rid: '1',
          code: 'NOT_FOUND',
          msg: 'Resource not found',
        }),
      ),
    ).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit --filter=@enkaku/protocol`

Expected: FAIL — the "rejects oversized" tests fail because no maxLength constraints exist

**Step 3: Commit**

```bash
git add packages/protocol/test/lib.test.ts
git commit -m "test(protocol): add failing H-05 tests for string length constraints"
```

---

### Task 5: Add maxLength to client payload string fields

**Files:**
- Modify: `packages/protocol/src/schemas/client.ts`

**Step 1: Add maxLength constraints**

Update each payload schema in `packages/protocol/src/schemas/client.ts`. For every free-form string field (those without a `const` constraint), add `maxLength`. Fields with `const` (like `typ` and `prc`) are already length-bounded by their constant value.

`abortMessagePayload`:
```typescript
export const abortMessagePayload: Schema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'abort' },
    rid: { type: 'string', maxLength: 128 },
    jti: { type: 'string', maxLength: 128 },
    rsn: { type: 'string', maxLength: 1024 },
  },
  required: ['typ', 'rid'],
  additionalProperties: false,
} as const satisfies Schema
```

`createEventPayloadWithData` return:
```typescript
return {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'event' },
    prc: { type: 'string', const: procedure },
    data: dataSchema,
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'prc', 'data'],
  additionalProperties: false,
} as const satisfies Schema
```

`createEventPayloadWithoutData` return:
```typescript
return {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'event' },
    prc: { type: 'string', const: procedure },
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'prc'],
  additionalProperties: false,
} as const satisfies Schema
```

`createRequestPayloadWithParam` return:
```typescript
return {
  type: 'object',
  properties: {
    typ: { type: 'string', const: type },
    prc: { type: 'string', const: procedure },
    rid: { type: 'string', maxLength: 128 },
    prm: paramSchema,
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'prc', 'rid', 'prm'],
  additionalProperties: false,
} as const satisfies Schema
```

`createRequestPayloadWithoutParam` return:
```typescript
return {
  type: 'object',
  properties: {
    typ: { type: 'string', const: type },
    prc: { type: 'string', const: procedure },
    rid: { type: 'string', maxLength: 128 },
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'prc', 'rid'],
  additionalProperties: false,
} as const satisfies Schema
```

`createSendMessageSchema` payloadSchema:
```typescript
const payloadSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'send' },
    prc: { type: 'string', const: procedure },
    rid: { type: 'string', maxLength: 128 },
    val: definition.send,
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'prc', 'rid', 'val'],
  additionalProperties: false,
} as const satisfies Schema
```

**Step 2: Run unit tests**

Run: `pnpm run test:unit --filter=@enkaku/protocol`

Expected: Client-side H-05 tests pass; server-side tests still fail

**Step 3: Commit**

```bash
git add packages/protocol/src/schemas/client.ts
git commit -m "fix(protocol): add maxLength to client payload string fields (H-05)"
```

---

### Task 6: Add maxLength to server payload string fields

**Files:**
- Modify: `packages/protocol/src/schemas/server.ts`

**Step 1: Add maxLength constraints**

`errorMessagePayload`:
```typescript
export const errorMessagePayload: Schema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'error' },
    rid: { type: 'string', maxLength: 128 },
    code: { type: 'string', maxLength: 128 },
    msg: { type: 'string', maxLength: 4096 },
    data: { type: 'object', maxProperties: 64 },
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'rid', 'code', 'msg'],
  additionalProperties: false,
} as const satisfies Schema
```

`createReceiveMessageSchema` payloadSchema:
```typescript
const payloadSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'receive' },
    rid: { type: 'string', maxLength: 128 },
    val: definition.receive,
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'rid', 'val'],
  additionalProperties: false,
} as const satisfies Schema
```

`createResultMessageWithValueSchema` inline schema:
```typescript
return createMessageSchema(
  {
    type: 'object',
    properties: {
      typ: { type: 'string', const: 'result' },
      rid: { type: 'string', maxLength: 128 },
      val: valueSchema,
      jti: { type: 'string', maxLength: 128 },
    },
    required: ['typ', 'rid', 'val'],
    additionalProperties: false,
  } as const satisfies Schema,
  type,
)
```

`resultMessageWithoutValuePayload`:
```typescript
export const resultMessageWithoutValuePayload = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'result' },
    rid: { type: 'string', maxLength: 128 },
    jti: { type: 'string', maxLength: 128 },
  },
  required: ['typ', 'rid'],
  additionalProperties: false,
} as const satisfies Schema
```

**Step 2: Run unit tests**

Run: `pnpm run test:unit --filter=@enkaku/protocol`

Expected: PASS — all H-05 and H-06 tests pass

**Step 3: Commit**

```bash
git add packages/protocol/src/schemas/server.ts
git commit -m "fix(protocol): add maxLength to server payload string fields (H-05)"
```

---

### Task 7: Add maxLength to signature and JWT claim fields in message wrapper

**Files:**
- Modify: `packages/protocol/src/schemas/message.ts`

**Step 1: Add maxLength constraints to the merge function and wrapper**

Update `mergeSignedPayload` to override JWT claim strings with constrained versions. The spread order ensures the overrides replace the originals from `signedPayloadSchema.properties`:

```typescript
/** @internal */
function mergeSignedPayload(payloadSchema: Schema): Schema {
  const payloadObj = payloadSchema as {
    type: string
    properties?: Record<string, Schema>
    required?: Array<string>
  }
  return {
    type: 'object',
    properties: {
      ...signedPayloadSchema.properties,
      iss: { type: 'string', maxLength: 256 },
      sub: { type: 'string', maxLength: 256 },
      aud: { type: 'string', maxLength: 256 },
      ...(payloadObj.properties ?? {}),
    },
    required: [...signedPayloadSchema.required, ...(payloadObj.required ?? [])],
    additionalProperties: false,
  } as const satisfies Schema
}
```

Update `createSignedMessageSchema` to constrain the `signature` field:

```typescript
/** @internal */
export function createSignedMessageSchema(payloadSchema: Schema): Schema {
  return {
    type: 'object',
    properties: {
      header: signedHeaderSchema,
      payload: mergeSignedPayload(payloadSchema),
      signature: { type: 'string', maxLength: 512 },
      data: { type: 'string' },
    },
    required: ['header', 'payload', 'signature'],
    additionalProperties: false,
  } as const satisfies Schema
}
```

**Step 2: Run unit tests**

Run: `pnpm run test:unit --filter=@enkaku/protocol`

Expected: PASS

**Step 3: Commit**

```bash
git add packages/protocol/src/schemas/message.ts
git commit -m "fix(protocol): add maxLength to signature and JWT claim fields (H-05)"
```

---

## Phase 3: Verification

### Task 8: Run full test suite and build

**Step 1: Run type checking across all packages**

Run: `pnpm run test:types`

Expected: PASS

**Step 2: Run all unit tests**

Run: `pnpm run test:unit`

Expected: PASS

**Step 3: Run build**

Run: `pnpm run build`

Expected: PASS

**Step 4: Run linter**

Run: `pnpm run lint`

Expected: PASS — no formatting or lint issues

---

## Breaking Changes

These are **protocol-level breaking changes**:

1. **H-06**: Messages with extra fields in payloads or wrappers are now rejected. Any client/server sending non-standard fields will break.
2. **H-05**: Messages with string fields exceeding `maxLength` limits are rejected.

Both are intentional security hardening. Code relying on extra fields must be updated to use defined protocol fields only.

## Out of Scope

- **Token package schemas** (`@enkaku/token`): The `signedHeaderSchema`, `unsignedHeaderSchema`, and `signedPayloadSchema` retain `additionalProperties: true` in the token package. The protocol package overrides JWT claim constraints via the merge function. Token schema hardening should be a separate effort.
- **Capability schema constraints**: The `cap` field uses `capabilitySchema` from `@enkaku/token` without additional length limits. This should be addressed in a token-specific hardening plan.
