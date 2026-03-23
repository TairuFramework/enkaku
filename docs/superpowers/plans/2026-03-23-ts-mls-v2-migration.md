# ts-mls v2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `@enkaku/group` from ts-mls `^1.6.2` to `^2.0.0`, implementing a proper `AuthenticationService` and aligning APIs with v2 conventions.

**Architecture:** Big-bang migration of the sole ts-mls consumer (`@enkaku/group`). All ts-mls call sites switch from positional args to params objects. A new `AuthenticationService` validates DID-based credentials at the MLS layer. `GroupHandle` stores `MlsContext` instead of bare `CiphersuiteImpl`.

**Tech Stack:** TypeScript, ts-mls v2, `@noble/curves`, `@enkaku/token`, Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-ts-mls-v2-migration-design.md`

**Stage:** planning

---

### Task 1: Bump ts-mls and investigate v2 API

**Files:**
- Modify: `pnpm-workspace.yaml:32`

Several spec items are marked "verify during implementation" (CryptoProvider interface, externalPsks optionality, nodeType string literals, createApplicationMessage return shape). This task resolves those unknowns before writing code.

- [ ] **Step 1: Update pnpm catalog**

In `pnpm-workspace.yaml`, change:
```
ts-mls: ^1.6.2
```
to:
```
ts-mls: ^2.0.0
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: Resolves ts-mls v2. Note the exact version installed.

- [ ] **Step 3: Investigate v2 types**

Read the installed ts-mls v2 type definitions to resolve spec unknowns:

1. **`AuthenticationService` interface** — find the exact type definition, understand what methods it requires
2. **`MlsContext` type** — check if `externalPsks` is required or optional
3. **`CryptoProvider` interface** — check if the method signature changed (what input does `getCiphersuiteImpl` receive?)
4. **`CiphersuiteImpl` type** — check if `name` became `id` and what type it is
5. **`createApplicationMessage` return type** — confirm `privateMessage` → `message` rename, check `consumed` field
6. **`createCommit` return type** — confirm welcome wrapping shape (`MlsWelcomeMessage`)
7. **`nodeType` values** — check if `'leaf'` is still a string or became numeric
8. **`Proposal` type** — confirm rename to `DefaultProposal`, check exact shape
9. **`generateKeyPackageWithKey` params** — confirm the params object field names
10. **`decode` function** — check if it handles byte offset differently than `decodeMlsMessage`

Record findings as comments at the top of a scratch file or document inline with subsequent tasks. These findings drive all remaining tasks.

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: bump ts-mls to v2"
```

---

### Task 2: Adapt CryptoProvider (`crypto.ts`)

**Files:**
- Modify: `packages/group/src/crypto.ts:16,465-493`

Depends on Task 1 findings about the `CryptoProvider` and `CiphersuiteImpl` interfaces.

**Important:** If Task 1 reveals that v2 removes the `CryptoProvider` interface entirely or changes `getCiphersuiteImpl` to no longer accept a provider, the entire custom noble crypto provider strategy needs rethinking. In that case, `crypto.ts` may need to be restructured (e.g., registering the noble provider differently, or ts-mls v2 may have built-in noble support). Consult v2 docs/source before proceeding.

- [ ] **Step 1: Update type imports**

Update the type import on line 16 to match v2 type names. The import is:
```typescript
import type { CiphersuiteImpl, CryptoProvider, Hash, Hpke, Kdf, Rng, Signature } from 'ts-mls'
```
Adjust based on Task 1 findings (e.g., if any types were renamed).

- [ ] **Step 2: Update `CiphersuiteInput` type**

The internal `CiphersuiteInput` type (line 465-470) mirrors what ts-mls passes to the provider's `getCiphersuiteImpl` method:
```typescript
type CiphersuiteInput = {
  hash: string
  hpke: HpkeAlg
  signature: string
  name: string
}
```
Update field names/types based on Task 1 findings (e.g., `name` → `id` with numeric type).

- [ ] **Step 3: Update returned `CiphersuiteImpl` object**

In `createNobleCryptoProvider` (line 482-492), the returned object sets `name: cs.name`. Update to match v2's `CiphersuiteImpl` shape:
```typescript
return {
  hash: makeHash(cs.hash),
  kdf: makeKdf(cs.hpke.kdf),
  signature: makeSignature(cs.signature),
  hpke: makeHpke(cs.hpke),
  rng,
  // Update this field based on v2 CiphersuiteImpl type
  name: cs.name,
} as CiphersuiteImpl
```

- [ ] **Step 4: Run type check**

Run: `cd packages/group && pnpm run test:types`
Expected: May fail due to other files not yet migrated, but `crypto.ts` errors should be resolved.

- [ ] **Step 5: Commit**

```bash
git add packages/group/src/crypto.ts
git commit -m "refactor(group): adapt CryptoProvider to ts-mls v2 interface"
```

---

### Task 3: Create AuthenticationService (`authentication.ts`)

**Files:**
- Create: `packages/group/src/authentication.ts`
- Modify: `packages/group/src/index.ts` (add export)

Depends on Task 1 findings about the `AuthenticationService` interface.

- [ ] **Step 1: Write test for the authentication service**

Create `packages/group/test/authentication.test.ts`:
```typescript
import { randomIdentity } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import { createDIDAuthenticationService } from '../src/authentication.js'

