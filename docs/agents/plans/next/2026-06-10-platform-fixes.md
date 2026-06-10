# Platform Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bounded Plan-4 fixes from the audit remediation design: real ChaCha20-Poly1305 for MLS suite 3, server error replies for schema-invalid messages, a typed EK error-code registry in `@enkaku/protocol`, electron-rpc sender validation + server reuse, and explicit wildcard-capability documentation.

**Architecture:** Each fix is local to one package. The group crypto provider gains AEAD dispatch on `hpkeAlg.aead`; the server's `processMessage` validation-failure branch gains an EK08 reply through the existing `context.send`/`safeWrite` path; error codes move from a source comment in `server/src/error.ts` to exported constants in `@enkaku/protocol` (same string values, so all existing comparisons keep working); electron-rpc gains a pure, vitest-testable `isAllowedSenderURL` wired into `handleProcessPort` plus per-sender server reuse in `serveProcess`.

**Tech Stack:** TypeScript, vitest, @noble/ciphers, Electron IPC

---

**Background facts verified against source (2026-06-10):**

- `packages/group/src/crypto.ts:240` — `const aeadKeySize = hpkeAlg.aead === 'AES256GCM' ? 32 : 16` gives **16-byte keys for ChaCha**; lines 342 and 352 always call `gcm(key, nonce, aad)` regardless of suite. Suite 3 config at lines 481-485 declares `aead: 'CHACHA20POLY1305'`. The AEAD ID ternary at lines 246-247 already yields the correct `0x0003` for ChaCha (RFC 9180), so the HPKE suite ID is right while the cipher and key size are wrong.
- `@noble/ciphers` is at catalog `^2.1.1` (installed 2.2.0). In v2 the subpath export is **`@noble/ciphers/chacha.js`** (the design doc says `@noble/ciphers/chacha`, which does NOT resolve in v2 — the package only exports `./chacha.js`). It exports `chacha20poly1305` with the same `(key, nonce, aad?) => { encrypt, decrypt }` shape as `gcm`. `@enkaku/group` already depends on `@noble/ciphers: catalog:`.
- `packages/server/src/server.ts:154-177` — `processMessage` emits `invalidMessage` and returns `null` on validation failure; no reply is ever sent. `context` (with `send` → `safeWrite`) is defined at lines 101-108, before `processMessage`, so it is in scope. `safeWrite` (`packages/server/src/safe-write.ts`) never rejects, and existing callers fire-and-forget `context.send(...)` without awaiting.
- EK codes in use: `EK01` (`server.ts:228,259`, `utils.ts:68`, `handlers/event.ts:40`), `EK02` (×7 in `server.ts`), `EK03` (`server.ts:189`), `EK04` (`:202`), `EK05` (`:122`), `EK06` (`:533`), `EK07` (`:289`). Registry is a comment block in `packages/server/src/error.ts:3-12`. **EK08 is the next free code.** (`'EK_ENCRYPTION'` at `server.ts:510` is an OTel span attribute, not an error code — leave it.)
- `packages/protocol/src/index.ts` uses plain `export *` for schema modules (values) and `export type *` for type-only modules. Both `@enkaku/server` and `@enkaku/client` already depend on `@enkaku/protocol`. Workspace packages resolve each other through built `lib/`, so **protocol must be rebuilt before server/client tests see new exports**.
- `packages/electron-rpc` has **no vitest setup** (`"test": "pnpm run test:types"` only) and no `test/` directory. Electron e2e coverage lives in `tests/e2e-electron` (Playwright + electron-forge; `serveProcess<Protocol>({ handlers })` in `tests/e2e-electron/src/main.ts`). Unit-testing `ipcMain` is impractical, so sender validation is designed as a pure exported function in a file with no `electron` import.
- `packages/group/test/crypto.test.ts` exercises suite 1 only (`MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`). ts-mls exposes suite 3 as `MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519` and its `Hpke` type declares `keyLength: number`, so `impl.hpke.keyLength` type-checks.
- Lint command in this repo: `rtk proxy pnpm run lint` (not bare `pnpm run lint`).

---

### Task 1: ChaCha20-Poly1305 AEAD for MLS suite 3

**Files:**
- Modify: `packages/group/src/crypto.ts` (imports at line 12, header comment line 7, AEAD params lines 239-241, `aeadEncrypt`/`aeadDecrypt` lines 336-354, HPKE section comment line 151)
- Test: `packages/group/test/crypto.test.ts`

Suite 3 currently produces non-spec-conformant output (AES-GCM with a 16-byte key while advertising ChaCha20-Poly1305), so no interop migration is needed — but confirm first.

- [ ] **Step 1: Confirm no production groups exist on suite 3**

Search the whole Yulsi stack for suite-3 usage outside this package:

```sh
grep -rn "CHACHA20POLY1305" /Users/paul/dev/yulsi --include="*.ts" -l | grep -v node_modules | grep -v "/lib/"
```

