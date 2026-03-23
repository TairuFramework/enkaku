# ts-mls v2 Migration Design

## Summary

Migrate `@enkaku/group` from ts-mls `^1.6.2` to `^2.0.0`. Big-bang approach — all changes in a single branch. Breaking changes to `@enkaku/group`'s public API are acceptable (packages are unreleased). Align naming and patterns with ts-mls v2 conventions where relevant.

## Motivation

ts-mls v2 is in RC and introduces a cleaner API surface: single params objects instead of long positional argument lists, explicit authentication dependencies, and strongly-typed constants replacing string-literal enums. Migrating now avoids accumulating technical debt against an API that will be removed.

## Scope

**Direct changes:** `@enkaku/group` package only (sole ts-mls consumer).

| File | Change type |
|------|-------------|
| `packages/group/src/authentication.ts` | New — `AuthenticationService` implementation |
| `packages/group/src/group.ts` | Major — all ts-mls call sites |
| `packages/group/src/crypto.ts` | Minor — adapt to v2 `CryptoProvider`/`CiphersuiteImpl` interface |
| `packages/group/src/credential.ts` | Minor — reused by `AuthenticationService` (no direct ts-mls imports) |
| `packages/group/src/types.ts` | Minor — type import updates, extension type tightening |
| `packages/group/test/ts-mls-spike.test.ts` | Major — all direct ts-mls calls |
| `packages/group/test/crypto.test.ts` | Major — all direct ts-mls calls |
| `packages/group/test/group.test.ts` | Minor — only if public API fields change |
| `pnpm-workspace.yaml` | Dependency bump |

**Unaffected:** `@enkaku/hub-server`, `@enkaku/hub-client`, `tests/e2e-expo` — these consume `@enkaku/group`'s API, not ts-mls directly. The e2e-expo component may need updating if `@enkaku/group` public API fields are renamed.

## Design

### 1. AuthenticationService (`authentication.ts`)

New file implementing ts-mls v2's `AuthenticationService` interface. Performs signature-only validation at the MLS layer:

- Extracts the DID string from the MLS basic credential's `identity` bytes using the existing `mlsIdentityToSerializedCredential` from `credential.ts` (avoids duplicating parsing logic)
- Derives the expected Ed25519 public key from the DID (using `@enkaku/token`)
- Compares against the signing public key presented in the MLS leaf node

Capability-chain validation remains a separate concern, already handled in `processWelcome` via `validateGroupCapability`. This separation is secure because:
- The capability layer prevents unauthorized joins (checked before MLS operations)
- The MLS auth layer prevents DID impersonation within the group (checked during MLS operations)
- Both checks are enforced; an attacker would need to bypass both

Dependencies: `@enkaku/token` (DID-to-key resolution), `@noble/curves/ed25519` (already in use), `credential.ts` (existing DID extraction).

Usage: Created internally by `resolveCiphersuite` — callers of `createGroup`, `processWelcome`, etc. don't provide it. Tests use `unsafeTestingAuthenticationService` from ts-mls.

### 2. Core API Migration (`group.ts`)

#### `resolveCiphersuite` changes

Remove the two-step `getCiphersuiteFromName` + `getCiphersuiteImpl(cs, provider)` pattern. In v2, `getCiphersuiteImpl` takes a `CiphersuiteName` string directly.

Return both the `CiphersuiteImpl` and a fully-formed `MlsContext` (containing `cipherSuite` and `authService`) since every v2 call needs this pair.

**`GroupHandle` stores `MlsContext`:** Instead of storing just `CiphersuiteImpl`, `GroupHandle` should store the full `MlsContext` so it doesn't need to be reconstructed for every encrypt/decrypt/commit operation. The `ciphersuite` field becomes `context: MlsContext`.

#### Function-by-function transforms

**`createGroup`:**
```typescript
// v1
mlsCreateGroup(groupId, keyPackage.publicPackage, keyPackage.privatePackage, [], impl)
// v2
mlsCreateGroup({ context, groupId, keyPackage: kp.publicPackage, privateKeyPackage: kp.privatePackage, extensions: [] })
```