describe('DID AuthenticationService', () => {
  test('validates a credential with matching DID and public key', async () => {
    const identity = randomIdentity()
    const authService = createDIDAuthenticationService()

    // The auth service should accept a credential whose identity bytes
    // encode a DID that matches the presented public key
    // Exact test depends on AuthenticationService interface from Task 1
  })

  test('rejects a credential with mismatched public key', async () => {
    const identity = randomIdentity()
    const otherIdentity = randomIdentity()
    const authService = createDIDAuthenticationService()

    // Should reject when public key doesn't match the DID
  })
})
```

Flesh out exact test assertions after Task 1 reveals the `AuthenticationService` interface shape.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/group && pnpm run test:unit -- --run authentication`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the authentication service**

Create `packages/group/src/authentication.ts`:
```typescript
import type { AuthenticationService } from 'ts-mls'

import { mlsIdentityToSerializedCredential } from './credential.js'

// Implementation depends on AuthenticationService interface from Task 1.
// Core logic:
// 1. Extract DID from credential identity bytes via mlsIdentityToSerializedCredential
// 2. Derive expected Ed25519 public key from DID (did:key:z... → raw bytes)
// 3. Compare against the signing public key from the leaf node
// 4. Return true/false (or throw, depending on interface)

export function createDIDAuthenticationService(): AuthenticationService {
  // Implement based on Task 1 findings
}
```

- [ ] **Step 4: Add export to index.ts**