Expected: only `enkaku/packages/group/src/crypto.ts` (and, after this task, `enkaku/packages/group/test/crypto.test.ts`). If Kubun or Mokei source files appear, STOP and report to the user before proceeding (a migration path would be needed).

- [ ] **Step 2: Write the failing tests**

Add to `packages/group/test/crypto.test.ts`. New imports at the top of the file:

```ts
import { gcm } from '@noble/ciphers/aes.js'
import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
```

New describe block at the end of the file (inside nothing — sibling of the existing `describe('nobleCryptoProvider', ...)`):

```ts
describe('nobleCryptoProvider ChaCha20-Poly1305 suite (ID 3)', () => {
  const CHACHA_SUITE_NAME = 'MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519' as const

  async function getChaChaImpl() {
    return await getImpl(CHACHA_SUITE_NAME, nobleCryptoProvider)
  }

  test('uses a 32-byte AEAD key', async () => {
    const impl = await getChaChaImpl()
    expect(impl.hpke.keyLength).toBe(32)
  })

  test('encryptAead produces ChaCha20-Poly1305 ciphertext, not AES-GCM', async () => {
    const impl = await getChaChaImpl()
    const key = new Uint8Array(32).fill(7)
    const nonce = new Uint8Array(12).fill(3)
    const aad = new TextEncoder().encode('suite 3 aad')
    const plaintext = new TextEncoder().encode('chacha test message')

    const ct = await impl.hpke.encryptAead(key, nonce, aad, plaintext)

    // Must byte-match a direct @noble/ciphers ChaCha20-Poly1305 encryption...
    const expected = chacha20poly1305(key, nonce, aad).encrypt(plaintext)
    expect(ct).toEqual(expected)
    // ...and differ from AES-256-GCM output for the same key/nonce/aad/plaintext.
    const aesCt = gcm(key, nonce, aad).encrypt(plaintext)
    expect(ct).not.toEqual(aesCt)

    const pt = await impl.hpke.decryptAead(key, nonce, aad, ct)
    expect(new TextDecoder().decode(pt)).toBe('chacha test message')
  })

  test('HPKE seal and open round-trip on suite 3', async () => {
    const impl = await getChaChaImpl()
    const kp = await impl.hpke.generateKeyPair()
    const plaintext = new TextEncoder().encode('hpke chacha message')
    const info = new TextEncoder().encode('suite 3 info')
    const aad = new TextEncoder().encode('suite 3 aad')

    const { ct, enc } = await impl.hpke.seal(kp.publicKey, plaintext, info, aad)
    const decrypted = await impl.hpke.open(kp.privateKey, enc, ct, info, aad)
    expect(new TextDecoder().decode(decrypted)).toBe('hpke chacha message')
  })

  test('group messaging round-trip on suite 3', async () => {
    const cipherSuite = await getChaChaImpl()
    const context: MlsContext = { cipherSuite, authService: unsafeTestingAuthenticationService }

    const alice = await generateKeyPackage({
      credential: makeCredential('alice'),
      cipherSuite,
    })
    let aliceState = await createGroup({
      context,
      groupId: new TextEncoder().encode('chacha-group'),
      keyPackage: alice.publicPackage,
      privateKeyPackage: alice.privatePackage,
    })

    const bob = await generateKeyPackage({
      credential: makeCredential('bob'),
      cipherSuite,
    })
    const addResult = await createCommit({
      context,
      state: aliceState,
      extraProposals: [
        { proposalType: defaultProposalTypes.add, add: { keyPackage: bob.publicPackage } },
      ],
    })
    aliceState = addResult.newState

    const bobState = await joinGroup({
      context,
      welcome: requireWelcome(addResult.welcome).welcome,
      keyPackage: bob.publicPackage,
      privateKeys: bob.privatePackage,
      ratchetTree: aliceState.ratchetTree,
    })

    const { message: privateMessage } = await createApplicationMessage({
      context,
      state: aliceState,
      message: new TextEncoder().encode('hello over chacha'),
    })
    const result = await processMessage({
      context,
      state: bobState,
      message: privateMessage,
    })
    expect(result.kind).toBe('applicationMessage')
    if (result.kind === 'applicationMessage') {
      expect(new TextDecoder().decode(result.message)).toBe('hello over chacha')
    }
  })
})
```

Notes: `getImpl`, `nobleCryptoProvider`, `makeCredential`, `requireWelcome`, `createGroup`, `createCommit`, `joinGroup`, `generateKeyPackage`, `createApplicationMessage`, `processMessage`, `defaultProposalTypes`, `unsafeTestingAuthenticationService`, and `MlsContext` are all already imported/defined in this file. The group round-trip test passes even pre-fix (both sides use the same wrong AEAD) — it is interop/regression coverage; the first two tests are the bug-shaped ones.

- [ ] **Step 3: Run the tests — expect the new ones to FAIL**

```sh
pnpm --filter @enkaku/group run test:unit test/crypto.test.ts
```