**`generateKeyPackageWithKey`:**
```typescript
// v1
generateKeyPackageWithKey(credential, defaultCapabilities(), defaultLifetime, [], keys, impl)
// v2
generateKeyPackageWithKey({ credential, keys, cipherSuite })
// capabilities, lifetime, extensions default automatically in v2
```

**`createApplicationMessage` (in `GroupHandle.encrypt`):**
```typescript
// v1
const { newState, privateMessage, consumed } = await createApplicationMessage(state, plaintext, cipherSuite)
// v2 — return field renamed: privateMessage → message
const { newState, message } = await createApplicationMessage({ context, state, message: plaintext })
```
Note: The `consumed` field may also be renamed or removed — verify during implementation.

**`processPrivateMessage` (in `GroupHandle.decrypt`/`processMessage`):**
```typescript
// v1
processPrivateMessage(state, privateMessage, emptyPskIndex, cipherSuite)
// v2 — externalPsks replaces emptyPskIndex, passed via context
processPrivateMessage({ context, state, privateMessage })
```

**`createCommit` (in `commitInvite`/`removeMember`):**
```typescript
// v1
createCommit({ state, cipherSuite }, { extraProposals: [...] })
// v2
createCommit({ context, state, extraProposals: [...] })
```
Welcome is now wrapped as `MlsWelcomeMessage`. When passing to `joinGroup`, unwrap via `result.welcome!.welcome`. The `commitInvite` function should return the unwrapped welcome (inner payload) since consumers pass it to `processWelcome` which passes it to `joinGroup`.

**`joinGroup` (in `processWelcome`):**
```typescript
// v1
mlsJoinGroup(welcome, publicPackage, privatePackage, emptyPskIndex, impl, ratchetTree)
// v2 — externalPsks replaces emptyPskIndex, passed via context
mlsJoinGroup({ context, welcome, keyPackage: publicPackage, privateKeys: privatePackage, ratchetTree })
```

#### `MlsContext` and `externalPsks`

The v2 migration guide consistently shows `externalPsks` in the context for `joinGroup`, `processPrivateMessage`, `createApplicationMessage`, and `processPublicMessage`. Since Enkaku does not currently use external PSKs, the context will pass `externalPsks` as an empty map or omit it if optional. Verify during implementation whether `externalPsks` is required or optional in the `MlsContext` type.

#### `processMessage` / `processPublicMessage`

These functions also migrate to params objects in v2 but are **not used** in the Enkaku codebase. They are intentionally excluded from this migration scope.

#### Literal enum replacements

| v1 | v2 |
|----|-----|
| `proposalType: 'add'` | `proposalType: defaultProposalTypes.add` |
| `proposalType: 'remove'` | `proposalType: defaultProposalTypes.remove` |
| `credentialType: 'basic'` | `credentialType: defaultCredentialTypes.basic` |

#### Import changes

**Add:** `MlsContext`, `defaultProposalTypes`, `defaultCredentialTypes`, `unsafeTestingAuthenticationService` (tests only), `DefaultProposal` (replaces `Proposal`).

**Remove:** `getCiphersuiteFromName`, `emptyPskIndex`, `Proposal` (replaced by `DefaultProposal`).

**Update:** `defaultLifetime` usage — call as `defaultLifetime()` (now a function).

#### Extension type tightening

v2 splits the generic `Extension` type into `CustomExtension`, `GroupContextExtension`, `GroupInfoExtension`, and `LeafNodeExtension`. The `GroupOptions.extensions` type in `types.ts` (currently `Array<unknown>`) should be tightened to `Array<GroupContextExtension>` since `createGroup` passes extensions as group context extensions.

#### String-literal node types

Check whether `nodeType === 'leaf'` (used in `GroupHandle.memberCount` and test helpers) is affected by the v2 string-literal-to-constant migration. If `nodeType` values became numeric, update comparisons accordingly.

### 3. CryptoProvider Adaptation (`crypto.ts`)