Add to `packages/group/src/index.ts`:
```typescript
export { createDIDAuthenticationService } from './authentication.js'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/group && pnpm run test:unit -- --run authentication`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/group/src/authentication.ts packages/group/test/authentication.test.ts packages/group/src/index.ts
git commit -m "feat(group): add DID-based AuthenticationService for ts-mls v2"
```

---

### Task 4: Update types (`types.ts`)

**Files:**
- Modify: `packages/group/src/types.ts:1,11`

- [ ] **Step 1: Update type imports and extension type**

In `packages/group/src/types.ts`:

Line 1 — update ts-mls type imports if any were renamed (e.g., `KeyPackage`, `PrivateKeyPackage`).

Line 6 — if v2's `getCiphersuiteImpl` no longer accepts a `CryptoProvider`, remove the `cryptoProvider` field from `GroupOptions`:
```typescript
// Before
cryptoProvider?: CryptoProvider
// After — remove if CryptoProvider is no longer used
```
If v2 still supports custom providers, keep it.

Line 11 — tighten extensions type:
```typescript
// Before
extensions?: Array<unknown>
// After (import GroupContextExtension from ts-mls)
extensions?: Array<GroupContextExtension>
```

Note: `credential.ts` has no direct ts-mls imports and needs no changes. The `AuthenticationService` reuses `mlsIdentityToSerializedCredential` from it.

- [ ] **Step 2: Commit**

```bash
git add packages/group/src/types.ts
git commit -m "refactor(group): tighten extension types for ts-mls v2"
```

---

### Task 5: Migrate `group.ts` — imports, types, and `resolveCiphersuite`

**Files:**
- Modify: `packages/group/src/group.ts:1-40,57-108`

This is the first of three sub-tasks for `group.ts`. It updates the foundation that all functions depend on.

- [ ] **Step 1: Update imports**

Replace the ts-mls import block (lines 4-22):
```typescript
import {
  type CiphersuiteImpl,
  type CiphersuiteName,
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  generateKeyPackageWithKey,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  type KeyPackage,
  createGroup as mlsCreateGroup,
  joinGroup as mlsJoinGroup,
  type Proposal,
  processPrivateMessage,
} from 'ts-mls'
```

With v2 imports (adjust based on Task 1 findings):
```typescript
import {
  type AuthenticationService,
  type CiphersuiteImpl,
  type CiphersuiteName,
  type ClientState,
  type Credential,
  type MlsContext,
  createApplicationMessage,
  createCommit,
  defaultCredentialTypes,
  defaultProposalTypes,
  type DefaultProposal,
  generateKeyPackageWithKey,
  getCiphersuiteImpl,
  type KeyPackage,
  createGroup as mlsCreateGroup,
  joinGroup as mlsJoinGroup,
  processPrivateMessage,
} from 'ts-mls'
```

Key changes: remove `getCiphersuiteFromName`, `emptyPskIndex`, `defaultCapabilities`, `defaultLifetime`, `Proposal`. Add `MlsContext`, `AuthenticationService`, `defaultProposalTypes`, `defaultCredentialTypes`, `DefaultProposal`.

Add import for the auth service:
```typescript
import { createDIDAuthenticationService } from './authentication.js'
```

- [ ] **Step 2: Update `resolveCiphersuite`**

Replace the function (lines 35-40):
```typescript
// Before
async function resolveCiphersuite(options?: GroupOptions): Promise<CiphersuiteImpl> {
  const name = (options?.ciphersuiteName ?? DEFAULT_CIPHERSUITE) as CiphersuiteName
  const provider = options?.cryptoProvider ?? nobleCryptoProvider
  const cs = getCiphersuiteFromName(name)
  return await getCiphersuiteImpl(cs, provider)
}
```

With:
```typescript
type ResolvedCiphersuite = {
  cipherSuite: CiphersuiteImpl
  context: MlsContext
}

async function resolveCiphersuite(options?: GroupOptions): Promise<ResolvedCiphersuite> {
  const name = (options?.ciphersuiteName ?? DEFAULT_CIPHERSUITE) as CiphersuiteName
  const cipherSuite = await getCiphersuiteImpl(name)
  const authService = createDIDAuthenticationService()
  const context: MlsContext = { cipherSuite, authService }
  return { cipherSuite, context }
}
```

Note: if `getCiphersuiteImpl` in v2 still accepts an optional provider, pass `options?.cryptoProvider ?? nobleCryptoProvider`. Adjust based on Task 1 findings.

- [ ] **Step 3: Update `makeMLSCredential`**

Replace string literal (line 52):
```typescript
// Before
credentialType: 'basic',
// After
credentialType: defaultCredentialTypes.basic,
```

- [ ] **Step 4: Update `GroupHandleParams` and `GroupHandle`**

Replace `ciphersuite: CiphersuiteImpl` with `context: MlsContext` in:
- `GroupHandleParams` type (line 60)
- `GroupHandle` class — `#ciphersuite` field → `#context`, constructor, getter