Expected failures: `uses a 32-byte AEAD key` (got 16) and `encryptAead produces ChaCha20-Poly1305 ciphertext, not AES-GCM` (ciphertext equals the AES-GCM output, not the ChaCha output). The other two new tests pass pre-fix. All pre-existing suite-1 tests pass.

- [ ] **Step 4: Implement the fix**

In `packages/group/src/crypto.ts`:

1. Add the import after the existing `gcm` import (line 12):

```ts
import { gcm } from '@noble/ciphers/aes.js'
import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
```

2. Update the file header comment line 7 from `- @noble/ciphers for AES-GCM` to:

```ts
 * - @noble/ciphers for AES-GCM and ChaCha20-Poly1305
```

3. Update the HPKE section banner comment (line 151) from `// HPKE (RFC 9180) — X25519 KEM + HKDF + AES-GCM` to:

```ts
// HPKE (RFC 9180) — X25519 KEM + HKDF + AES-GCM / ChaCha20-Poly1305
```

4. Replace lines 239-241 (`// AEAD parameters` through `const aeadNonceSize = 12`) with explicit dispatch on `hpkeAlg.aead`:

```ts
  // AEAD parameters — dispatch on the suite's AEAD algorithm
  type AEADCipher = (
    key: Uint8Array,
    nonce: Uint8Array,
    aad: Uint8Array,
  ) => {
    encrypt: (plaintext: Uint8Array) => Uint8Array
    decrypt: (ciphertext: Uint8Array) => Uint8Array
  }

  let aeadKeySize: number
  let createAEADCipher: AEADCipher
  switch (hpkeAlg.aead) {
    case 'AES128GCM':
      aeadKeySize = 16
      createAEADCipher = gcm
      break
    case 'AES256GCM':
      aeadKeySize = 32
      createAEADCipher = gcm
      break
    case 'CHACHA20POLY1305':
      aeadKeySize = 32
      createAEADCipher = chacha20poly1305
      break
    default:
      throw new Error(`Unsupported AEAD: ${hpkeAlg.aead}`)
  }
  const aeadNonceSize = 12
```

5. Replace the cipher construction in `aeadEncrypt` (line 342) and `aeadDecrypt` (line 352): both `const cipher = gcm(key, nonce, aad)` become:

```ts
    const cipher = createAEADCipher(key, nonce, aad)
```

Leave the `aeadID` ternary at lines 246-247 unchanged — it already maps non-AES suites to `0x0003`, which is the correct RFC 9180 AEAD ID for ChaCha20-Poly1305.

- [ ] **Step 5: Run the tests — expect PASS**

```sh
pnpm --filter @enkaku/group run test
```

All tests pass (type check + unit), including all pre-existing suite-1 tests (AES-GCM paths unchanged: `AES128GCM` still 16-byte key + `gcm`).

- [ ] **Step 6: Lint and commit**

```sh
rtk proxy pnpm run lint
git add packages/group/src/crypto.ts packages/group/test/crypto.test.ts
git commit -m "fix(group): use ChaCha20-Poly1305 AEAD for MLS suite 3

Suite 3 advertised CHACHA20POLY1305 but always encrypted with AES-GCM
and derived 16-byte keys. Dispatch on hpkeAlg.aead with 32-byte keys
for ChaCha. Output was never spec-conformant, no migration needed.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Server error reply (EK08) for schema-invalid messages

**Files:**
- Modify: `packages/server/src/server.ts:154-177` (`processMessage` validator branch), `packages/server/src/error.ts:3-12` (comment registry)
- Create: `packages/server/test/invalid-message-reply.test.ts`

Currently a schema-invalid message is dropped after the `invalidMessage` event; a client awaiting a request/stream/channel reply hangs forever (no default client timeout). When the raw message carries a string `rid` and a reply-capable `typ`, send an EK08 error reply. Keep the `invalidMessage` event unchanged.

- [ ] **Step 1: Write the failing tests**

Create `packages/server/test/invalid-message-reply.test.ts` (same structure as `buffer-limits.test.ts`):

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  echo: {
    type: 'request',
    param: { type: 'string' },
    result: { type: 'string' },
  },
  data: {
    type: 'stream',
    param: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
  chat: {
    type: 'channel',
    param: { type: 'string' },
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
  notify: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function setup() {
  const handler = vi.fn((ctx: { param: string }) => ctx.param)
  const handlers = {
    echo: handler,
    data: vi.fn(async () => 'done'),
    chat: vi.fn(async () => 'done'),
    notify: vi.fn(),
  } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const server = serve<Protocol>({ handlers, protocol, transport: transports.server })
  return { handler, server, transports }
}

describe('Schema-invalid message error replies', () => {
  test('replies with EK08 for invalid request carrying a rid', async () => {
    const { handler, server, transports } = setup()

    // prm must be a string — number fails schema validation
    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        prc: 'echo',
        rid: 'r1',
        prm: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('r1')
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('replies with EK08 for invalid stream carrying a rid', async () => {
    const { server, transports } = setup()

    await transports.client.write(
      createUnsignedToken({
        typ: 'stream',
        prc: 'data',
        rid: 's1',
        prm: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('s1')
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')

    await server.dispose()
    await transports.dispose()
  })

  test('replies with EK08 for invalid channel carrying a rid', async () => {
    const { server, transports } = setup()

    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'chat',
        rid: 'c1',
        prm: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(response.value?.payload.rid).toBe('c1')
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')

    await server.dispose()
    await transports.dispose()
  })

  test('still emits invalidMessage and sends no reply for invalid event (no reply channel)', async () => {
    const { server, transports } = setup()

    const invalidEvents: Array<unknown> = []
    server.events.on('invalidMessage', (event) => {
      invalidEvents.push(event)
    })

    // dat must be an object — string fails schema validation; events have no rid
    await transports.client.write(
      createUnsignedToken({
        typ: 'event',
        prc: 'notify',
        dat: 'not-an-object',
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    // Follow with a valid request: its result must be the FIRST reply received,
    // proving no error reply was sent for the invalid event.
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'echo', rid: 'r2', prm: 'hello' }),
    )

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('result')
    expect(response.value?.payload.rid).toBe('r2')
    expect(invalidEvents.length).toBe(1)

    await server.dispose()
    await transports.dispose()
  })

  test('invalidMessage event is still emitted alongside the EK08 reply', async () => {
    const { server, transports } = setup()

    const invalidEvents: Array<unknown> = []
    server.events.on('invalidMessage', (event) => {
      invalidEvents.push(event)
    })

    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        prc: 'echo',
        rid: 'r3',
        prm: 123,
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const response = await transports.client.read()
    expect((response.value?.payload as Record<string, unknown>).code).toBe('EK08')
    expect(invalidEvents.length).toBe(1)

    await server.dispose()
    await transports.dispose()
  })
})
```

