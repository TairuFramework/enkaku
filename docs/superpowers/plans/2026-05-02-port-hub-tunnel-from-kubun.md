# Port hub-tunnel from Kubun — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land `@enkaku/hub-tunnel@0.14.0` in the Enkaku monorepo with sources ported from `kubun/packages/hub-tunnel/`, the wire format aligned to Enkaku message envelopes, and the package published to npm.

**Architecture:** Port sources 1:1 from `kubun/packages/hub-tunnel/` to `enkaku/packages/hub-tunnel/`. Replace the opaque kind enum (`rpc-req`/`rpc-resp`/…) with a discriminated `HubFrame` union `kind: 'message' | 'session-end'` whose `body` (when present) is a standard Enkaku message validated against `@enkaku/protocol` schemas. Drop all shipped `Encryptor` implementations — interface only; callers BYO. The Kubun cutover (rename dependency + delete old package) lives in a separate Kubun PR after publish.

**Tech Stack:** TypeScript + ESM, vitest, AJV-backed `@enkaku/schema` validators, swc build, pnpm workspace, `@enkaku/protocol` runtime dep.

**Reference spec:** `docs/superpowers/specs/2026-05-02-port-hub-tunnel-from-kubun-design.md`.

**Source files (read-only reference) for the port:** `/Users/paul/dev/yulsi/kubun/packages/hub-tunnel/`.

---

## Pre-flight

Working directory: `/Users/paul/dev/yulsi/enkaku/`. Optionally create a worktree:

```bash
git -C /Users/paul/dev/yulsi/enkaku worktree add ../enkaku-hub-tunnel feat/hub-tunnel
cd /Users/paul/dev/yulsi/enkaku-hub-tunnel
```

Verify clean tree:
```bash
git status   # expect: clean
pnpm install # ensure deps installed
```

---

## Task 1: Scaffold package skeleton

**Files:**
- Create: `packages/hub-tunnel/package.json`
- Create: `packages/hub-tunnel/tsconfig.json`
- Create: `packages/hub-tunnel/tsconfig.test.json`
- Create: `packages/hub-tunnel/README.md`
- Create: `packages/hub-tunnel/src/.gitkeep` (placeholder; deleted in Task 2)

- [ ] **Step 1: Create directory tree**

```bash
mkdir -p packages/hub-tunnel/src packages/hub-tunnel/test/fixtures
touch packages/hub-tunnel/src/.gitkeep
```

- [ ] **Step 2: Write `packages/hub-tunnel/package.json`**

```json
{
  "name": "@enkaku/hub-tunnel",
  "version": "0.14.0",
  "license": "MIT",
  "homepage": "https://enkaku.dev",
  "description": "Peer-to-peer Enkaku transport tunneled through a hub relay",
  "keywords": [
    "enkaku",
    "hub",
    "tunnel",
    "transport",
    "p2p"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/TairuFramework/enkaku",
    "directory": "packages/hub-tunnel"
  },
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "exports": {
    ".": "./lib/index.js"
  },
  "files": [
    "lib/*"
  ],
  "sideEffects": false,
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit -p tsconfig.test.json",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@enkaku/async": "workspace:^",
    "@enkaku/codec": "workspace:^",
    "@enkaku/hub-protocol": "workspace:^",
    "@enkaku/protocol": "workspace:^",
    "@enkaku/schema": "workspace:^",
    "@enkaku/transport": "workspace:^"
  },
  "devDependencies": {
    "@enkaku/client": "workspace:^",
    "@enkaku/server": "workspace:^",
    "@enkaku/token": "workspace:^"
  }
}
```

- [ ] **Step 3: Write `packages/hub-tunnel/tsconfig.json`**

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

- [ ] **Step 4: Write `packages/hub-tunnel/tsconfig.test.json`**

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

- [ ] **Step 5: Write `packages/hub-tunnel/README.md`**

```markdown
# @enkaku/hub-tunnel

Peer-to-peer Enkaku transport tunneled through a hub relay. Carries
any Enkaku protocol over a pluggable `Encryptor` (BYO key exchange).

See `docs/agents/hub-tunnel.md` for wire format, Encryptor contract,
and session lifecycle.
```

- [ ] **Step 6: Install deps**

```bash
pnpm install
```

Expected: pnpm wires `@enkaku/hub-tunnel` into the workspace; no new external downloads (all listed deps already present in lockfile via sibling packages, plus `del-cli` and `vitest` from catalog).

- [ ] **Step 7: Commit**

```bash
git add packages/hub-tunnel pnpm-lock.yaml
git commit -m "feat(hub-tunnel): scaffold @enkaku/hub-tunnel package"
```

---

## Task 2: Port unchanged source files (encryptor, errors, events)

These files have zero `@kubun/*` references and need no behavioral changes. Copy verbatim.

**Files:**
- Create: `packages/hub-tunnel/src/encryptor.ts`
- Create: `packages/hub-tunnel/src/errors.ts`
- Create: `packages/hub-tunnel/src/events.ts`
- Delete: `packages/hub-tunnel/src/.gitkeep`

- [ ] **Step 1: Copy `encryptor.ts`**

```bash
cp /Users/paul/dev/yulsi/kubun/packages/hub-tunnel/src/encryptor.ts \
   packages/hub-tunnel/src/encryptor.ts
```

Verify content (should be 4 lines):

```ts
export type Encryptor = {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>
}
```

- [ ] **Step 2: Copy `errors.ts`**

```bash
cp /Users/paul/dev/yulsi/kubun/packages/hub-tunnel/src/errors.ts \
   packages/hub-tunnel/src/errors.ts
```