Update `GroupHandle.encrypt` (lines 113-121):
```typescript
async encrypt(plaintext: Uint8Array): Promise<{ message: unknown; consumed: Array<Uint8Array> }> {
  const { newState, message } = await createApplicationMessage({
    context: this.#context,
    state: this.#state,
    message: plaintext,
  })
  this.#state = newState
  return { message }
}
```
Note: the v1 `encrypt` returned `{ message, consumed }`. The v2 `createApplicationMessage` return type may rename or remove `consumed`. Adjust the `encrypt` return type and fields based on Task 1 findings. If `consumed` is still returned by v2, pass it through rather than dropping it.

Update `GroupHandle.decrypt` (lines 126-140):
```typescript
async decrypt(privateMessage: unknown): Promise<Uint8Array> {
  const result = await processPrivateMessage({
    context: this.#context,
    state: this.#state,
    privateMessage: privateMessage as Parameters<typeof processPrivateMessage>[0]['privateMessage'],
  })
  if (result.kind === 'applicationMessage') {
    this.#state = result.newState
    return result.message
  }
  this.#state = result.newState
  throw new Error('Expected application message but received handshake message')
}
```

Update `GroupHandle.processMessage` (lines 145-157) similarly.

Update `GroupHandle.memberCount` (line 106) — check if `nodeType === 'leaf'` needs updating based on Task 1 findings.

- [ ] **Step 5: Commit**

```bash
git add packages/group/src/group.ts
git commit -m "refactor(group): update imports, resolveCiphersuite, and GroupHandle for ts-mls v2"
```

---

### Task 6: Migrate `group.ts` — lifecycle functions

**Files:**
- Modify: `packages/group/src/group.ts:164-415`

Migrates `createGroup`, `commitInvite`, `processWelcome`, `removeMember`, `createKeyPackageBundle`.

- [ ] **Step 1: Migrate `createGroup` function (lines 172-218)**

Update `generateKeyPackageWithKey` call (lines 182-189):
```typescript
// Before
generateKeyPackageWithKey(mlsCredential, defaultCapabilities(), defaultLifetime, [], keys, impl)
// After
generateKeyPackageWithKey({ credential: mlsCredential, keys, cipherSuite })
```

Update `mlsCreateGroup` call (lines 193-199):
```typescript
// Before
mlsCreateGroup(new TextEncoder().encode(groupID), keyPackage.publicPackage, keyPackage.privatePackage, [], impl)
// After
mlsCreateGroup({
  context,
  groupId: new TextEncoder().encode(groupID),
  keyPackage: keyPackage.publicPackage,
  privateKeyPackage: keyPackage.privatePackage,
  extensions: [],
})
```

Update `GroupHandle` construction to pass `context` instead of `ciphersuite: impl`.

Use destructured `{ cipherSuite, context }` from `resolveCiphersuite(options)`.

- [ ] **Step 2: Migrate `commitInvite` function (lines 267-293)**

Update proposal literal:
```typescript
// Before
const addProposal: Proposal = { proposalType: 'add', add: { keyPackage } }
// After
const addProposal: DefaultProposal = { proposalType: defaultProposalTypes.add, add: { keyPackage } }
```

Update `createCommit` call:
```typescript
// Before
createCommit({ state: group.state, cipherSuite: group.ciphersuite }, { extraProposals: [addProposal] })
// After
createCommit({ context: group.context, state: group.state, extraProposals: [addProposal] })
```

Update welcome in return — unwrap inside `commitInvite`: `welcomeMessage: result.welcome!.welcome`. This means `CommitInviteResult.welcomeMessage` continues to hold the inner welcome payload (not the wrapper), so `processWelcome` and `group.test.ts` receive the same shape they expect.

- [ ] **Step 3: Migrate `processWelcome` function (lines 312-356)**