- [ ] **Step 2: Run the tests — expect FAIL**

```sh
pnpm --filter @enkaku/server run test:unit test/invalid-message-reply.test.ts
```

Expected: the three EK08 reply tests and the `alongside` test fail by **vitest timeout** (the `transports.client.read()` never resolves because the server silently drops the message — exactly the bug). The event test passes pre-fix.

- [ ] **Step 3: Implement the fix**

In `packages/server/src/server.ts`, inside the validator branch of `processMessage` (lines 154-177), after the existing `events.emit('invalidMessage', ...)` call and before `return null`, insert:

```ts
          // If the raw message carries a rid on a reply-capable type, send an
          // error reply instead of leaving the client to hang forever.
          const rawPayload =
            message != null && typeof message === 'object' && 'payload' in message
              ? (message as { payload: unknown }).payload
              : undefined
          if (rawPayload != null && typeof rawPayload === 'object') {
            const { rid, typ } = rawPayload as { rid?: unknown; typ?: unknown }
            if (
              typeof rid === 'string' &&
              (typ === 'request' || typ === 'stream' || typ === 'channel')
            ) {
              const error = new HandlerError({
                code: 'EK08',
                message: 'Invalid protocol message',
              })
              context.send(error.toPayload(rid) as AnyServerPayloadOf<Protocol>, { rid })
            }
          }
```

(`HandlerError`, `context`, and `AnyServerPayloadOf` are all already imported/in scope. `context.send` routes through `safeWrite`, which never rejects — fire-and-forget matches every other error-reply site in this file. `abort`/`send`/`event` types get no reply: nothing client-side awaits them.)

In `packages/server/src/error.ts`, extend the comment registry (lines 3-12) with:

```ts
 * - EK08: Invalid protocol message (schema validation failed)
```

(This comment block is replaced by the typed registry in Task 3 — keeping it accurate here keeps Task 2 independently landable.)

- [ ] **Step 4: Run the tests — expect PASS**

```sh
pnpm --filter @enkaku/server run test
```

All server tests pass, including the new file and the pre-existing `buffer-limits`/`validation-warning` suites.

- [ ] **Step 5: Lint and commit**

```sh
rtk proxy pnpm run lint
git add packages/server/src/server.ts packages/server/src/error.ts packages/server/test/invalid-message-reply.test.ts
git commit -m "fix(server): reply with EK08 when schema validation fails on rid-bearing messages

Schema-invalid request/stream/channel messages were silently dropped
after the invalidMessage event, leaving clients hanging forever. Send
an EK08 error reply when the raw payload carries a string rid.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Typed error-code registry in `@enkaku/protocol`

**Files:**
- Create: `packages/protocol/src/error-codes.ts`, `packages/protocol/test/error-codes.test.ts`
- Modify: `packages/protocol/src/index.ts`, `packages/server/src/error.ts`, `packages/server/src/server.ts`, `packages/server/src/utils.ts:68`, `packages/server/src/handlers/event.ts:40`, `packages/server/src/index.ts`, `packages/client/src/error.ts`, `packages/client/src/index.ts:25`

Constants carry the exact same string values (`'EK01'`...`'EK08'`), so every existing literal comparison in tests and consumers keeps working — the existing server test suites asserting literal `'EK06'` etc. are the regression guard.

- [ ] **Step 1: Write the failing test**

Create `packages/protocol/test/error-codes.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { type ErrorCode, ErrorCodes } from '../src/index.js'