**Known change:** `CiphersuiteImpl.name` field type changes from `CiphersuiteName` (string) to `CiphersuiteId` (numeric). The `createNobleCryptoProvider` sets `name: cs.name` — needs updating to match v2's field name/type.

**Likely stable:** `Hash`, `Kdf`, `Signature`, `Hpke`, `Rng` interfaces are not documented as changed in the migration guide. The noble implementations should work as-is.

**Unknown:** The exact `CryptoProvider.getCiphersuiteImpl` method signature in v2 — since the top-level `getCiphersuiteImpl` now takes `CiphersuiteName` instead of `Ciphersuite`, the provider method may receive different input. Verify against v2 source during implementation and adapt accordingly.

**Type imports** (`CiphersuiteImpl`, `CryptoProvider`, `Hash`, `Hpke`, `Kdf`, `Rng`, `Signature`) stay, possibly with renamed types.

### 4. Test Migration

**`ts-mls-spike.test.ts`** — Heaviest changes. All ts-mls function calls migrate to params objects. Additional changes:
- `getCiphersuiteImpl(cs, provider)` → `getCiphersuiteImpl(CIPHERSUITE_NAME)` (no more `getCiphersuiteFromName` step)
- `encodeMlsMessage`/`decodeMlsMessage` → `encode(mlsMessageEncoder, ...)`/`decode(mlsMessageDecoder, ...)` — note: `decodeMlsMessage` currently takes a byte offset (`0`) as second arg; verify if `decode()` handles this differently
- Wireformat strings → constants (`wireformats.mls_welcome`, `protocolVersions.mls10`)
- `defaultLifetime` → `defaultLifetime()`
- All proposal/credential literals → constant references
- `emptyPskIndex` removed (PSKs via context)
- Welcome unwrapping: `commitResult.welcome` → `commitResult.welcome!.welcome` when passing to `joinGroup`
- `unsafeTestingAuthenticationService` in all `MlsContext` objects
- `Welcome` type import may change to `MlsWelcomeMessage` — verify against v2 types
- This test imports `nobleCryptoProvider` from `ts-mls` (not from `@enkaku/group`). If v2 still exports it, keep as-is; otherwise switch to the Enkaku provider. Note: with v2's `getCiphersuiteImpl(name)` signature (no provider arg), this test may not need an explicit provider at all.

**`crypto.test.ts`** — Same call-site transforms as above. Uses `nobleCryptoProvider` from `../src/crypto.js` (Enkaku's custom provider). Primitive tests (HPKE, AEAD, KDF, signature, hash) test the `CiphersuiteImpl` object directly and should be unaffected.

**`group.test.ts`** — Tests `@enkaku/group` public API. Only changes if public API field names are renamed for alignment (e.g. `welcomeMessage` in `CommitInviteResult`).

**`e2e-expo`** — No direct ts-mls imports. Only changes if `@enkaku/group` public API changes.

### 5. Dependency Changes

- `pnpm-workspace.yaml`: `ts-mls: ^1.6.2` → `ts-mls: ^2.0.0` (or specific RC version)
- `pnpm-lock.yaml`: Regenerated by `pnpm install`
- No new packages needed

## Verification

1. `pnpm install` — resolve v2 dependency
2. `pnpm run build` — catch type errors from v2 API changes
3. `pnpm run test` — validate all behavior (type checks + unit tests)
4. Manual check of `tests/e2e-expo` if `@enkaku/group` public API changed

## Risks

- **v2 RC instability**: ts-mls v2 is in RC, API may shift before stable release. Mitigation: pin to specific RC version, update when stable.
- **Undocumented CryptoProvider changes**: Migration guide doesn't fully document `CryptoProvider` interface changes. Mitigation: verify against v2 source during implementation; adapt `crypto.ts` as needed.
- **`CiphersuiteImpl` field changes**: The `name` → `CiphersuiteId` change may affect the noble provider's returned object shape. Mitigation: TypeScript compiler will catch mismatches immediately.
