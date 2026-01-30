# Input Validation Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 HIGH severity security issues (H-02, H-07, H-08, H-16, H-18, H-12) that harden input validation and payload processing across the `token`, `schema`, `codec`, `stream`, `server`, and `http-server-transport` packages.

**Architecture:** Each fix adds a defensive check at the boundary where untrusted input enters a processing function. H-02 adds bounds checking to codec matching. H-07 blocks prototype pollution in schema reference resolution. H-08 adds JSON parsing depth limits. H-16 sanitizes error messages sent to clients. H-18 adds buffer size limits to the JSON Lines stream parser. H-12 validates message payload types before processing.

**Tech Stack:** TypeScript, Vitest, Web Streams API, JSON Schema

**Security Audit Reference:** `docs/plans/2026-01-28-security-audit.md` — Issues H-02, H-07, H-08, H-12, H-16, H-18

---

### Task 1: H-02 — Add bounds check to codec matching

**Files:**
- Modify: `packages/token/src/did.ts:13-20`
- Create: `packages/token/test/did.test.ts`

**Context:** `isCodecMatch()` iterates over `codec.length` but accesses `bytes[i]` without checking that `bytes` is at least as long as `codec`. When `bytes` is shorter, `bytes[i]` returns `undefined`, which !== the codec byte, so the function returns `false` — the correct result, but via undefined behavior. The fix makes the bounds check explicit.

**Step 1: Write the failing test**

Create `packages/token/test/did.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { getAlgorithmAndPublicKey, getSignatureInfo, getDID, CODECS } from '../src/did.js'

describe('getAlgorithmAndPublicKey()', () => {
  test('returns null for bytes shorter than any codec', () => {
    const shortBytes = new Uint8Array([0xed])
    expect(getAlgorithmAndPublicKey(shortBytes)).toBeNull()
  })

  test('returns null for empty bytes', () => {
    const empty = new Uint8Array(0)
    expect(getAlgorithmAndPublicKey(empty)).toBeNull()
  })

  test('returns algorithm and public key for valid EdDSA bytes', () => {
    const publicKey = new Uint8Array([1, 2, 3, 4])
    const codec = CODECS.EdDSA
    const bytes = new Uint8Array(codec.length + publicKey.length)
    bytes.set(codec)
    bytes.set(publicKey, codec.length)
    const result = getAlgorithmAndPublicKey(bytes)
    expect(result).not.toBeNull()
    expect(result![0]).toBe('EdDSA')
    expect(result![1]).toEqual(publicKey)
  })

  test('returns algorithm and public key for valid ES256 bytes', () => {
    const publicKey = new Uint8Array([5, 6, 7, 8])
    const codec = CODECS.ES256
    const bytes = new Uint8Array(codec.length + publicKey.length)
    bytes.set(codec)
    bytes.set(publicKey, codec.length)
    const result = getAlgorithmAndPublicKey(bytes)
    expect(result).not.toBeNull()
    expect(result![0]).toBe('ES256')
    expect(result![1]).toEqual(publicKey)
  })
})

describe('getSignatureInfo()', () => {
  test('throws for invalid DID prefix', () => {
    expect(() => getSignatureInfo('invalid:key:z123')).toThrow('Invalid DID to decode')
  })

  test('throws for unsupported codec', () => {
    // base58 encode bytes that don't match any codec
    expect(() => getSignatureInfo('did:key:z1111')).toThrow('Unsupported DID signature codec')
  })
})

describe('getDID()', () => {
  test('creates a DID string with did:key:z prefix', () => {
    const codec = CODECS.EdDSA
    const publicKey = new Uint8Array([1, 2, 3])
    const did = getDID(codec, publicKey)
    expect(did.startsWith('did:key:z')).toBe(true)
  })

  test('round-trips through getSignatureInfo', () => {
    const codec = CODECS.EdDSA
    const publicKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const did = getDID(codec, publicKey)
    const [alg, extractedKey] = getSignatureInfo(did)
    expect(alg).toBe('EdDSA')
    expect(extractedKey).toEqual(publicKey)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit --filter=@enkaku/token -- did.test`

Expected: Tests related to short bytes should pass (returns null) but via undefined behavior. All tests should actually pass since the current code happens to work. The fix makes the behavior explicit rather than accidental.

**Step 3: Add the bounds check**

In `packages/token/src/did.ts`, replace the `isCodecMatch` function:

```typescript
function isCodecMatch(codec: Uint8Array, bytes: Uint8Array): boolean {
  if (bytes.length < codec.length) return false
  for (let i = 0; i < codec.length; i++) {
    if (bytes[i] !== codec[i]) {
      return false
    }
  }
  return true
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/token -- did.test`

Expected: All PASS

**Step 5: Commit**

```bash
git add packages/token/src/did.ts packages/token/test/did.test.ts
git commit -m "fix(token): add bounds check to codec matching (H-02)"
```

---

### Task 2: H-07 — Block prototype pollution in schema reference resolution

**Files:**
- Modify: `packages/schema/src/utils.ts:3-21`
- Create: `packages/schema/test/utils.test.ts`

**Context:** `resolveReference()` uses `current[segment]` to traverse a schema object by JSON Pointer segments. An attacker who controls the `$ref` value could pass `#/__proto__/polluted` or `#/constructor/prototype` to access or pollute prototype properties. The fix rejects dangerous segment names.

**Step 1: Write the failing test**

Create `packages/schema/test/utils.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { resolveReference, resolveSchema } from '../src/utils.js'
import type { Schema } from '../src/types.js'

describe('resolveReference()', () => {
  const root: Schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    $defs: {
      Address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
        },
      },
    },
  }

  test('resolves a valid $ref path', () => {
    const result = resolveReference(root, '#/$defs/Address')
    expect(result).toEqual({
      type: 'object',
      properties: {
        street: { type: 'string' },
      },
    })
  })

  test('throws for ref not starting with #', () => {
    expect(() => resolveReference(root, 'other/path')).toThrow('Invalid reference format')
  })

  test('throws for ref pointing to non-existent path', () => {
    expect(() => resolveReference(root, '#/$defs/Missing')).toThrow('Reference not found')
  })

  test('throws for ref traversing through non-object', () => {
    const schema: Schema = {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 100 },
      },
    }
    expect(() => resolveReference(schema, '#/properties/name/maxLength/deep')).toThrow(
      'Invalid reference path',
    )
  })

  test('rejects __proto__ segment (prototype pollution)', () => {
    expect(() => resolveReference(root, '#/__proto__/polluted')).toThrow(
      'Invalid reference segment',
    )
  })

  test('rejects constructor segment (prototype pollution)', () => {
    expect(() => resolveReference(root, '#/constructor/prototype')).toThrow(
      'Invalid reference segment',
    )
  })

  test('rejects prototype segment (prototype pollution)', () => {
    expect(() => resolveReference(root, '#/prototype/something')).toThrow(
      'Invalid reference segment',
    )
  })
})

describe('resolveSchema()', () => {
  test('returns schema as-is when no $ref', () => {
    const schema: Schema = { type: 'string' }
    expect(resolveSchema({}, schema)).toBe(schema)
  })

  test('resolves schema with $ref', () => {
    const root: Schema = {
      $defs: {
        Name: { type: 'string', maxLength: 100 },
      },
    }
    const schema: Schema = { $ref: '#/$defs/Name' }
    expect(resolveSchema(root, schema)).toEqual({ type: 'string', maxLength: 100 })
  })
})
```

**Step 2: Run test to verify prototype pollution tests fail**

Run: `pnpm run test:unit --filter=@enkaku/schema -- utils.test`