- [ ] **Step 3: Copy `events.ts`**

```bash
cp /Users/paul/dev/yulsi/kubun/packages/hub-tunnel/src/events.ts \
   packages/hub-tunnel/src/events.ts
```

- [ ] **Step 4: Delete `.gitkeep`**

```bash
rm packages/hub-tunnel/src/.gitkeep
```

- [ ] **Step 5: Type-check**

```bash
pnpm --filter @enkaku/hub-tunnel exec tsc --noEmit
```

Expected: errors only about missing imports from `frame.js`/`transport.js` etc — not yet ported. The three new files individually compile clean. This is a partial check.

- [ ] **Step 6: Commit**

```bash
git add packages/hub-tunnel/src
git commit -m "feat(hub-tunnel): port encryptor, errors, events modules"
```

---

## Task 3: Port `envelope.ts` with `$id` rename

**Files:**
- Create: `packages/hub-tunnel/src/envelope.ts`

- [ ] **Step 1: Copy file**

```bash
cp /Users/paul/dev/yulsi/kubun/packages/hub-tunnel/src/envelope.ts \
   packages/hub-tunnel/src/envelope.ts
```

- [ ] **Step 2: Rename schema `$id`**

Edit `packages/hub-tunnel/src/envelope.ts` line that reads:

```ts
$id: 'urn:kubun:hub-tunnel:envelope',
```

Change to:

```ts
$id: 'urn:enkaku:hub-tunnel:envelope',
```

- [ ] **Step 3: Type-check the file**

```bash
pnpm --filter @enkaku/hub-tunnel exec tsc --noEmit
```

Expected: still errors from missing `frame.js`/`transport.js`, but `envelope.ts` itself compiles.

- [ ] **Step 4: Commit**

```bash
git add packages/hub-tunnel/src/envelope.ts
git commit -m "feat(hub-tunnel): port envelope module, rename schema \$id"
```

---

## Task 4: Rewrite `frame.ts` with Shape Y discriminated union

**Files:**
- Create: `packages/hub-tunnel/src/frame.ts`
- Create: `packages/hub-tunnel/test/frame.test.ts`

The kubun `frame.ts` exports `hubFrameKinds` enum (`rpc-req`/…/`session-end`) and a flat `HubFrame` type with optional `body: unknown`. The Enkaku replacement is a discriminated union keyed on `kind: 'message' | 'session-end'`, with `body` validated against the Enkaku message schema when `kind === 'message'`.

- [ ] **Step 1: Write the failing test first — `packages/hub-tunnel/test/frame.test.ts`**

```ts
import { describe, expect, test } from 'vitest'

import {
  decodeFrame,
  encodeFrame,
  HUB_FRAME_VERSION,
  type HubFrame,
} from '../src/frame.js'
import { FrameDecodeError } from '../src/errors.js'

const SESSION = 'session-x'

const sampleEnkakuMessage = {
  header: { typ: 'unsigned' as const, alg: 'none' as const },
  payload: { typ: 'request' as const, prc: 'echo', rid: 'rid-1', prm: { hello: 'world' } },
}

describe('HubFrame round-trip', () => {
  test('encodes and decodes a message frame', () => {
    const frame: HubFrame = {
      v: 1,
      sessionID: SESSION,
      seq: 0,
      kind: 'message',
      body: sampleEnkakuMessage,
    }
    const bytes = encodeFrame(frame)
    expect(decodeFrame(bytes)).toEqual(frame)
  })

  test('encodes and decodes a session-end frame without reason', () => {
    const frame: HubFrame = {
      v: 1,
      sessionID: SESSION,
      seq: 0,
      kind: 'session-end',
    }
    expect(decodeFrame(encodeFrame(frame))).toEqual(frame)
  })

  test('encodes and decodes a session-end frame with reason', () => {
    const frame: HubFrame = {
      v: 1,
      sessionID: SESSION,
      seq: 0,
      kind: 'session-end',
      reason: 'idle-timeout',
    }
    expect(decodeFrame(encodeFrame(frame))).toEqual(frame)
  })
})

describe('HubFrame validation rejects', () => {
  test('message frame without body', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 1, sessionID: SESSION, seq: 0, kind: 'message' }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('session-end frame with body', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        sessionID: SESSION,
        seq: 0,
        kind: 'session-end',
        body: sampleEnkakuMessage,
      }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('unknown kind', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 1, sessionID: SESSION, seq: 0, kind: 'rpc-req', body: {} }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('malformed body envelope', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        sessionID: SESSION,
        seq: 0,
        kind: 'message',
        body: { not: 'an enkaku message' },
      }),
    )
    expect(() => decodeFrame(bytes)).toThrow(FrameDecodeError)
  })

  test('non-JSON bytes', () => {
    expect(() => decodeFrame(new Uint8Array([0xff, 0xff, 0xff]))).toThrow(FrameDecodeError)
  })

  test('exposes HUB_FRAME_VERSION', () => {
    expect(HUB_FRAME_VERSION).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @enkaku/hub-tunnel exec vitest run test/frame.test.ts
```

Expected: FAIL — `frame.ts` does not exist yet.

- [ ] **Step 3: Determine the Enkaku message schema source**

Inspect `packages/protocol/src/schemas/message.ts` and `packages/protocol/src/schemas/client.ts` / `server.ts`. The cleanest reuse path:

- `createMessageSchema(payloadSchema)` (currently `@internal`) builds an `anyOf(signed, unsigned)` envelope schema given a payload schema.
- For frame validation we want any valid Enkaku payload — i.e., accept signed or unsigned envelopes whose payload conforms to the union of all Enkaku call/reply payloads.

Decision: introduce a permissive payload schema (`{ type: 'object', properties: { typ: { type: 'string' } }, required: ['typ'], additionalProperties: true }`) and use `createMessageSchema` with it. This validates the envelope shape (`{header, payload}`, signature presence, etc.) while leaving payload-shape validation to the consumer's own protocol schema.

If `createMessageSchema` is not exported usefully, inline the envelope schema (signed `anyOf` unsigned) directly in `frame.ts` referencing the underlying `signedHeaderSchema` / `unsignedHeaderSchema` from `@enkaku/token`.

For this plan: try `createMessageSchema` first. If it errors on `@internal`, drop the JSDoc tag in a follow-up commit during this task (it is `export function`, just tagged).

- [ ] **Step 4: Write `packages/hub-tunnel/src/frame.ts`**

```ts
import { createMessageSchema } from '@enkaku/protocol'
import { createValidator, type Schema } from '@enkaku/schema'

import { FrameDecodeError } from './errors.js'

export const HUB_FRAME_VERSION = 1

const permissivePayloadSchema = {
  type: 'object',
  properties: { typ: { type: 'string' } },
  required: ['typ'],
  additionalProperties: true,
} as const satisfies Schema

const enkakuMessageSchema = createMessageSchema(permissivePayloadSchema)

const messageFrameSchema = {
  type: 'object',
  properties: {
    v: { type: 'integer', const: HUB_FRAME_VERSION },
    sessionID: { type: 'string' },
    seq: { type: 'integer' },
    correlationID: { type: 'string' },
    kind: { type: 'string', const: 'message' },
    body: enkakuMessageSchema,
  },
  required: ['v', 'sessionID', 'seq', 'kind', 'body'],
  additionalProperties: false,
} as const satisfies Schema

const sessionEndFrameSchema = {
  type: 'object',
  properties: {
    v: { type: 'integer', const: HUB_FRAME_VERSION },
    sessionID: { type: 'string' },
    seq: { type: 'integer' },
    correlationID: { type: 'string' },
    kind: { type: 'string', const: 'session-end' },
    reason: { type: 'string' },
  },
  required: ['v', 'sessionID', 'seq', 'kind'],
  additionalProperties: false,
} as const satisfies Schema

export const hubFrameSchema = {
  $id: 'urn:enkaku:hub-tunnel:frame',
  oneOf: [messageFrameSchema, sessionEndFrameSchema],
} as const satisfies Schema

export type HubFrameMessageBody = {
  header: Record<string, unknown>
  payload: { typ: string; [key: string]: unknown }
  signature?: string
  data?: string
}

export type HubFrame =
  | {
      v: 1
      sessionID: string
      seq: number
      correlationID?: string
      kind: 'message'
      body: HubFrameMessageBody
    }
  | {
      v: 1
      sessionID: string
      seq: number
      correlationID?: string
      kind: 'session-end'
      reason?: string
    }

const validateHubFrame = createValidator(hubFrameSchema)

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: true })

export function encodeFrame(frame: HubFrame): Uint8Array {
  return textEncoder.encode(JSON.stringify(frame))
}

export function decodeFrame(bytes: Uint8Array): HubFrame {
  let text: string
  try {
    text = textDecoder.decode(bytes)
  } catch (cause) {
    throw new FrameDecodeError('Frame bytes are not valid UTF-8', { cause })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new FrameDecodeError('Frame is not valid JSON', { cause })
  }

  const result = validateHubFrame(parsed)
  if ('issues' in result) {
    throw new FrameDecodeError('Frame failed schema validation', { cause: result })
  }
  return result.value as HubFrame
}
```

- [ ] **Step 5: If `createMessageSchema` fails to import (e.g., `@internal` blocks the export)**

Check `packages/protocol/src/schemas/message.ts`. The function is declared `export function createMessageSchema(...)` so the import should work at runtime. Drop the `/** @internal */` JSDoc tag if a build/type tool blocks the consumption (rare; only happens with strict API extractors — not configured today).

- [ ] **Step 6: Run the test**

```bash
pnpm --filter @enkaku/hub-tunnel exec vitest run test/frame.test.ts
```

Expected: PASS — all 9 tests green.

- [ ] **Step 7: Type-check**

```bash
pnpm --filter @enkaku/hub-tunnel run test:types
```

Expected: PASS (or surface remaining errors only in non-`frame.ts` files, since other src files not yet ported).

- [ ] **Step 8: Commit**

```bash
git add packages/hub-tunnel/src/frame.ts packages/hub-tunnel/test/frame.test.ts
git commit -m "feat(hub-tunnel): rewrite frame schema as discriminated union"
```

---

## Task 5: Port `transport.ts` (write path simplified, read path narrowed)

**Files:**
- Create: `packages/hub-tunnel/src/transport.ts`

The kubun `transport.ts` is 352 lines. Two changes from the kubun source:

1. The app-frame write path (around line 293 of kubun source) hardcodes `kind: 'rpc-req'` with a `// TODO(enkaku-port)` comment — replace the literal with `'message'` and drop the TODO comment.
2. The read path's `controller.enqueue(frame.body as R)` (around line 267 of kubun source) runs after the `kind === 'session-end'` branch; under Shape Y `frame.body` is only present when `kind === 'message'`. Add a narrowing guard to keep TS happy — `if (frame.kind !== 'message') continue` after the session-end branch.

- [ ] **Step 1: Copy file**

