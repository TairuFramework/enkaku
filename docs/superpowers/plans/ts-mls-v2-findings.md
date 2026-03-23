# ts-mls v2.0.0-rc.10 API Investigation Findings

> Generated: 2026-03-23
> Version installed: `ts-mls@2.0.0-rc.10`
> Prerequisite for all subsequent migration tasks.

## Summary of Breaking Changes

The v2 API moves from **positional arguments** to **named parameter objects** for all major functions, introduces a required `AuthenticationService` via `MlsContext`, removes `emptyPskIndex` (PSKs are now optional on `MlsContext`), and changes all discriminant values (nodeType, proposalType, credentialType, wireformat) from **string literals to numeric constants**.

---

## Investigation Item 1: `AuthenticationService` interface

**NEW in v2** -- required member of `MlsContext`.

```ts
// authenticationService.d.ts
export interface AuthenticationService {
  validateCredential(credential: Credential, signaturePublicKey: Uint8Array): Promise<boolean>;
}

export const unsafeTestingAuthenticationService: AuthenticationService;
```

**Impact:** Every call that previously took `PskIndex` + `CiphersuiteImpl` as positional args now takes `MlsContext`, which bundles `{ cipherSuite, authService, externalPsks?, clientConfig? }`. We must create an `AuthenticationService` implementation in `authentication.ts`.

---

## Investigation Item 2: `MlsContext` type -- `externalPsks` optionality

```ts
// mlsContext.d.ts
export interface MlsContext {
  cipherSuite: CiphersuiteImpl;
  authService: AuthenticationService;
  externalPsks?: Record<string, Uint8Array>;  // OPTIONAL
  clientConfig?: ClientConfig;                  // OPTIONAL
}
```

**Finding:** `externalPsks` IS optional (marked `?`). This replaces the old `emptyPskIndex` pattern. When no PSKs are needed, simply omit the field.

---

## Investigation Item 3: `CryptoProvider` interface -- `getCiphersuiteImpl` signature

```ts
// crypto/provider.d.ts
export interface CryptoProvider {
  getCiphersuiteImpl(id: number): Promise<CiphersuiteImpl>;
}
```

**BREAKING CHANGE:** The parameter changed from a `Ciphersuite` object (`{ hash, hpke, signature, name }`) to a plain `number` (the ciphersuite ID). Our custom `createNobleCryptoProvider` currently receives the full object. It must be rewritten to accept a numeric `id` and derive the algorithm configuration from it.

**Also note:** The top-level `getCiphersuiteImpl` helper now takes `(cs: CiphersuiteName, provider?: CryptoProvider)` instead of `(cs: Ciphersuite, provider: CryptoProvider)`. It looks up the ciphersuite by name and calls `provider.getCiphersuiteImpl(id)`.

---

## Investigation Item 4: `CiphersuiteImpl` type -- `name` -> `id`

```ts
// crypto/ciphersuite.d.ts
export interface CiphersuiteImpl {
  hash: Hash;
  hpke: Hpke;
  signature: Signature;
  kdf: Kdf;
  rng: Rng;
  id: number;  // WAS `name: string` in v1
}
```

**BREAKING CHANGE:** `name: string` is now `id: number`. The `id` is a numeric ciphersuite identifier (e.g., `1` for `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`).

The `ciphersuites` const maps names to numeric IDs:
```ts
export const ciphersuites: {
  readonly MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519: 1;
  readonly MLS_128_DHKEMP256_AES128GCM_SHA256_P256: 2;
  readonly MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519: 3;
  // ... etc
};
```

A `Ciphersuite` type (algorithm descriptor) still exists but is different from `CiphersuiteImpl`:
```ts
export type Ciphersuite = {
  hash: HashAlgorithm;
  hpke: HpkeAlgorithm;
  signature: SignatureAlgorithm;
  id: number;
};
```

---

## Investigation Item 5: `createApplicationMessage` return type

```ts
// createMessage.d.ts
export interface CreateMessageResult {
  newState: ClientState;
  message: MlsFramedMessage;  // WAS `privateMessage` in v1
  consumed: Uint8Array[];
}

export function createApplicationMessage(params: {
  context: MlsContext;
  state: ClientState;
  message: Uint8Array;
  authenticatedData?: Uint8Array;
}): Promise<CreateMessageResult>;
```