Expected: The `__proto__`, `constructor`, and `prototype` tests FAIL (they don't throw "Invalid reference segment" yet).

**Step 3: Add prototype pollution protection**

In `packages/schema/src/utils.ts`, replace the function body:

```typescript
const BLOCKED_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

export function resolveReference(root: Schema, ref: string): Schema {
  if (!ref.startsWith('#')) {
    throw new Error(`Invalid reference format: ${ref}`)
  }

  const segments = ref.split('/').slice(1)
  // biome-ignore lint/suspicious/noExplicitAny: mixed type
  let current: any = root
  for (const segment of segments) {
    if (BLOCKED_SEGMENTS.has(segment)) {
      throw new Error(`Invalid reference segment: ${segment}`)
    }
    if (current == null || typeof current !== 'object') {
      throw new Error(`Invalid reference path: ${ref}`)
    }
    current = current[segment]
    if (current == null) {
      throw new Error(`Reference not found: ${ref}`)
    }
  }
  return current as Schema
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/schema -- utils.test`

Expected: All PASS

**Step 5: Commit**

```bash
git add packages/schema/src/utils.ts packages/schema/test/utils.test.ts
git commit -m "fix(schema): block prototype pollution in reference resolution (H-07)"
```

---

### Task 3: H-08 — Add JSON parsing depth limit to codec

**Files:**
- Modify: `packages/codec/src/index.ts:89-91`
- Modify: `packages/codec/test/lib.test.ts`

**Context:** `b64uToJSON()` calls `JSON.parse()` with no depth limit. A deeply nested JSON string (e.g., 10,000+ levels of `{"a":`) can cause stack overflow or excessive memory consumption. The fix adds a pre-parse depth check by scanning for nesting characters before calling `JSON.parse()`.

Note: We cannot use a custom JSON parser (too complex, not necessary). Instead, we scan the string for maximum nesting depth before parsing. This is O(n) and catches the attack vector without replacing the parser.

**Step 1: Write the failing test**

Add to `packages/codec/test/lib.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

// ... existing imports and tests ...

describe('b64uToJSON()', () => {
  test('rejects deeply nested JSON exceeding depth limit', () => {
    // Create a deeply nested JSON: {"a":{"a":{"a":...}}}
    const depth = 200
    const nested = '{"a":'.repeat(depth) + '1' + '}'.repeat(depth)
    const encoded = b64uFromUTF(nested)
    expect(() => b64uToJSON(encoded)).toThrow('exceeds maximum nesting depth')
  })

  test('accepts JSON within depth limit', () => {
    const obj = { a: { b: { c: { d: 'value' } } } }
    const encoded = b64uFromJSON(obj)
    expect(b64uToJSON(encoded)).toEqual(obj)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit --filter=@enkaku/codec`

Expected: The "rejects deeply nested JSON" test FAILS (no depth check exists).

**Step 3: Add depth checking**

In `packages/codec/src/index.ts`, replace the `b64uToJSON` function:

```typescript
const MAX_JSON_DEPTH = 128

function checkJSONDepth(json: string): void {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = 0; i < json.length; i++) {
    const char = json[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (char === '\\') escape = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
    } else if (char === '{' || char === '[') {
      depth++
      if (depth > MAX_JSON_DEPTH) {
        throw new Error(`JSON exceeds maximum nesting depth of ${MAX_JSON_DEPTH}`)
      }
    } else if (char === '}' || char === ']') {
      depth--
    }
  }
}

/**
 * Convert a base64url-encoded string to a JSON object.
 */
export function b64uToJSON<T = Record<string, unknown>>(base64url: string): T {
  const json = b64uToUTF(base64url)
  checkJSONDepth(json)
  return JSON.parse(json)
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/codec`

Expected: All PASS (including existing tests)

**Step 5: Commit**

```bash
git add packages/codec/src/index.ts packages/codec/test/lib.test.ts
git commit -m "fix(codec): add JSON parsing depth limit (H-08)"
```

---

### Task 4: H-16 — Sanitize error messages sent to clients

**Files:**
- Modify: `packages/server/src/utils.ts:37-41`
- Modify: `packages/server/test/utils.test.ts`

**Context:** `executeHandler()` catches handler exceptions and sends `(cause as Error).message` directly to the client in the error payload. If a handler throws an error containing sensitive information (database connection strings, file paths, stack traces), that information leaks to the client. The fix uses a generic message for non-`HandlerError` errors while preserving the original message for intentional `HandlerError` instances (which developers use to communicate specific error codes and messages to clients).

**Step 1: Write the failing test**

Add to `packages/server/test/utils.test.ts`, inside the existing `describe('executeHandler()')` block:

```typescript
  test('sends generic error message for non-HandlerError exceptions', async () => {
    const controllers = { '1': new AbortController() }
    const events = new EventEmitter<ServerEvents>()
    const handler = vi.fn(() => {
      throw new Error('Connection failed: postgres://admin:secret@internal-db:5432/users')
    })
    const logger = {
      trace: vi.fn(),
    } as unknown as Logger
    const send = vi.fn()

    // @ts-expect-error type instantiation too deep
    await executeHandler(
      {
        controllers,
        events,
        handlers: { test: handler },
        logger,
        send,
      } as unknown as HandlerContext<Protocol>,
      payload,
      () => handler(),
    )
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        typ: 'error',
        rid: '1',
        msg: 'Handler execution failed',
      }),
    )
  })

  test('preserves error message for HandlerError exceptions', async () => {
    const error = new HandlerError({ code: 'CUSTOM', message: 'User not found' })
    const controllers = { '1': new AbortController() }
    const events = new EventEmitter<ServerEvents>()
    const handler = vi.fn(() => {
      throw error
    })
    const logger = {
      trace: vi.fn(),
    } as unknown as Logger
    const send = vi.fn()

    // @ts-expect-error type instantiation too deep
    await executeHandler(
      {
        controllers,
        events,
        handlers: { test: handler },
        logger,
        send,
      } as unknown as HandlerContext<Protocol>,
      payload,
      () => handler(),
    )
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        typ: 'error',
        rid: '1',
        msg: 'User not found',
      }),
    )
  })
```

**Step 2: Run test to verify the "generic error message" test fails**

Run: `pnpm run test:unit --filter=@enkaku/server -- utils.test`

Expected: The "sends generic error message for non-HandlerError exceptions" test FAILS (currently sends the raw error message).

**Step 3: Sanitize the error message**

In `packages/server/src/utils.ts`, replace the catch block (lines 37-61):

```typescript
  } catch (cause) {
    const error = HandlerError.from(cause, {
      code: 'EK01',
      message: 'Handler execution failed',
    })
    if (canSend(controller.signal)) {
      context.logger.trace('send error to {type} {procedure} with ID {rid}', {
        type: payload.typ,
        procedure: payload.prc,
        rid: payload.rid,
        error,
      })
      context.send(error.toPayload(payload.rid) as AnyServerPayloadOf<Protocol>)
    } else {
      context.logger.debug(
        'handler error for {type} {procedure} with ID {rid} cannot be sent to client',
        {
          type: payload.typ,
          procedure: payload.prc,
          rid: payload.rid,
          error,
        },
      )
    }
    context.events.emit('handlerError', { error, payload })
  } finally {
```

The key change: `HandlerError.from()` already preserves the message for `HandlerError` instances (it returns the original error). For non-`HandlerError` errors, the `message` param `'Handler execution failed'` is used as the default. But currently line 40 overrides this with `(cause as Error).message`. The fix removes this override so `HandlerError.from()` uses its `params.message` for non-`HandlerError` causes.

Check `HandlerError.from()` behavior in `packages/server/src/error.ts`:
- If `cause instanceof HandlerError`: returns `cause` as-is (preserves its message)
- If `cause instanceof Error`: creates new `HandlerError({ message: cause.message, ...params, cause })` — the spread of `params` after `message: cause.message` means `params.message` overrides
- Otherwise: creates new `HandlerError({ message: 'Unknown error', ...params, cause })` — same override

Wait — the spread order means `...params` comes after `message:`, so `params.message` already overrides `cause.message`. Let me re-read the code.

Looking at `error.ts:34`: `new HandlerError({ message: cause.message, ...params, cause })` — the `...params` spread includes `message: 'Handler execution failed'` which comes AFTER `message: cause.message`, so it should already override. But `utils.ts:40` currently sets `message: (cause as Error).message ?? 'Handler execution failed'` in the params passed to `HandlerError.from()`, which means the raw error message IS the `params.message`.

The fix: change the `message` in the `HandlerError.from()` call to always use the generic message:

In `packages/server/src/utils.ts`, the current code at line 38-41:
```typescript
    const error = HandlerError.from(cause, {
      code: 'EK01',
      message: (cause as Error).message ?? 'Handler execution failed',
    })
```

Replace with:
```typescript
    const error = HandlerError.from(cause, {
      code: 'EK01',
      message: 'Handler execution failed',
    })
```

This works because `HandlerError.from()`:
- Returns the original `HandlerError` when `cause instanceof HandlerError` (preserving its code and message)
- Creates a new `HandlerError` with `message: 'Handler execution failed'` for all other error types

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/server -- utils.test`

Expected: New tests PASS. Check existing test "sends an error response and emits in case of error" — it throws a `HandlerError` with `message: 'Request failed'` and expects `msg: 'Request failed'`, which is preserved because `HandlerError.from()` returns the original `HandlerError`. PASS.

**Step 5: Also update the existing test expectation for emitted error message**

The existing test at line 61 checks `expect(emittedError.error.message).toBe('Request failed')` — this test throws a `HandlerError`, so the message is preserved. No change needed.

**Step 6: Run the full server test suite**

Run: `pnpm run test:unit --filter=@enkaku/server`

Expected: All PASS

**Step 7: Commit**

```bash
git add packages/server/src/utils.ts packages/server/test/utils.test.ts
git commit -m "fix(server): sanitize error messages sent to clients (H-16)"
```

---

### Task 5: H-18 — Add buffer size limits to JSON Lines parser

**Files:**
- Modify: `packages/stream/src/json-lines.ts:16-103`
- Modify: `packages/stream/test/json-lines.test.ts`

**Context:** The `fromJSONLines()` transform accumulates `input` and `output` strings without any size limit. An attacker can send a single line with megabytes of data, causing memory exhaustion. The fix adds configurable `maxBufferSize` and `maxMessageSize` options that reject oversized input.

**Step 1: Write the failing test**

Add to `packages/stream/test/json-lines.test.ts`, inside the existing `describe('fromJSONLines()')` block:

```typescript
  test('rejects messages exceeding maxMessageSize', async () => {
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines({ maxMessageSize: 50 })).pipeTo(sink)

    // Create a JSON object larger than 50 bytes
    const largeObj = JSON.stringify({ data: 'x'.repeat(100) })
    controller.enqueue(largeObj + '\n')
    controller.close()

    await expect(result).rejects.toThrow('exceeds maximum message size')
  })

  test('accepts messages within maxMessageSize', async () => {
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines({ maxMessageSize: 200 })).pipeTo(sink)

    const smallObj = JSON.stringify({ data: 'ok' })
    controller.enqueue(smallObj + '\n')
    controller.close()

    await expect(result).resolves.toEqual([{ data: 'ok' }])
  })

  test('rejects accumulated input exceeding maxBufferSize', async () => {
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines({ maxBufferSize: 50 })).pipeTo(sink)

    // Send a chunk without newline so it accumulates in the input buffer
    controller.enqueue('x'.repeat(60))
    controller.close()

    await expect(result).rejects.toThrow('exceeds maximum buffer size')
  })