describe('ErrorCodes', () => {
  test('exposes the stable EK code registry', () => {
    expect(ErrorCodes).toEqual({
      HANDLER_ERROR: 'EK01',
      ACCESS_DENIED: 'EK02',
      CONTROLLER_LIMIT: 'EK03',
      HANDLER_LIMIT: 'EK04',
      TIMEOUT: 'EK05',
      MESSAGE_TOO_LARGE: 'EK06',
      ENCRYPTION_REQUIRED: 'EK07',
      INVALID_MESSAGE: 'EK08',
    })
  })

  test('ErrorCode union covers registry values and stays a plain string subtype', () => {
    const code: ErrorCode = ErrorCodes.INVALID_MESSAGE
    expect(code).toBe('EK08')
    // Plain string comparison must keep working for existing consumers
    expect(code === 'EK08').toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```sh
pnpm --filter @enkaku/protocol run test:unit test/error-codes.test.ts
```

Expected: fails to resolve `ErrorCodes` from `../src/index.js` (export does not exist yet).

- [ ] **Step 3: Implement the registry**

Create `packages/protocol/src/error-codes.ts`:

```ts
/**
 * Stable Enkaku server error codes, sent in `ErrorReplyPayload.code`.
 *
 * These string values are part of the wire protocol — never renumber or
 * reuse a code. Add new codes at the end with the next free `EK` number.
 */
export const ErrorCodes = {
  /** EK01: Handler execution failed. */
  HANDLER_ERROR: 'EK01',
  /** EK02: Access denied (authorization failure). */
  ACCESS_DENIED: 'EK02',
  /** EK03: Server controller limit reached. */
  CONTROLLER_LIMIT: 'EK03',
  /** EK04: Server handler concurrency limit reached. */
  HANDLER_LIMIT: 'EK04',
  /** EK05: Request timeout (controller expired). */
  TIMEOUT: 'EK05',
  /** EK06: Message exceeds maximum size. */
  MESSAGE_TOO_LARGE: 'EK06',
  /** EK07: Encryption required but message is not encrypted. */
  ENCRYPTION_REQUIRED: 'EK07',
  /** EK08: Invalid protocol message (schema validation failed). */
  INVALID_MESSAGE: 'EK08',
} as const

/** Union of all known Enkaku server error code strings. */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
```

In `packages/protocol/src/index.ts`, add a value export line after the schema exports (line 17):

```ts
export * from './error-codes.js'
```

- [ ] **Step 4: Run protocol tests — expect PASS, then rebuild protocol**

```sh
pnpm --filter @enkaku/protocol run test
pnpm --filter @enkaku/protocol run build
```

The build step is required: server and client resolve `@enkaku/protocol` through its built `lib/`.

- [ ] **Step 5: Re-use the constants in server and client**

In `packages/server/src/error.ts`, replace the comment registry (the `/** Error codes: ... */` block at lines 3-13, including the EK08 line added in Task 2) with a re-export so server consumers get the registry without importing protocol directly:

```ts
import type { ErrorReplyPayload } from '@enkaku/protocol'

export { type ErrorCode, ErrorCodes } from '@enkaku/protocol'
```

In `packages/server/src/index.ts`, add an export line (alongside the existing exports):

```ts
export { type ErrorCode, ErrorCodes } from './error.js'
```

In `packages/server/src/server.ts`:
- Add `ErrorCodes` to the existing `@enkaku/protocol` import block (lines 17-23): it becomes `import { type AnyClientMessageOf, type AnyServerPayloadOf, createClientMessageSchema, ErrorCodes, type ProtocolDefinition, type ServerTransportOf } from '@enkaku/protocol'`.
- Replace every code literal (use Edit with `replace_all` per pair):
  - `code: 'EK01'` → `code: ErrorCodes.HANDLER_ERROR` (2 sites: lines 228, 259)
  - `code: 'EK02'` → `code: ErrorCodes.ACCESS_DENIED` (7 sites)
  - `code: 'EK03'` → `code: ErrorCodes.CONTROLLER_LIMIT`
  - `code: 'EK04'` → `code: ErrorCodes.HANDLER_LIMIT`
  - `code: 'EK05'` → `code: ErrorCodes.TIMEOUT`
  - `code: 'EK06'` → `code: ErrorCodes.MESSAGE_TOO_LARGE`
  - `code: 'EK07'` → `code: ErrorCodes.ENCRYPTION_REQUIRED`
  - `code: 'EK08'` → `code: ErrorCodes.INVALID_MESSAGE` (the Task 2 site)
- Leave the `'EK_ENCRYPTION'` span attribute at line 510 untouched (OTel attribute, not a protocol error code).

In `packages/server/src/utils.ts` (line 68) and `packages/server/src/handlers/event.ts` (line 40): replace `code: 'EK01'` with `code: ErrorCodes.HANDLER_ERROR` and add `import { ErrorCodes } from '@enkaku/protocol'` to each file's imports.

In `packages/client/src/error.ts`, add at the top (after the existing type import):

```ts
export { type ErrorCode, ErrorCodes } from '@enkaku/protocol'
```

In `packages/client/src/index.ts` (line 25), extend the error.js export:

```ts
export { type ErrorCode, ErrorCodes, type ErrorObjectType, RequestError, type RequestErrorParams } from './error.js'
```

- [ ] **Step 6: Run server and client tests — expect PASS**

```sh
pnpm --filter @enkaku/server run test
pnpm --filter @enkaku/client run test
```

Existing literal-string assertions (`'EK01'`...`'EK08'` in `buffer-limits.test.ts`, `event-auth.test.ts`, `channel-send-auth.test.ts`, `encryption-policy.test.ts`, `invalid-message-reply.test.ts`, etc.) all still pass — proving wire compatibility.

- [ ] **Step 7: Lint and commit**

```sh
rtk proxy pnpm run lint
git add packages/protocol packages/server packages/client
git commit -m "feat(protocol): export typed EK error-code registry

Replace the source-comment-only registry in server/src/error.ts with
ErrorCodes constants + ErrorCode union exported from @enkaku/protocol,
re-exported by server and client. Same string values, no wire change.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: electron-rpc sender allowlist and per-sender server reuse

**Files:**
- Create: `packages/electron-rpc/src/allowlist.ts`, `packages/electron-rpc/test/allowlist.test.ts`, `packages/electron-rpc/tsconfig.test.json`
- Modify: `packages/electron-rpc/src/main.ts`, `packages/electron-rpc/src/index.ts`, `packages/electron-rpc/package.json`

`ipcMain` cannot be unit-tested practically (Electron main process only; e2e coverage lives in `tests/e2e-electron` via Playwright/electron-forge and is too heavy for this validation logic). So the URL validation is a **pure exported function** `isAllowedSenderURL` in a file with no `electron` import, unit-tested with vitest, and wired into the `ipcMain` handler. `serveProcess` additionally reuses/replaces the server per sender (one live server per `(sender, name)`) instead of creating an unbounded number.

- [ ] **Step 1: Add vitest setup to the package**

In `packages/electron-rpc/package.json`:
- Add to `devDependencies`: `"vitest": "catalog:"`
- Replace the scripts `"test:types": "tsc --noEmit"` and `"test": "pnpm run test:types"` with:

```json
    "test:types": "tsc --noEmit --skipLibCheck -p tsconfig.test.json",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
```

Create `packages/electron-rpc/tsconfig.test.json` (mirrors `packages/group/tsconfig.test.json`):

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

Then install:

```sh
pnpm install
```

- [ ] **Step 2: Write the failing tests**

Create `packages/electron-rpc/test/allowlist.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { isAllowedSenderURL } from '../src/allowlist.js'

describe('isAllowedSenderURL', () => {
  test('matches exact string entries', () => {
    expect(isAllowedSenderURL('https://app.example.com/index.html', ['https://app.example.com/index.html'])).toBe(true)
    expect(isAllowedSenderURL('https://evil.example.com/index.html', ['https://app.example.com/index.html'])).toBe(false)
  })

  test('matches prefix entries ending with *', () => {
    expect(isAllowedSenderURL('file:///opt/app/renderer/index.html', ['file://*'])).toBe(true)
    expect(isAllowedSenderURL('https://app.example.com/page?x=1', ['https://app.example.com/*'])).toBe(true)
    expect(isAllowedSenderURL('https://app.example.com.evil.io/page', ['https://app.example.com/*'])).toBe(false)
  })

  test('matches RegExp entries', () => {
    expect(isAllowedSenderURL('http://localhost:5173/', [/^http:\/\/localhost:\d+\//])).toBe(true)
    expect(isAllowedSenderURL('http://localhost.evil.io/', [/^http:\/\/localhost:\d+\//])).toBe(false)
  })

  test('denies everything with an empty allowlist', () => {
    expect(isAllowedSenderURL('file:///opt/app/index.html', [])).toBe(false)
  })

  test('first matching entry wins across mixed entries', () => {
    const allowlist = ['https://app.example.com/*', /^file:\/\/\/opt\/app\//]
    expect(isAllowedSenderURL('file:///opt/app/index.html', allowlist)).toBe(true)
    expect(isAllowedSenderURL('file:///tmp/other.html', allowlist)).toBe(false)
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```sh
pnpm --filter @enkaku/electron-rpc run test:unit
```

Expected: fails because `../src/allowlist.js` does not exist.

- [ ] **Step 4: Implement the pure validator**

Create `packages/electron-rpc/src/allowlist.ts` (NO electron import — must stay unit-testable):

```ts
/** Allowlist of sender frame URLs: exact strings, `*`-suffixed prefixes, or RegExps. */
export type SenderURLAllowlist = Array<string | RegExp>

/**
 * Check a sender frame URL against an allowlist.
 *
 * Entry forms:
 * - exact string: the URL must match exactly
 * - string ending with `*`: the URL must start with the part before the `*`
 *   (e.g. `'file://*'` for packaged apps, `'https://app.example.com/*'`)
 * - RegExp: tested against the full URL
 *
 * An empty allowlist denies every URL.
 */
export function isAllowedSenderURL(url: string, allowlist: SenderURLAllowlist): boolean {
  for (const entry of allowlist) {
    if (typeof entry === 'string') {
      if (entry.endsWith('*')) {
        if (url.startsWith(entry.slice(0, -1))) {
          return true
        }
      } else if (url === entry) {
        return true
      }
    } else if (entry.test(url)) {
      return true
    }
  }
  return false
}
```

- [ ] **Step 5: Run — expect PASS**

```sh
pnpm --filter @enkaku/electron-rpc run test:unit
```

- [ ] **Step 6: Wire validation and server reuse into main.ts**

Replace the full contents of `packages/electron-rpc/src/main.ts` with:

```ts
import type { ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'
import { type ServeParams, type Server, serve } from '@enkaku/server'
import { Transport } from '@enkaku/transport'
import { type IpcMainEvent, ipcMain, MessageChannelMain, type MessagePortMain } from 'electron'

import { isAllowedSenderURL, type SenderURLAllowlist } from './allowlist.js'
import { DEFAULT_BRIDGE_NAME } from './constants.js'

export type PortOrPromise = MessagePortMain | Promise<MessagePortMain>
export type PortInput = PortOrPromise | (() => PortOrPromise)
export type PortHandler = (port: MessagePortMain, event: IpcMainEvent) => void | Promise<void>

export async function createMainTransportStream<R, W>(
  input: PortInput,
): Promise<ReadableWritablePair<R, W>> {
  const port = await Promise.resolve(typeof input === 'function' ? input() : input)

  const readable = new ReadableStream({
    start(controller) {
      port.on('message', (msg) => {
        controller.enqueue(msg.data)
      })
      port.start()
    },
  })

  const writable = new WritableStream({
    write(msg) {
      port.postMessage(msg)
    },
  })

  return { readable, writable }
}

export type HandleProcessPortOptions = {
  /**
   * Allowlist of sender frame URLs permitted to request a port. When set,
   * requests from frames whose URL does not match (or with no sender frame)
   * are silently ignored. When omitted, ALL frames are accepted — only safe
   * if no untrusted/remote content can ever load in any window.
   */
  allowedSenderURLs?: SenderURLAllowlist
}

/**
 * Listen for `enkaku:process/<name>/create` IPC messages and hand a
 * MessagePort back to the requesting renderer frame.
 *
 * Security: any frame in any window can send this IPC message. Pass
 * `allowedSenderURLs` to restrict which frames get a port, and prefer
 * `identity`/`accessRules` on the served protocol for privileged handlers —
 * frame-URL checks alone are not an authentication mechanism.
 */
export function handleProcessPort(
  name: string,
  handler: PortHandler,
  options: HandleProcessPortOptions = {},
) {
  const { allowedSenderURLs } = options
  ipcMain.on(`enkaku:process/${name}/create`, async (event) => {
    if (allowedSenderURLs != null) {
      const senderURL = event.senderFrame?.url
      if (senderURL == null || !isAllowedSenderURL(senderURL, allowedSenderURLs)) {
        return
      }
    }
    const { port1, port2 } = new MessageChannelMain()
    await handler(port1, event)
    event.sender.postMessage(`enkaku:process/${name}/port`, null, [port2])
  })
}

export type ServeProcessParams<Protocol extends ProtocolDefinition> = Omit<
  ServeParams<Protocol>,
  'transport'
> & {
  name?: string
  /** See {@link HandleProcessPortOptions.allowedSenderURLs}. */
  allowedSenderURLs?: SenderURLAllowlist
}

/**
 * Serve an Enkaku protocol to renderer processes over Electron IPC ports.
 *
 * One live server is kept per (sender, name): a repeated create request from
 * the same WebContents (e.g. after a reload) disposes the previous server and
 * port before creating new ones, so renderers cannot grow servers without
 * bound. Servers are also disposed when the sender is destroyed.
 *
 * Security: handlers run in the main process. For privileged procedures,
 * configure the server's `identity`/`accessRules` (token auth) in addition to
 * `allowedSenderURLs` — the frame URL restricts which frames get a transport,
 * while access rules authorize individual calls.
 */
export function serveProcess<Protocol extends ProtocolDefinition>(
  params: ServeProcessParams<Protocol>,
) {
  const { name, allowedSenderURLs, ...serverParams } = params
  const active = new Map<number, { port: MessagePortMain; server: Server<Protocol> }>()

  handleProcessPort(
    name ?? DEFAULT_BRIDGE_NAME,
    (port, event) => {
      const senderID = event.sender.id

      // Reuse cap: one live server per (sender, name) — replace any previous one
      const previous = active.get(senderID)
      if (previous != null) {
        active.delete(senderID)
        previous.port.close()
        void previous.server.dispose()
      }

      const transport = new Transport({
        stream: createMainTransportStream(port),
      }) as ServerTransportOf<Protocol>
      const server = serve<Protocol>({ transport, ...serverParams } as ServeParams<Protocol>)
      active.set(senderID, { port, server })

      event.sender.once('destroyed', () => {
        if (active.get(senderID)?.server === server) {
          active.delete(senderID)
        }
        port.close()
        void server.dispose()
      })
    },
    { allowedSenderURLs },
  )
}
```

(Diff vs current source: new `allowlist.js` import, `HandleProcessPortOptions` + allowlist check in `handleProcessPort`, `allowedSenderURLs` param + `active` map + previous-server replacement in `serveProcess`, and JSDoc on both. `createMainTransportStream`, constants, and the port wiring are unchanged.)

Update `packages/electron-rpc/src/index.ts` exports — add after the existing main.js export lines:

```ts
export { isAllowedSenderURL, type SenderURLAllowlist } from './allowlist.js'
export { type HandleProcessPortOptions, handleProcessPort } from './main.js'
```

- [ ] **Step 7: Run package tests and verify e2e app still compiles — expect PASS**

```sh
pnpm --filter @enkaku/electron-rpc run test
pnpm --filter e2e-electron exec tsc --noEmit 2>/dev/null || echo "e2e type-check script unavailable — verify tests/e2e-electron/src/main.ts compiles via the package's own test/lint setup"
```

`tests/e2e-electron/src/main.ts` calls `serveProcess<Protocol>({ handlers })` — both new params are optional, so it must keep compiling unchanged. (Running the full Playwright e2e suite is optional; it requires an Electron build and is unchanged behaviorally when no allowlist is passed.)

- [ ] **Step 8: Lint and commit**

```sh
rtk proxy pnpm run lint
git add packages/electron-rpc pnpm-lock.yaml
git commit -m "feat(electron-rpc): sender-frame URL allowlist and per-sender server reuse

Add isAllowedSenderURL + allowedSenderURLs option on handleProcessPort
and serveProcess; keep one live server per (sender, name) instead of
unbounded creation; document identity/accessRules for privileged
handlers.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Document the group capability `*` wildcard blast radius

**Files:**
- Modify: `packages/group/src/capability.ts:78-97` (JSDoc of `validateGroupCapability` + inline comment at the match)

**Design decision (resolved):** KEEP `res === '*'` support — root identities elsewhere in the Yulsi stack rely on stack-wide `*` capabilities. Do NOT change behavior; document the blast radius explicitly so it can never be mistaken for an oversight.

- [ ] **Step 1: Extend the JSDoc and add the inline comment**

In `packages/group/src/capability.ts`, replace the existing JSDoc of `validateGroupCapability` (lines 78-80):

```ts
/**
 * Validates that a capability token grants the specified permission for a group.
 */
```

with:

```ts
/**
 * Validates that a capability token grants the specified permission for a group.
 *
 * Resource matching accepts three forms:
 * - `group/<groupID>/*` — full access to a single group (what
 *   {@link createGroupCapability} and {@link delegateGroupMembership} issue)
 * - `group/<groupID>/<suffix>` — scoped access within a single group
 * - `*` — **global wildcard**: grants access to EVERY group, and to every
 *   other resource type in the stack that honours `*`. This is intentionally
 *   supported so root identities holding a stack-wide capability can operate
 *   on any group, but its blast radius is total: a leaked, stolen or
 *   over-delegated `res: ['*']` token compromises all groups at once. Never
 *   issue `*` to regular members or services — delegate `group/<groupID>/*`
 *   (or narrower) instead, with an `exp` and a verifiable delegation chain.
 */
```

And replace the comment above the match (line 91, `// Verify the resource matches the group`) with:

```ts
  // Verify the resource matches the group. `res === '*'` is the global
  // wildcard intentionally kept for root identities — see the JSDoc above
  // for its blast radius before touching this condition.
```

- [ ] **Step 2: Run group tests (behavior unchanged) — expect PASS**

```sh
pnpm --filter @enkaku/group run test
```

No behavior change: `capability.test.ts` and all other group tests pass untouched.

- [ ] **Step 3: Lint and commit**

```sh
rtk proxy pnpm run lint
git add packages/group/src/capability.ts
git commit -m "docs(group): document global wildcard blast radius in validateGroupCapability

Keep res === '*' support (root identities rely on it stack-wide) and
make the security trade-off explicit at the matching site.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full repo test run**

```sh
pnpm run build
pnpm run test
```

Expected: all packages build; all type checks and unit tests pass (turbo runs `test:types` + `test:unit` across the workspace, now including the new electron-rpc unit tests).

- [ ] **Step 2: Lint everything**

```sh
rtk proxy pnpm run lint
```

Commit any formatter-only fallout:

```sh
git status --short
# if dirty:
git add -A && git commit -m "chore: lint fixes for platform-fixes plan

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