**BREAKING CHANGES:**
1. Return field renamed: `privateMessage` -> `message` (now typed as `MlsFramedMessage`)
2. Signature changed from positional `(state, plaintext, cs)` to named `{ context, state, message, authenticatedData? }`
3. The `consumed` field exists and is `Uint8Array[]`
4. `MlsFramedMessage = MlsPrivateMessage | MlsPublicMessage` -- the returned message is already an `MlsMessage` wrapper (not a bare `PrivateMessage`)

---

## Investigation Item 6: `createCommit` return type -- welcome wrapping

```ts
// createCommit.d.ts
export interface CreateCommitResult {
  newState: ClientState;
  welcome: MlsWelcomeMessage | undefined;  // Wrapped in MlsWelcomeMessage
  commit: MlsFramedMessage;
  consumed: Uint8Array[];
}

// message.d.ts
export interface MlsWelcomeMessage {
  wireformat: typeof wireformats.mls_welcome;  // numeric: 3
  welcome: Welcome;
  version: ProtocolVersionValue;
}
```

**BREAKING CHANGE:** The `welcome` field is now `MlsWelcomeMessage | undefined` (was bare `Welcome | undefined`). To get the inner `Welcome` for `joinGroup`, access `.welcome` on the wrapper. The `commit` field is `MlsFramedMessage` (was likely just the commit content).

Signature changed from positional `(groupContext, options)` to named:
```ts
export function createCommit(params: {
  context: MlsContext;
  state: ClientState;
  // ...CreateCommitOptions fields
}): Promise<CreateCommitResult>;
```

(CreateCommitParams extends CreateCommitOptions with `context` and `state`.)

---

## Investigation Item 7: `nodeType` values -- string vs numeric

```ts
// nodeType.d.ts
export const nodeTypes: {
  readonly leaf: 1;    // WAS string 'leaf' in v1
  readonly parent: 2;  // WAS string 'parent' in v1
};
```

**BREAKING CHANGE:** `nodeType` on tree nodes is now numeric (`1` for leaf, `2` for parent), not string literals. All comparisons like `node.nodeType === 'leaf'` must change to `node.nodeType === nodeTypes.leaf` (or `=== 1`).

The same pattern applies to ALL discriminants:
- `credentialType`: `'basic'` -> `defaultCredentialTypes.basic` (= `1`)
- `proposalType`: `'add'` -> `defaultProposalTypes.add` (= `1`)
- `wireformat`: strings -> numeric values from `wireformats` const

---

## Investigation Item 8: `Proposal` type -- rename to `DefaultProposal`

```ts
// proposal.d.ts
export type DefaultProposal = ProposalAdd | ProposalUpdate | ProposalRemove
  | ProposalPSK | ProposalReinit | ProposalExternalInit
  | ProposalGroupContextExtensions;

export type Proposal = DefaultProposal | ProposalCustom;

export function isDefaultProposal(p: Proposal): p is DefaultProposal;
```

Individual proposal types now use numeric `proposalType` discriminants:
```ts
export interface ProposalAdd {
  proposalType: typeof defaultProposalTypes.add;  // = 1
  add: Add;
}
// etc.
```

**Impact:** Creating an add proposal changes from:
```ts
// v1
{ proposalType: 'add', add: { keyPackage } }
// v2
{ proposalType: defaultProposalTypes.add, add: { keyPackage } }
```

---

## Investigation Item 9: `generateKeyPackageWithKey` params

```ts
// keyPackage.d.ts
export interface GenerateKeyPackageWithKeyParams {
  credential: Credential;
  capabilities?: Capabilities;
  lifetime?: Lifetime;
  extensions?: CustomExtension[];
  signatureKeyPair: { signKey: Uint8Array; publicKey: Uint8Array };
  cipherSuite: CiphersuiteImpl;
  leafNodeExtensions?: LeafNodeExtension[];
}

export function generateKeyPackageWithKey(
  params: GenerateKeyPackageWithKeyParams
): Promise<{ publicPackage: KeyPackage; privatePackage: PrivateKeyPackage }>;
```

**BREAKING CHANGE:** Changed from positional args `(credential, capabilities, lifetime, extensions, keys, cipherSuite)` to a named params object. Field names confirmed:
- `credential` (was 1st arg)
- `capabilities` (was 2nd arg, now optional)
- `lifetime` (was 3rd arg, now optional)
- `extensions` (was 4th arg, now optional)
- `signatureKeyPair` (was 5th arg `keys`)
- `cipherSuite` (was 6th arg)

---

## Investigation Item 10: `decode` function