```bash
cp /Users/paul/dev/yulsi/kubun/packages/hub-tunnel/src/transport.ts \
   packages/hub-tunnel/src/transport.ts
```

- [ ] **Step 2: Update the write path**

In `packages/hub-tunnel/src/transport.ts`, find this block (was lines 288–299 in the kubun source):

```ts
      // TODO(enkaku-port): inspect `value`'s Enkaku message `typ` field and
      // stamp the matching kind (`request` / `result` / `error` / `send` /
      // `receive` / `event` / `abort`). Hardcoded to `'rpc-req'` while the
      // wire format is unreleased; see
      // `docs/agents/plans/next/port-hub-tunnel-to-enkaku.md`.
      const frame: HubFrame = {
        v: 1,
        sessionID: lockedSessionID,
        kind: 'rpc-req',
        seq: outboundSeq++,
        body: value,
      }
```

Replace with:

```ts
      const frame: HubFrame = {
        v: 1,
        sessionID: lockedSessionID,
        kind: 'message',
        seq: outboundSeq++,
        body: value as HubFrame extends { body: infer B } ? B : never,
      }
```

If the inferred-type cast above is awkward, prefer a direct cast and an explanatory comment is unnecessary — the writable stream's `W` type parameter is the caller's contract; runtime validation is the peer's responsibility:

```ts
      const frame: HubFrame = {
        v: 1,
        sessionID: lockedSessionID,
        kind: 'message',
        seq: outboundSeq++,
        body: value as unknown as Extract<HubFrame, { kind: 'message' }>['body'],
      }
```

- [ ] **Step 3: Add narrowing to the read path**

Find the block that decodes a frame and dispatches by `kind`. After the existing `if (frame.kind === 'session-end')` branch (which `return`s), add:

```ts
            if (frame.kind !== 'message') {
              // Defensive — schema validation already restricted to 'message' or 'session-end'.
              continue
            }
```

immediately before the `if (frame.seq < expectedSeq)` check. This narrows TS so `frame.body` access on the line `controller.enqueue(frame.body as R)` type-checks.

- [ ] **Step 4: Type-check**

```bash
pnpm --filter @enkaku/hub-tunnel run test:types
```

Expected: errors only from missing `index.ts` / `encrypted-transport.ts` — `transport.ts` itself compiles.

- [ ] **Step 5: Commit**

```bash
git add packages/hub-tunnel/src/transport.ts
git commit -m "feat(hub-tunnel): port transport, align write path with new frame kind"
```

---

## Task 6: Port `encrypted-transport.ts` (1:1)

**Files:**
- Create: `packages/hub-tunnel/src/encrypted-transport.ts`

- [ ] **Step 1: Copy file**

```bash
cp /Users/paul/dev/yulsi/kubun/packages/hub-tunnel/src/encrypted-transport.ts \
   packages/hub-tunnel/src/encrypted-transport.ts
```

- [ ] **Step 2: Verify no `@kubun/*` imports remain**

```bash
grep -n '@kubun' packages/hub-tunnel/src/encrypted-transport.ts
```

Expected: no matches.

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @enkaku/hub-tunnel run test:types
```

Expected: errors only from missing `index.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/hub-tunnel/src/encrypted-transport.ts
git commit -m "feat(hub-tunnel): port encrypted-transport"
```

---

## Task 7: Port `index.ts` (re-exports)

**Files:**
- Create: `packages/hub-tunnel/src/index.ts`

The kubun `index.ts` exports a `hubFrameKinds` constant (`'rpc-req' | 'rpc-resp' | …`) and a `HubFrameKind` type alias. These no longer exist under Shape Y. Drop them from re-exports.

- [ ] **Step 1: Write `packages/hub-tunnel/src/index.ts`**

```ts
// @enkaku/hub-tunnel — peer-to-peer Enkaku transport over the hub relay
export {
  createEncryptedHubTunnelTransport,
  type EncryptedHubTunnelTransportParams,
} from './encrypted-transport.js'
export type { Encryptor } from './encryptor.js'
export {
  decodeEnvelope,
  encodeEnvelope,
  TUNNEL_ENVELOPE_VERSION,
  type TunnelEnvelope,
  tunnelEnvelopeSchema,
} from './envelope.js'
export {
  BackpressureError,
  DecryptError,
  EncryptError,
  EnvelopeDecodeError,
  FrameDecodeError,
  HubReconnectingError,
  SessionNotEstablishedError,
} from './errors.js'
export type {
  FrameDroppedReason,
  ObservabilityEvent,
  ObservabilityEventListener,
} from './events.js'
export {
  decodeFrame,
  encodeFrame,
  HUB_FRAME_VERSION,
  type HubFrame,
  type HubFrameMessageBody,
  hubFrameSchema,
} from './frame.js'
export {
  createHubTunnelTransport,
  type HubLike,
  type HubLikeEvent,
  type HubLikeEventListener,
  type HubLikeEvents,
  type HubReceiveSubscription,
  type HubTunnelSessionID,
  type HubTunnelTransportParams,
} from './transport.js'
```

- [ ] **Step 2: Type-check the package**

```bash
pnpm --filter @enkaku/hub-tunnel run test:types
```

Expected: PASS — all source compiles.

- [ ] **Step 3: Build**

```bash
pnpm --filter @enkaku/hub-tunnel run build
```

Expected: PASS — `lib/` populated.

- [ ] **Step 4: Commit**

```bash
git add packages/hub-tunnel/src/index.ts
git commit -m "feat(hub-tunnel): add index re-exports"
```

---

## Task 8: Port test fixtures

**Files:**
- Create: `packages/hub-tunnel/test/fixtures/echo-protocol.ts`
- Create: `packages/hub-tunnel/test/fixtures/fake-encryptor.ts`
- Create: `packages/hub-tunnel/test/fixtures/fake-hub.ts`

- [ ] **Step 1: Copy all three fixtures**

```bash
cp /Users/paul/dev/yulsi/kubun/packages/hub-tunnel/test/fixtures/echo-protocol.ts \
   packages/hub-tunnel/test/fixtures/echo-protocol.ts