Update `mlsJoinGroup` call:
```typescript
// Before
mlsJoinGroup(welcome, keyPackageBundle.publicPackage, keyPackageBundle.privatePackage, emptyPskIndex, impl, ratchetTree)
// After
mlsJoinGroup({
  context,
  welcome: welcome as Parameters<typeof mlsJoinGroup>[0]['welcome'],
  keyPackage: keyPackageBundle.publicPackage as Parameters<typeof mlsJoinGroup>[0]['keyPackage'],
  privateKeys: keyPackageBundle.privatePackage as Parameters<typeof mlsJoinGroup>[0]['privateKeys'],
  ratchetTree: ratchetTree as Parameters<typeof mlsJoinGroup>[0]['ratchetTree'],
})
```

Update `GroupHandle` construction to pass `context`.

- [ ] **Step 4: Migrate `removeMember` function (lines 366-388)**

Update proposal literal:
```typescript
// Before
const removeProposal: Proposal = { proposalType: 'remove', remove: { removed: leafIndex } }
// After
const removeProposal: DefaultProposal = { proposalType: defaultProposalTypes.remove, remove: { removed: leafIndex } }
```

Update `createCommit` call (same pattern as `commitInvite`).

- [ ] **Step 5: Migrate `createKeyPackageBundle` function (lines 393-415)**

Update `generateKeyPackageWithKey` call:
```typescript
// Before
generateKeyPackageWithKey(mlsCredential, defaultCapabilities(), defaultLifetime, [], keys, impl)
// After
generateKeyPackageWithKey({ credential: mlsCredential, keys, cipherSuite })
```

- [ ] **Step 6: Run type check**

Run: `cd packages/group && pnpm run test:types`
Expected: PASS (or remaining errors only in test files)

- [ ] **Step 7: Commit**

```bash
git add packages/group/src/group.ts
git commit -m "refactor(group): migrate lifecycle functions to ts-mls v2 params objects"
```

---

### Task 7: Migrate `ts-mls-spike.test.ts`

**Files:**
- Modify: `packages/group/test/ts-mls-spike.test.ts`

- [ ] **Step 1: Update imports**

Replace the import block (lines 2-22) with v2 imports:
```typescript
import type { MlsWelcomeMessage } from 'ts-mls'
import {
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  createGroup,
  decode,
  defaultCredentialTypes,
  defaultProposalTypes,
  type DefaultProposal,
  defaultLifetime,
  encode,
  generateKeyPackage,
  generateKeyPackageWithKey,
  getCiphersuiteImpl,
  joinGroup,
  mlsMessageDecoder,
  mlsMessageEncoder,
  processPrivateMessage,
  unsafeTestingAuthenticationService,
  wireformats,
} from 'ts-mls'
```

Key changes: remove `getCiphersuiteFromName`, `nobleCryptoProvider`, `emptyPskIndex`, `defaultCapabilities`, `encodeMlsMessage`, `decodeMlsMessage`, `Proposal`. Add `unsafeTestingAuthenticationService`, `defaultProposalTypes`, `defaultCredentialTypes`, `encode`, `decode`, `mlsMessageEncoder`, `mlsMessageDecoder`, `wireformats`.

Note: `defaultLifetime` is imported but only needed if any test explicitly passes a custom lifetime. Since v2's `generateKeyPackage` defaults lifetime automatically, most tests won't need it. Remove from imports if unused; if a test needs a custom lifetime, call as `defaultLifetime()` (now a function).

Note: if v2 no longer exports `nobleCryptoProvider`, it's fine — we use `getCiphersuiteImpl(name)` directly.

- [ ] **Step 2: Update helper functions**

Update `getCiphersuiteImpl` helper (lines 32-35):
```typescript
// Before
async function getCiphersuiteImpl() {
  const cs = getCiphersuiteFromName(CIPHERSUITE_NAME)
  return await getImpl(cs, nobleCryptoProvider)
}
// After — getCiphersuiteImpl takes CiphersuiteName directly in v2
async function getImpl() {
  return await getCiphersuiteImpl(CIPHERSUITE_NAME)
}
```