```ts
// codec/tlsDecoder.d.ts
export type Decoder<T> = (b: Uint8Array, offset: number) => [T, number] | undefined;
export function decode<T>(dec: Decoder<T>, t: Uint8Array, maxInputSize?: number): T | undefined;
```

**Finding:** The `decode` function signature is `decode(decoder, bytes, maxInputSize?)`. The `Decoder<T>` type takes `(bytes, offset)` and returns `[value, newOffset] | undefined`. There is no separate `decodeMlsMessage` -- use `decode(mlsMessageDecoder, bytes)` instead. The offset handling is internal to the decoder functions.

---

## Additional Breaking Changes Discovered

### Function signature changes (positional -> named params)

All major lifecycle functions now take a single params object:

| Function | v1 signature | v2 signature |
|----------|-------------|-------------|
| `createGroup` | `(groupId, keyPackage, privateKeyPackage, extensions, cipherSuite)` | `(params: CreateGroupParams)` where params = `{ context, groupId, keyPackage, privateKeyPackage, extensions? }` |
| `joinGroup` | `(welcome, keyPackage, privateKeys, pskIndex, cipherSuite, ratchetTree?)` | `(params: { context, welcome, keyPackage, privateKeys, ratchetTree? })` |
| `processPrivateMessage` | `(state, privateMessage, pskIndex, cipherSuite)` | `(params: { context, state, privateMessage, callback? })` |
| `createCommit` | `(groupContext, options)` | `(params: CreateCommitParams)` where params = `{ context, state, ...options }` |

### `emptyPskIndex` removed

No longer exported. PSKs are now handled via `MlsContext.externalPsks` (optional field).

### `defaultLifetime` is now a function

`defaultLifetime` is `defaultLifetime()` -- a function call, not a constant. (May have been a function in v1 too -- verify.)

### `defaultCapabilities` remains a function

`defaultCapabilities()` still returns `Capabilities` -- no change.

### Credential type discriminants are numeric

```ts
// v1: { credentialType: 'basic', identity: ... }
// v2: { credentialType: defaultCredentialTypes.basic, identity: ... }
//     where defaultCredentialTypes.basic === 1
```

### New exports in v2

- `nobleCryptoProvider` -- pre-built noble provider (exported from `ts-mls` directly)
- `defaultCryptoProvider` -- pre-built default provider (uses @hpke/core)
- `unsafeTestingAuthenticationService` -- accepts all credentials (for tests only)
- `processMessage` -- unified message processor (handles both private and public)

---

## Migration Checklist (derived from findings)

1. **crypto.ts**: Rewrite `CryptoProvider.getCiphersuiteImpl` to accept `id: number` instead of the full ciphersuite object. Return `CiphersuiteImpl` with `id: number` instead of `name: string`.
2. **authentication.ts** (NEW): Create `AuthenticationService` implementation.
3. **types.ts**: Update `GroupOptions` to optionally accept `AuthenticationService`.
4. **group.ts - resolveCiphersuite**: Use `getCiphersuiteImpl(name, provider?)` which now takes a `CiphersuiteName` string.
5. **group.ts - all lifecycle functions**: Construct `MlsContext` and pass named params objects.
6. **group.ts - createGroup**: `mlsCreateGroup({ context, groupId, keyPackage, privateKeyPackage, extensions })`.
7. **group.ts - processWelcome/joinGroup**: `mlsJoinGroup({ context, welcome, keyPackage, privateKeys, ratchetTree })` -- no more `pskIndex`.
8. **group.ts - createCommit**: `createCommit({ context, state, extraProposals: [...] })`.
9. **group.ts - encrypt**: `createApplicationMessage({ context, state, message })` -- returns `{ message }` not `{ privateMessage }`.
10. **group.ts - decrypt/processMessage**: `processPrivateMessage({ context, state, privateMessage })`.
11. **group.ts - memberCount**: Change `node.nodeType === 'leaf'` to `node.nodeType === nodeTypes.leaf`.
12. **group.ts - makeMLSCredential**: Change `credentialType: 'basic'` to `credentialType: defaultCredentialTypes.basic`.
13. **group.ts - proposals**: Change `proposalType: 'add'` to `proposalType: defaultProposalTypes.add` (and similar for `'remove'`).
14. **group.ts - generateKeyPackageWithKey**: Change from positional args to named params object.
15. **tests**: Use `unsafeTestingAuthenticationService` for test `MlsContext`.