```

**Step 2: Run test to verify they fail**

Run: `pnpm run test:unit --filter=@enkaku/stream -- json-lines.test`

Expected: The maxMessageSize and maxBufferSize tests FAIL (options don't exist yet).

**Step 3: Add size limits to fromJSONLines**

In `packages/stream/src/json-lines.ts`, update the options type and function:

```typescript
export type FromJSONLinesOptions<T = unknown> = {
  decode?: DecodeJSON<unknown>
  maxBufferSize?: number
  maxMessageSize?: number
  onInvalidJSON?: (value: string, controller: TransformStreamDefaultController<T>) => void
}

export function fromJSONLines<T = unknown>(
  options: FromJSONLinesOptions<T> = {},
): TransformStream<Uint8Array | string, T> {
  const { decode = JSON.parse, maxBufferSize, maxMessageSize, onInvalidJSON } = options

  let input = ''
  let output = ''
  let nestingDepth = 0
  let isInString = false
  let isEscapingChar = false

  function processChar(char: string): void {
    if (isInString) {
      if (char === '\\') {
        isEscapingChar = !isEscapingChar
      } else {
        if (char === '"' && !isEscapingChar) {
          isInString = false
        }
        isEscapingChar = false
      }
      output += char
    } else {
      switch (char) {
        case '"':
          isInString = true
          output += char
          break
        case '{':
        case '[':
          nestingDepth++
          output += char
          break
        case '}':
        case ']':
          nestingDepth--
          output += char
          break
        default:
          // Ignore whitespace
          if (/\S/.test(char)) {
            output += char
          }
      }
    }
  }

  function checkOutputSize(controller: TransformStreamDefaultController<T>): void {
    if (maxMessageSize != null && output.length > maxMessageSize) {
      controller.error(
        new JSONLinesError(`Message size ${output.length} exceeds maximum message size of ${maxMessageSize}`),
      )
    }
  }

  return transform<Uint8Array | string, T>(
    (chunk, controller) => {
      try {
        input += typeof chunk === 'string' ? chunk : decoder.decode(chunk)
        if (maxBufferSize != null && input.length > maxBufferSize) {
          controller.error(
            new JSONLinesError(`Buffer size ${input.length} exceeds maximum buffer size of ${maxBufferSize}`),
          )
          return
        }
        let newLineIndex = input.indexOf(SEPARATOR)
        while (newLineIndex !== -1) {
          for (const char of input.slice(0, newLineIndex)) {
            processChar(char)
          }
          if (nestingDepth === 0 && !isInString && output !== '') {
            checkOutputSize(controller)
            try {
              controller.enqueue(decode(output))
            } catch {
              onInvalidJSON?.(output, controller)
            }
            output = ''
          } else if (isInString) {
            output += '\\n'
          }
          input = input.slice(newLineIndex + SEPARATOR.length)
          newLineIndex = input.indexOf(SEPARATOR)
        }
      } catch (cause) {
        controller.error(new JSONLinesError('Error processing chunk', { cause }))
      }
    },
    (controller) => {
      for (const char of input) {
        processChar(char)
      }
      if (nestingDepth === 0 && !isInString && output !== '') {
        checkOutputSize(controller)
        try {
          controller.enqueue(decode(output))
        } catch {
          onInvalidJSON?.(output, controller)
        }
      }
    },
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit --filter=@enkaku/stream -- json-lines.test`

Expected: All PASS (including existing tests)

**Step 5: Commit**

```bash
git add packages/stream/src/json-lines.ts packages/stream/test/json-lines.test.ts
git commit -m "fix(stream): add buffer size limits to JSON Lines parser (H-18)"
```

---

### Task 6: H-12 — Validate message payload type in HTTP transport

**Files:**
- Modify: `packages/http-server-transport/src/index.ts:188-221`
- Modify or create: `packages/http-server-transport/test/payload-type.test.ts`

**Context:** The HTTP server transport's `handlePostRequest` function casts `await request.json()` to `Incoming` without validating the payload `typ` field. The `switch` statement's `default` branch throws a generic error, but the error message leaks back to the client. The fix adds explicit type validation using a set of allowed types before the switch statement, and returns a 400 status with a safe error message for invalid types.

**Step 1: Read the full http-server-transport source to understand the Incoming type and structure**

Read `packages/http-server-transport/src/index.ts` to find the `Incoming` type and understand imports.

**Step 2: Write the test**

Create `packages/http-server-transport/test/payload-type.test.ts`. Note: HTTP server transport tests may require complex setup (request handling, SSE). Since the function is internal, test via the exported `handleRequest` function or test the validation logic in isolation.

Due to the complexity of mocking the full HTTP transport, the most practical approach is to add a `VALID_PAYLOAD_TYPES` constant and use it in the switch statement, then test that the error response uses a safe message. The key security fix is ensuring the error response doesn't leak internal details.

In `packages/http-server-transport/src/index.ts`, at the module level, add:

```typescript
const VALID_PAYLOAD_TYPES = new Set(['abort', 'channel', 'event', 'request', 'send', 'stream'])
```

Then in `handlePostRequest`, before the switch statement:

```typescript
    try {
      const message = (await request.json()) as Incoming
      if (!VALID_PAYLOAD_TYPES.has(message?.payload?.typ)) {
        return Response.json(
          { error: 'Invalid message type' },
          { headers, status: 400 },
        )
      }
      switch (message.payload.typ) {
```

And update the catch block to not leak the raw error message:

```typescript
    } catch (err) {
      return Response.json({ error: 'Invalid request' }, { headers, status: 400 })
    }
```

**Step 3: Run existing tests**

Run: `pnpm run test:unit --filter=@enkaku/http-server-transport`

Expected: All existing tests PASS

**Step 4: Commit**

```bash
git add packages/http-server-transport/src/index.ts
git commit -m "fix(http-server-transport): validate message payload type (H-12)"
```

---

### Task 7: Update security audit status

**Files:**
- Modify: `docs/plans/2026-01-28-security-audit.md`

**Step 1: Update status fields**

Update the status of each fixed issue:
- H-02: `[x] Fixed`
- H-07: `[x] Fixed`
- H-08: `[x] Fixed`
- H-12: `[x] Fixed`
- H-16: `[x] Fixed`
- H-18: `[x] Fixed`

**Step 2: Run full test suite**

Run: `pnpm run test`

Expected: All PASS (type checks + unit tests)

**Step 3: Run linting**

Run: `pnpm run lint`

Expected: Clean output (Biome may reformat — that's fine)

**Step 4: Commit**

```bash
git add docs/plans/2026-01-28-security-audit.md
git commit -m "docs: update security audit status for H-02, H-07, H-08, H-12, H-16, H-18"
```

---

## Summary of Changes

| Task | Issue | Package | Change |
|------|-------|---------|--------|
| 1 | H-02 | token | Bounds check in `isCodecMatch()` |
| 2 | H-07 | schema | Block `__proto__`/`constructor`/`prototype` in `resolveReference()` |
| 3 | H-08 | codec | JSON nesting depth limit (128) in `b64uToJSON()` |
| 4 | H-16 | server | Generic error message for non-`HandlerError` exceptions |
| 5 | H-18 | stream | `maxBufferSize` and `maxMessageSize` options in `fromJSONLines()` |
| 6 | H-12 | http-server-transport | Validate `typ` field, safe error responses |
| 7 | — | docs | Update security audit status |