Add context helper:
```typescript
function makeContext(cipherSuite: CiphersuiteImpl): MlsContext {
  return { cipherSuite, authService: unsafeTestingAuthenticationService }
}
```

Update `requireWelcome` helper — the `Welcome` type may be renamed to `MlsWelcomeMessage` in v2. Update the parameter and return type annotation to match. Since `createCommit` now returns a wrapped welcome, `requireWelcome` may need to unwrap it (access `.welcome` on the wrapper) or the caller does.

Update `makeCredential`:
```typescript
credentialType: defaultCredentialTypes.basic,
```

- [ ] **Step 3: Migrate all test function calls**

For each test, update all ts-mls function calls to params objects. The two key package generators have different signatures:

**`generateKeyPackage` (no custom keys — used in most tests):**
```typescript
// v1
generateKeyPackage(cred, defaultCapabilities(), defaultLifetime, [], impl)
// v2
generateKeyPackage({ credential: cred, cipherSuite: impl })
```

**`generateKeyPackageWithKey` (custom Ed25519 keys — used in "Enkaku Ed25519 keys" test):**
```typescript
// v1
generateKeyPackageWithKey(cred, defaultCapabilities(), defaultLifetime, [], { signKey, publicKey }, impl)
// v2
generateKeyPackageWithKey({ credential: cred, keys: { signKey, publicKey }, cipherSuite: impl })
```

**Other function transforms:**
- `createGroup(id, pub, priv, exts, impl)` → `createGroup({ context, groupId: id, keyPackage: pub, privateKeyPackage: priv, extensions: exts })`
- `createCommit({ state, cipherSuite }, { extraProposals })` → `createCommit({ context, state, extraProposals })`
- `joinGroup(welcome, pub, priv, pskIndex, impl, tree)` → `joinGroup({ context, welcome: commitResult.welcome!.welcome, keyPackage: pub, privateKeys: priv, ratchetTree: tree })`
- `createApplicationMessage(state, data, impl)` → `createApplicationMessage({ context, state, message: data })` — return field renamed: `privateMessage` → `message`
- `processPrivateMessage(state, msg, pskIndex, impl)` → `processPrivateMessage({ context, state, privateMessage: msg })`
- Proposals: `proposalType: 'add'` → `proposalType: defaultProposalTypes.add`, same for `'remove'`

- [ ] **Step 4: Migrate encoding test**

Update the message encoding round-trip test (lines 290-348):
```typescript
// Before
const welcomeMsg = encodeMlsMessage({ welcome: ..., wireformat: 'mls_welcome', version: 'mls10' })
const decodeResult = decodeMlsMessage(welcomeMsg, 0)
// After
const welcomeMsg = encode(mlsMessageEncoder, { welcome: ..., wireformat: wireformats.mls_welcome, version: protocolVersions.mls10 })
const decoded = decode(mlsMessageDecoder, welcomeMsg)
```

Adjust based on Task 1 findings about `decode` offset handling and `protocolVersions` export.

- [ ] **Step 5: Run tests**