cp /Users/paul/dev/yulsi/kubun/packages/hub-tunnel/test/fixtures/fake-encryptor.ts \
   packages/hub-tunnel/test/fixtures/fake-encryptor.ts
cp /Users/paul/dev/yulsi/kubun/packages/hub-tunnel/test/fixtures/fake-hub.ts \
   packages/hub-tunnel/test/fixtures/fake-hub.ts
```

- [ ] **Step 2: Verify no `@kubun/*` imports**

```bash
grep -n '@kubun' packages/hub-tunnel/test/fixtures/*.ts
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add packages/hub-tunnel/test/fixtures
git commit -m "feat(hub-tunnel): port test fixtures"
```

---

## Task 9: Port unchanged test files

The following 14 test files are 1:1 ports — assertions reference frame `kind: 'rpc-req'`/`'ch-msg'` only via fixtures or via the integration behavior, not directly in assertions. (Per source inspection in spec.) After copying, run them; if any fail because of direct kind-string assertions, capture them for Task 10.

**Files (each created by copy):**
- `packages/hub-tunnel/test/echo-protocol.test.ts`
- `packages/hub-tunnel/test/encrypted-transport.test.ts`
- `packages/hub-tunnel/test/encrypted-transport-decrypt-fail.test.ts`
- `packages/hub-tunnel/test/encrypted-transport-e2e.test.ts`
- `packages/hub-tunnel/test/encrypted-transport-encrypt-fail.test.ts`
- `packages/hub-tunnel/test/encrypted-transport-observability.test.ts`
- `packages/hub-tunnel/test/encrypted-transport-opacity.test.ts`
- `packages/hub-tunnel/test/encrypted-transport-tampered.test.ts`
- `packages/hub-tunnel/test/envelope.test.ts`
- `packages/hub-tunnel/test/fake-encryptor.test.ts`
- `packages/hub-tunnel/test/fake-hub.test.ts`
- `packages/hub-tunnel/test/transport.test.ts`
- `packages/hub-tunnel/test/transport-backpressure.test.ts`
- `packages/hub-tunnel/test/transport-concurrent.test.ts`

(The five files that need rewrites are handled in Task 10.)

- [ ] **Step 1: Copy all 14 files in one shot**

```bash
for f in echo-protocol \
         encrypted-transport \
         encrypted-transport-decrypt-fail \
         encrypted-transport-e2e \
         encrypted-transport-encrypt-fail \
         encrypted-transport-observability \
         encrypted-transport-opacity \
         encrypted-transport-tampered \
         envelope \
         fake-encryptor \
         fake-hub \
         transport \
         transport-backpressure \
         transport-concurrent; do
  cp "/Users/paul/dev/yulsi/kubun/packages/hub-tunnel/test/${f}.test.ts" \
     "packages/hub-tunnel/test/${f}.test.ts"
done
```

- [ ] **Step 2: Update envelope schema `$id` assertion if present**

```bash
grep -n 'urn:kubun' packages/hub-tunnel/test/*.ts
```

For each match, replace `urn:kubun:hub-tunnel:envelope` with `urn:enkaku:hub-tunnel:envelope`. If matches include `urn:kubun:hub-tunnel:frame`, replace with `urn:enkaku:hub-tunnel:frame`.

- [ ] **Step 3: Replace any direct `kind: 'rpc-…'` / `'ch-…'` literals with `kind: 'message'`**

```bash
grep -nE "kind: ?'(rpc-req|rpc-resp|rpc-err|ch-open|ch-msg|ch-close|ch-err)'" \
  packages/hub-tunnel/test/*.ts
```

For each match (excluding `frame.test.ts` which was already authored under the new shape), update the literal to `kind: 'message'`. If the test additionally asserts the inner Enkaku payload's `typ`, leave that intact.

- [ ] **Step 4: Run unit tests**

```bash
pnpm --filter @enkaku/hub-tunnel run test:unit
```

Expected: previously-passing kubun tests now green against Enkaku package. Any failures are bugs from the kind alignment — fix in Task 10 (transport-* tests are flagged for likely rewrites; the current task may surface additional failures).

- [ ] **Step 5: Commit**

```bash
git add packages/hub-tunnel/test
git commit -m "feat(hub-tunnel): port unchanged test files, align kind literals"
```

---

## Task 10: Port + rewrite kind-aware transport tests

Five transport tests assert kind transitions across send/receive cycles and may inspect the inner kind ladder (`rpc-req` → `rpc-resp`, `ch-open` → `ch-msg` → `ch-close`). Under Shape Y the outer `kind` is always `'message'`; the inner Enkaku payload `typ` carries the request/result/event distinction.

**Files (created by copy + rewritten):**
- `packages/hub-tunnel/test/transport-auto-session.test.ts`
- `packages/hub-tunnel/test/transport-channel.test.ts`
- `packages/hub-tunnel/test/transport-lifecycle.test.ts`
- `packages/hub-tunnel/test/transport-ordering.test.ts`
- `packages/hub-tunnel/test/transport-reconnect.test.ts`

- [ ] **Step 1: Copy the five files**

```bash
for f in transport-auto-session \
         transport-channel \
         transport-lifecycle \
         transport-ordering \
         transport-reconnect; do
  cp "/Users/paul/dev/yulsi/kubun/packages/hub-tunnel/test/${f}.test.ts" \
     "packages/hub-tunnel/test/${f}.test.ts"
done
```

- [ ] **Step 2: Run them as-is to catch failures**

```bash
pnpm --filter @enkaku/hub-tunnel exec vitest run \
  test/transport-auto-session.test.ts \
  test/transport-channel.test.ts \
  test/transport-lifecycle.test.ts \
  test/transport-ordering.test.ts \
  test/transport-reconnect.test.ts
```

Expected: failures wherever a test asserts a specific outer kind string (`rpc-req`/`ch-open`/etc) or destructures `kind` from a frame.

- [ ] **Step 3: For each failure, apply this rewrite recipe**

Two patterns to look for in the failing test:

  - `expect(frame.kind).toBe('rpc-req')` → `expect(frame.kind).toBe('message')` and additionally `expect(frame.body.payload.typ).toBe('request')`.
  - `frame.kind === 'ch-msg'` (control flow) → `frame.kind === 'message' && frame.body.payload.typ === 'send'` (or `'receive'` for the reply direction).
  - Any test that constructs a frame manually (encoding `'rpc-req'`/`'ch-open'`) → reconstruct as `kind: 'message'` with a synthetic Enkaku message body using fixtures.

For tests that inspect `session-end` flow, no change needed — kind stays the same.

- [ ] **Step 4: Run the five files until green**

```bash
pnpm --filter @enkaku/hub-tunnel exec vitest run \
  test/transport-auto-session.test.ts \
  test/transport-channel.test.ts \
  test/transport-lifecycle.test.ts \
  test/transport-ordering.test.ts \
  test/transport-reconnect.test.ts
```

Expected: all green.

- [ ] **Step 5: Run the full package test suite**

```bash
pnpm --filter @enkaku/hub-tunnel test
```

Expected: type checks + unit tests all green.

- [ ] **Step 6: Commit**

```bash
git add packages/hub-tunnel/test
git commit -m "test(hub-tunnel): rewrite transport tests for new frame shape"
```

---

## Task 11: Add integration test in `tests/integration`

**Files:**
- Create: `tests/integration/test/hub-tunnel-echo.test.ts`
- Modify: `tests/integration/package.json`

- [ ] **Step 1: Inspect existing integration test layout**

```bash
ls tests/integration/
cat tests/integration/package.json
ls tests/integration/test/ 2>/dev/null || ls tests/integration/src/
```

Confirm test directory and import conventions in this package; mirror them.

- [ ] **Step 2: Add `@enkaku/hub-tunnel` to `tests/integration/package.json` devDependencies**

```bash
# Edit tests/integration/package.json — add:
#   "@enkaku/hub-tunnel": "workspace:^"
# under "devDependencies".
pnpm install
```

- [ ] **Step 3: Write `tests/integration/test/hub-tunnel-echo.test.ts`**

Path is conventional; if the integration package uses `src/` for tests adjust accordingly.

```ts
import { createClient } from '@enkaku/client'
import { defineRequestProcedure, defineProtocol } from '@enkaku/protocol'
import { createServer } from '@enkaku/server'
import {
  createHubTunnelTransport,
  type Encryptor,
  type HubLike,
} from '@enkaku/hub-tunnel'
import { describe, expect, test } from 'vitest'

// Inline noop encryptor — passthrough; fine for tests, never ship to prod.
const noopEncryptor: Encryptor = {
  async encrypt(plaintext) {
    return plaintext
  },
  async decrypt(ciphertext) {
    return ciphertext
  },
}

// Minimal in-memory hub double satisfying HubLike for two peers.
function createInMemoryHub(): { hub: (did: string) => HubLike } {
  type StoredMessage = {
    senderDID: string
    recipients: Array<string>
    payload: Uint8Array
    sequenceID: string
  }
  const inboxes = new Map<string, Array<StoredMessage>>()
  const wakers = new Map<string, Array<() => void>>()
  let seq = 0
  const wake = (did: string): void => {
    const list = wakers.get(did) ?? []
    wakers.set(did, [])
    for (const w of list) w()
  }
  const hubFor = (localDID: string): HubLike => ({
    async send(params) {
      const msg = { ...params, sequenceID: String(seq++) }
      for (const recipient of params.recipients) {
        const inbox = inboxes.get(recipient) ?? []
        inbox.push(msg)
        inboxes.set(recipient, inbox)
        wake(recipient)
      }
      return { sequenceID: msg.sequenceID }
    },
    receive(deviceDID: string) {
      let cursor = 0
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              while (true) {
                const inbox = inboxes.get(deviceDID) ?? []
                if (cursor < inbox.length) {
                  const value = inbox[cursor++]
                  return { value, done: false }
                }
                await new Promise<void>((resolve) => {
                  const list = wakers.get(deviceDID) ?? []
                  list.push(resolve)
                  wakers.set(deviceDID, list)
                })
              }
            },
          }
        },
      }
    },
  })
  return { hub: hubFor }
}

const protocol = defineProtocol({
  echo: defineRequestProcedure<{ msg: string }, { msg: string }>(),
})

describe('hub-tunnel echo', () => {
  test('client → server round-trip via in-memory hub', async () => {
    const { hub } = createInMemoryHub()

    const clientTransport = createHubTunnelTransport({
      hub: hub('client'),
      sessionID: 'session-1',
      localDID: 'client',
      peerDID: 'server',
    })

    const serverTransport = createHubTunnelTransport({
      hub: hub('server'),
      sessionID: 'session-1',
      localDID: 'server',
      peerDID: 'client',
    })

    const server = createServer({
      protocol,
      transport: serverTransport,
      handlers: {
        echo: async ({ params }) => params,
      },
    })
    void server.start()

    const client = createClient({ protocol, transport: clientTransport })
    const result = await client.request('echo', { msg: 'hello' })

    expect(result).toEqual({ msg: 'hello' })

    void noopEncryptor // silence unused — exercises type compatibility
    await client.dispose()
    await server.dispose()
  })
})
```

(If `@enkaku/server` / `@enkaku/client` differ from the API used above, adjust to match the package's actual surface — inspect `packages/server/src/index.ts` and `packages/client/src/index.ts` and update the test. The shape above is the intent: define an echo procedure, run it through `createHubTunnelTransport`, assert the round-trip.)

- [ ] **Step 4: Run integration test**

```bash
pnpm --filter @enkaku/integration-tests test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/integration
git commit -m "test(hub-tunnel): add echo integration test"
```

---

## Task 12: Add architecture doc `docs/agents/hub-tunnel.md`

**Files:**
- Create: `docs/agents/hub-tunnel.md`

- [ ] **Step 1: Write the doc**

```markdown
# Hub-tunnel transport

`@enkaku/hub-tunnel` is a peer-to-peer Enkaku transport that tunnels
Enkaku messages between two peers through a hub relay. The hub acts
as a store-and-forward inbox keyed by recipient DID; the tunnel layer
adds session ordering, sequence numbers, encryption, and graceful
session-end semantics.

## When to use

- Two clients need to speak Enkaku to each other but cannot connect
  directly (NAT, mobile, air-gapped through a relay).
- A trusted relay exists (`HubLike`) but you want end-to-end
  confidentiality, not relay-mediated trust.

For direct peer-to-peer (WebSocket, Node streams, HTTP) use
`@enkaku/transport` instead.

## Architecture

```
[ Enkaku client/server ]
         │
[ EncryptedHubTunnelTransport ]   ← optional encryption layer
         │
[ HubTunnelTransport ]            ← framing, ordering, session-end
         │
[ HubLike ]                       ← caller-provided relay
```

`HubTunnelTransport` reads from a single `hub.receive(localDID)` inbox
subscription and writes to `hub.send`. Frames carry an Enkaku message
in `body` plus session-level routing metadata (sessionID, seq).

`EncryptedHubTunnelTransport` wraps `HubTunnelTransport`, encrypting
the body before encoding into a frame and decrypting on receive.

## Wire format

```ts
type HubFrame =
  | { v: 1; sessionID: string; seq: number; correlationID?: string;
      kind: 'message'; body: EnkakuMessage }
  | { v: 1; sessionID: string; seq: number; correlationID?: string;
      kind: 'session-end'; reason?: string }
```

Schema `$id`: `urn:enkaku:hub-tunnel:frame`.
- `kind: 'message'` — `body` is a standard Enkaku message envelope
  (`{header, payload}`); the inner `payload.typ` is the single source
  of truth for application-layer dispatch.
- `kind: 'session-end'` — hub-tunnel control frame; signals graceful
  end-of-session. Optional `reason` is human-readable context.

`HUB_FRAME_VERSION = 1`.

The encryption envelope (`urn:enkaku:hub-tunnel:envelope`) wraps a
ciphertext payload:

```ts
type TunnelEnvelope = { v: 1; groupID: string; ciphertext: string }
```

`TUNNEL_ENVELOPE_VERSION = 1`.

## Encryptor contract

```ts
type Encryptor = {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>
}
```

Hub-tunnel ships the interface only; callers supply implementations
that fit their key-exchange model (MLS group, Noise session, OPAQUE,
etc.).

**Caller responsibilities:**
- AEAD with associated-data binding to sessionID/seq (defense in
  depth against cross-session replays).
- Replay defense beyond AEAD nonce (per-session monotonic counter).
- Key rotation. Hub-tunnel does not signal rekey moments; callers
  schedule them out-of-band.
- Failure semantics: implementations throw; `EncryptError` /
  `DecryptError` wrap the cause. Decrypt failures cause the readable
  side to error out and the transport tears down.

## Session lifecycle

- **Open.** First frame received establishes `lockedSessionID` if the
  caller passed `{ auto: true }`. Subsequent frames with mismatched
  sessionID are dropped (`onEvent: { reason: 'session-mismatch' }`).
- **Sequence ordering.** Outbound frames carry monotonic `seq`.
  Inbound frames with `seq < expectedSeq` are deduped silently; any
  larger gap is currently accepted (no out-of-order buffering).
- **Idle timeout.** Optional `idleTimeoutMs` tears down the transport
  after inactivity; the lifecycle layer sends a best-effort
  `session-end` frame to signal the peer.
- **Reconnect timeout.** Optional `reconnectTimeoutMs` paired with
  `hub.events` tears down if a `disconnected` / `reconnecting` event
  is not followed by `connected` within the budget.
- **Graceful end.** `session-end` frame from peer triggers
  `onSessionEnd?.()` and a clean readable close; from local side
  any teardown path emits one best-effort `session-end` outbound.
- **Backpressure.** Inbound queue size is capped (`inboxCapacity`,
  default 1024). Overflow tears down with `BackpressureError`.

## Observability

`onEvent?: ObservabilityEventListener` receives `frame-dropped`
events with `reason` ∈ `{ sender-mismatch, session-mismatch, dedup }`.
Future event types are added without breaking existing listeners
(open enum).

## Errors

- `BackpressureError` — inbox overflow.
- `DecryptError` / `EncryptError` — `Encryptor` failure surfaces.
- `EnvelopeDecodeError` — malformed `TunnelEnvelope`.
- `FrameDecodeError` — malformed `HubFrame` or schema validation
  failure.
- `HubReconnectingError` — reconnect timeout exceeded.
- `SessionNotEstablishedError` — write attempted before sessionID
  locked.
```

- [ ] **Step 2: Commit**

```bash
git add docs/agents/hub-tunnel.md
git commit -m "docs(hub-tunnel): add architecture/wire-format reference"
```

---

## Task 13: Update `docs/agents/architecture.md`

**Files:**
- Modify: `docs/agents/architecture.md`

- [ ] **Step 1: Inspect current sections**

```bash
grep -n '^## \|^### \|^#### ' docs/agents/architecture.md
```

Expected: existing `#### Hub & Group Communication` subsection under `### Key Packages`.

- [ ] **Step 2: Add `@enkaku/hub-tunnel` entry**

In `docs/agents/architecture.md` under `#### Hub & Group Communication`, add a bullet matching the existing format used by sibling packages (e.g. `@enkaku/hub-protocol`, `@enkaku/hub-client`, `@enkaku/hub-server`). Example bullet:

```markdown
- **`@enkaku/hub-tunnel`** — peer-to-peer transport tunneling Enkaku
  messages through a hub relay with pluggable end-to-end encryption.
  See [hub-tunnel.md](./hub-tunnel.md).
```

- [ ] **Step 3: Add a short subsection under `## RPC Framework Patterns`**

Below the existing `### Transport Layer` subsection, add:

```markdown
### Hub-tunneled Transport

When direct connectivity isn't possible (NAT, mobile, BYO relay),
`@enkaku/hub-tunnel` provides a peer-to-peer transport that runs over
a `HubLike` relay with end-to-end encryption supplied by the caller.
See [hub-tunnel.md](./hub-tunnel.md) for wire format and session
lifecycle details.
```

- [ ] **Step 4: Commit**

```bash
git add docs/agents/architecture.md
git commit -m "docs(architecture): document hub-tunnel transport"
```

---

## Task 14: Move spec/plan to completed and run full repo verification

**Files:**
- Move: `docs/superpowers/specs/2026-05-02-port-hub-tunnel-from-kubun-design.md` → keep in place (not moved; remains as historical spec)
- Modify (optional): `docs/superpowers/plans/2026-05-02-port-hub-tunnel-from-kubun.md` (this file) — leave in `plans/`; an optional follow-up moves to `plans/completed/` if that convention is in use here

- [ ] **Step 1: Run repo-wide build**

```bash
pnpm run build
```

Expected: PASS. New `packages/hub-tunnel/lib/` populated.

- [ ] **Step 2: Run repo-wide tests**

```bash
pnpm run test
```

Expected: PASS — all packages including `@enkaku/hub-tunnel` and `@enkaku/integration-tests`.

- [ ] **Step 3: Lint**

```bash
pnpm run lint
```

Expected: PASS.

- [ ] **Step 4: Verify package surface**

```bash
node -e "import('@enkaku/hub-tunnel').then(m => console.log(Object.keys(m).sort().join('\n')))"
```

Expected: prints exports listed in `src/index.ts` (no `hubFrameKinds` or `HubFrameKind`).

- [ ] **Step 5: Commit any incidental fixes from steps 1–4**

```bash
# only if previous steps required edits
git add -A
git commit -m "chore(hub-tunnel): post-port verification fixes"
```

---

## Task 15: Publish to npm

This task happens after the PR merges. Solo step gated by maintainer.

- [ ] **Step 1: Verify version**

```bash
grep '"version"' packages/hub-tunnel/package.json
```

Expected: `"version": "0.14.0"`.

- [ ] **Step 2: Publish**

```bash
pnpm --filter @enkaku/hub-tunnel publish --access public
```

Expected: package published; `npm view @enkaku/hub-tunnel@0.14.0` resolves.

- [ ] **Step 3: Post-publish handoff**

Update the merging PR description (or open a tracking issue in Kubun repo) referencing the published version. Kubun side cutover is now unblocked.

---

## Self-review notes

- All 15 tasks contain inline code/test bodies — no `TBD` or `implement later` markers.
- Type-name consistency: `HubFrame`, `HubFrameMessageBody`, `Encryptor`, `HubLike` used identically across tasks.
- Frame schema `$id` rename (`urn:kubun:…` → `urn:enkaku:…`) is applied in Task 3 (envelope) and Task 4 (frame) and verified in Task 9 step 2.
- Test file count: 18 files in source, 18 ports/rewrites here (1 rewritten in Task 4, 14 ported in Task 9, 5 ported+rewritten in Task 10). Plus fixtures in Task 8 and integration test in Task 11.
- The `@internal` JSDoc concern on `createMessageSchema` is flagged in Task 4 step 5 with a fallback path.
- Internal package deps use `workspace:^` (per Enkaku monorepo convention), not `catalog:` (catalog is for external deps); plan deviates from spec section "`package.json`" intentionally — spec text under "Repo wiring" likewise needs no enkaku-side catalog entry; the Kubun-side catalog entry comes later in the Kubun PR.