Run: `cd packages/group && pnpm run test:unit -- --run ts-mls-spike`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/group/test/ts-mls-spike.test.ts
git commit -m "test(group): migrate ts-mls-spike tests to v2 API"
```

---

### Task 8: Migrate `crypto.test.ts`

**Files:**
- Modify: `packages/group/test/crypto.test.ts`

- [ ] **Step 1: Update imports**

Replace the import block (lines 1-16) with v2 imports. Same pattern as Task 7 but this file imports `nobleCryptoProvider` from `../src/crypto.js` (Enkaku's provider).

Remove: `getCiphersuiteFromName`, `emptyPskIndex`, `defaultCapabilities`, `defaultLifetime`, `Proposal`.
Add: `unsafeTestingAuthenticationService`, `defaultProposalTypes`, `defaultCredentialTypes`, `DefaultProposal`.

- [ ] **Step 2: Update helper functions**

Update `getCiphersuiteImpl` helper to use v2 signature (same as Task 7 but with Enkaku's provider if still needed).

Update `makeCredential` — `credentialType: defaultCredentialTypes.basic`.

Add context helper with `unsafeTestingAuthenticationService`.

- [ ] **Step 3: Migrate MLS test function calls**

Same transforms as Task 7 Step 3 for the three MLS integration tests (create group, encrypt/decrypt, member removal). The primitive crypto tests (HPKE, AEAD, KDF, signature, hash — lines 218-351) should be unaffected.

**Special case — `createNobleCryptoProvider uses custom randomBytes` test (lines 336-350):**
This test verifies Enkaku's custom `CryptoProvider` works with ts-mls. It currently does:
```typescript
const cs = getCiphersuiteFromName(CIPHERSUITE_NAME)
const customImpl = await getImpl(cs, provider)
```
If v2's `getCiphersuiteImpl` no longer accepts a provider argument, this test needs a fundamentally different approach — not just a mechanical transform. The test may need to call `provider.getCiphersuiteImpl(cs)` directly to verify the custom provider, or the approach may need rethinking based on how v2 integrates custom providers.

- [ ] **Step 4: Run tests**

Run: `cd packages/group && pnpm run test:unit -- --run crypto`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/group/test/crypto.test.ts
git commit -m "test(group): migrate crypto tests to ts-mls v2 API"
```

---

### Task 9: Update `group.test.ts` and downstream consumers

**Files:**
- Modify: `packages/group/test/group.test.ts` (if public API changed)
- Modify: `tests/e2e-expo/components/GroupEncryption.tsx` (if public API changed)
- Modify: `packages/group/src/index.ts` (if exports changed)

- [ ] **Step 1: Check if `group.test.ts` needs changes**

If `GroupHandle` getter `ciphersuite` was renamed to `context`, or `CommitInviteResult.welcomeMessage` field changed, update test assertions. The tests use the `@enkaku/group` public API, not ts-mls directly, so changes should be minimal.

- [ ] **Step 2: Check `e2e-expo` for breakage**

Review `tests/e2e-expo/components/GroupEncryption.tsx`. It imports `nobleCryptoProvider` from `@enkaku/group` and passes it as `options.cryptoProvider`. If `cryptoProvider` was removed from `GroupOptions` (per Task 4), remove the `options` usage here. Also check if the `GroupHandle.ciphersuite` getter was renamed to `context`.

- [ ] **Step 3: Run group tests**

Run: `cd packages/group && pnpm run test:unit -- --run group`
Expected: PASS

- [ ] **Step 4: Commit (if changes were needed)**

```bash
git add packages/group/test/group.test.ts tests/e2e-expo/components/GroupEncryption.tsx
git commit -m "test(group): update public API tests for ts-mls v2 migration"
```

---

### Task 10: Full build, lint, and verification

**Files:** None (verification only)

- [ ] **Step 1: Type check the group package**

Run: `cd packages/group && pnpm run test:types`
Expected: PASS — no type errors

- [ ] **Step 2: Run all group tests**

Run: `cd packages/group && pnpm run test:unit`
Expected: PASS — all tests green

- [ ] **Step 3: Build all packages**

Run: `pnpm run build`
Expected: PASS — clean build. Downstream packages (`hub-server`, `hub-client`) should build fine since they consume `@enkaku/group`'s public API through `lib/` which gets regenerated.

- [ ] **Step 4: Run full test suite**

Run: `pnpm run test`
Expected: PASS — type checks + unit tests across all packages.

- [ ] **Step 5: Lint**

Run: `pnpm run lint`
Expected: PASS — Biome formats and lints cleanly.

- [ ] **Step 6: Final commit (if lint made changes)**

Stage only the files that lint modified (check `git diff --name-only`):
```bash
git add packages/group/ tests/e2e-expo/
git commit -m "style(group): lint fixes after ts-mls v2 migration"
```
