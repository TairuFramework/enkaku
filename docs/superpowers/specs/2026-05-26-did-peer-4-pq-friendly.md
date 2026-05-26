# did:peer:4 support for PQ-friendly identifiers

Status: Draft
Date: 2026-05-26
Author: brainstormed with assistant

## Problem

Enkaku currently encodes public keys directly into DIDs via `did:key:z{multibase(codec|pub)}` (`packages/token/src/did.ts`). This is fine for classical algorithms (Ed25519 → ~50 character DID), but unusable for post-quantum signature keys: an ML-DSA-65 public key is 1952 bytes, producing a ~2670 character DID. Tokens, log entries, URLs, and any persisted reference to an identity become prohibitively large.

We need a DID method that:

- Stays compact (~50 characters) regardless of key size.
- Allows a single identity to hold multiple keys (for hybrid classical+PQ signatures, and for distinct signing vs. key-agreement keys).
- Remains trustlessly verifiable — no central registry, no DNS dependency.
- Coexists with the existing `did:key` identifiers already deployed.

## Decision

Adopt **`did:peer:4`** ([DIF Peer DID Method spec, numalgo 4](https://identity.foundation/peer-did-method-spec/#method-4-short-form-and-long-form)) alongside `did:key`. Use `did:peer:4` whenever an identity has more than one key or contains a post-quantum key; keep `did:key` for the existing classical single-key path.

`did:peer:4` provides exactly the model we need:

- **Long form** — `did:peer:4{hash}:{encodedDoc}` — fully self-contained, deterministic from the doc, verifiable from the DID string alone.
- **Short form** — `did:peer:4{hash}` — compact identifier (~50 chars), bound to the long form by SHA-256 collision resistance.

Either form is a valid DID for the same identity. Software that has seen the long form once (and cached it) can interpret subsequent short-form references without further roundtrips.

## Scope

In scope:

- Adding `did:peer:4` encoding/decoding and verification.
- DID document shape used inside `did:peer:4` long form.
- Multi-key identities with per-token `kid` selection.
- Doc delivery channels and content-addressed cache.
- Rotation via signed assertion (new DID).
- Unified identity builder API choosing the method automatically.

Out of scope (separate specs):

- ML-DSA / ML-KEM algorithm integration via `noble-post-quantum`.
- Browser and Expo keystore refactors needed to hold large PQ keys.
- MLS post-quantum ciphersuites.
- Ledger hardware PQ support.

## Method selection rules

Two DID methods are supported:

| Identity shape | Method |
|---|---|
| Single key, classical algorithm (`EdDSA`, `ES256`) | `did:key` |
| Anything else (multi-key, or any PQ key present) | `did:peer:4` |

Auto-selection inside the identity builder:

```ts
if (keys.length === 1 && isClassical(keys[0])) {
  method = 'key'
} else {
  method = 'peer:4'
}
```

The caller may override via `didMethod`. Forcing `didMethod: 'key'` on a multi-key or PQ identity throws `IdentityError.InvalidMethod`. Forcing `didMethod: 'peer:4'` is always permitted, including for single classical keys.

## did:peer:4 mechanics

### Encoding

Let `concat(a, b)` denote byte concatenation.

- `canonicalDoc = utf8(canonicalStringify(doc))` — RFC 8785 canonical JSON serialization of the DID document as UTF-8 bytes.
- `taggedDoc = concat(multicodec('json' = 0x0200 varint), canonicalDoc)` — prefixed with the JSON multicodec.
- `encodedDoc = 'z' + base58btc(taggedDoc)` — base58btc multibase of the tagged doc.
- `digest = sha256(utf8(encodedDoc))` — hash the encoded string as bytes (per DIF spec).
- `multihash = concat(0x12, 0x20, digest)` — sha2-256 multihash (function code `0x12`, length `0x20`).
- `hash = 'z' + base58btc(multihash)` — base58btc multibase of the multihash.
- `longForm = 'did:peer:4' + hash + ':' + encodedDoc`
- `shortForm = 'did:peer:4' + hash`

Base58btc and sha2-256 are required by the DIF `did:peer:4` spec; choice of multibase / multihash is not configurable.

Canonical JSON is produced by `canonicalStringify` from `@enkaku/codec` (RFC 8785).

### Document shape

```json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "verificationMethod": [
    { "id": "#key-0", "type": "Multikey", "publicKeyMultibase": "z6Mk..." },
    { "id": "#key-1", "type": "Multikey", "publicKeyMultibase": "zPQ..." }
  ],
  "authentication": ["#key-0", "#key-1"],
  "keyAgreement": ["#key-2"]
}
```

- `publicKeyMultibase` uses standard multicodec prefixes (`ed25519-pub 0xed`, `x25519-pub 0xec`, future ML-DSA/ML-KEM codecs).
- `#key-N` fragments are stable references used as `kid` in token headers.
- `authentication` lists keys usable for signing tokens.
- `keyAgreement` lists keys usable for JWE key encapsulation.

### Token integration

- `iss` is the **short form** (`did:peer:4{hash}`) for compactness.
- A new token header field `kid` names the verification method (e.g. `#key-1`) used to sign.
- Verifier resolves `iss` against the DID resolver/cache, looks up `kid` in the doc, retrieves the multibase-encoded public key, dispatches to the existing `Verifier` map by algorithm.
- For `did:key` issuers, `kid` is omitted; the existing `did:key` resolution path is unchanged.

## Doc delivery

Three paths feed the content-addressed cache. They are complementary, not alternatives — a single deployment uses whichever fit its transport.

### A. Transport handshake

For HTTP and WebSocket clients exchanging tokens with a server:

- On first contact, each side sends its long-form DID. HTTP: `X-Enkaku-Identity` header. WebSocket: initial frame carrying `{ identity: longForm }`.
- Both sides parse, verify hash, populate cache.
- Subsequent tokens use short form `iss`.

Cost: ~2KB per peer once per session (for a PQ-bearing identity).

### B. MLS LeafNode credential

For the group package, MLS already distributes member credentials. The long-form DID is carried inside the `BasicCredential` payload (or a custom credential type), so members learn each other's long form as a side effect of MLS Welcome/Commit processing. Cache is populated during normal MLS state advancement; no extra protocol round-trip.

### C. Fallback: unknown-DID error

If a verifier receives a token whose short-form `iss` is not in the cache and no other delivery channel has fired:

- Verification fails with `EnkakuError.UnknownDID(hash)`.
- Application-level code can react (request long form from sender, populate cache, retry). This path is opt-in; the verifier never auto-fetches.

### Resolver and cache interfaces

```ts
type DIDResolver = (did: string) => DIDDoc | undefined | Promise<DIDDoc | undefined>

type DIDCache = {
  get(hash: string): DIDDoc | undefined | Promise<DIDDoc | undefined>
  set(hash: string, doc: DIDDoc): void | Promise<void>
}
```

Both sync and async returns are accepted, allowing persistent caches (IndexedDB, SQLite, expo-sqlite, file-backed). The verifier is async-aware and awaits as needed. Cache `set` MUST verify `hash == multihash(canonical(doc))` before storing, regardless of source.

## Rotation

A `did:peer:4` is immutable: the hash binds the full doc, so any key change produces a new DID. Rotation is therefore modelled as **new DID + signed assertion linking old to new**.

```ts
type RotationAssertion = {
  type: 'did-rotation'
  from: string         // old DID (did:key or did:peer:4 short)
  to: string           // new DID (did:peer:4 short)
  toLongForm: string   // full long form of new DID
  issuedAt: number
}
```

The assertion is a regular signed enkaku token whose `iss` is `from` and payload carries `to`, `toLongForm`, `issuedAt`. Verifiers can optionally walk a rotation chain to treat linked identities as one logical entity; chain length is unbounded but each hop costs a verification.

Migration `did:key` → `did:peer:4`:

1. Generate a new `did:peer:4` long form containing the existing classical key (and optionally new keys).
2. Sign a rotation assertion with the existing classical key.
3. Old `did:key` remains valid for historical tokens. New identity used going forward.

Same private key bytes can back either DID method — the method is a presentation layer over key material. Keystores persist raw private keys; the method is recorded as metadata so reconstruction picks the correct form.

## Identity builder API

Existing functions (`createSigningIdentity`, `createBrowserSigningIdentity`, `createDecryptingIdentity`, `createFullIdentity`) are kept unchanged for backward compatibility. They all emit `did:key`.

New unified builder:

```ts
type KeyPurpose = 'sig' | 'kem'

type KeyAlg = 'EdDSA' | 'ES256' | 'X25519'
  // future: 'ML-DSA-65' | 'ML-KEM-768' | ...

type IdentityKeySpec = {
  purpose: KeyPurpose
  alg: KeyAlg
  privateKey?: Uint8Array  // omitted → generate
}

type CreateIdentityInput = {
  keys: Array<IdentityKeySpec>
  didMethod?: 'key' | 'peer:4'  // omitted → auto
}

type Identity = {
  did: string                              // short form (always)
  longForm: string                         // long form (== did for did:key)
  doc: DIDDoc                              // resolved doc
  signers: Map<string, Signer>             // kid → signer
  decrypters: Map<string, Decrypter>       // kid → decrypter
  sign(payload: unknown, opts?: { kid?: string }): Promise<SignedToken>
  decrypt(token: EncryptedToken): Promise<DecryptedPayload>
}

function createIdentity(input: CreateIdentityInput): Promise<Identity>
```

Default `kid` for `sign` is the first entry in `authentication`. Explicit `kid` lets callers force algorithm-specific signing during hybrid transition.

### Keystore integration

Each keystore package adds a parallel `provideIdentity(spec)` taking the same `CreateIdentityInput`. Raw key material is persisted unchanged; the spec (algorithm list, method) is recorded as metadata alongside. Reconstruction reads both, rebuilds the `Identity`.

For this spec, only classical algorithms are wired in:

- `node-keystore`, `electron-keystore`: trivial — store raw bytes + spec JSON.
- `browser-keystore`: classical multi-key supported (P-256 / X25519). PQ deferred.
- `expo-keystore`: classical multi-key supported. PQ deferred.

## Codec and dependencies

- `@enkaku/codec` is unchanged. The existing `canonicalStringify` is used.
- Base58btc encoding remains where it already lives, inside `packages/token/src/did.ts` (`@scure/base`). New helpers added in the token package (file `did.ts`, or split out as `multibase.ts` / `multihash.ts` if it grows):
  - `encodeMultibase(bytes): string` — `'z' + base58.encode(bytes)`.
  - `decodeMultibase(s): Uint8Array` — strips `'z'`, errors on other multibase prefixes.
  - `multihashSHA256(bytes): Uint8Array` — `0x12 0x20` + 32 SHA-256 digest bytes.
  - `verifyMultihash(mh, bytes): boolean`.
- `packages/token/src/peer4.ts` (new) — long/short form encode and decode, doc canonicalization, hash binding verification, doc validation. Imports `canonicalStringify` from `@enkaku/codec` and the multibase/multihash helpers from `did.ts`.

## Errors

| Code | When | Recovery |
|---|---|---|
| `UnknownDID(hash)` | Verifier sees `did:peer:4` short form not in cache. | Caller fetches long form, populates cache, retries. |
| `DIDDocHashMismatch` | Long form parsed, recomputed hash differs from embedded hash. | Reject — tampered or corrupt. |
| `DIDDocInvalid` | Doc fails schema validation (missing `verificationMethod`, malformed multibase, oversized). | Reject. |
| `KidNotFound(kid)` | Token `kid` references a fragment not present in doc. | Reject. |
| `KidAlgMismatch` | Resolved key's algorithm does not match the token's algorithm header. | Reject. |
| `InvalidMultibase` | Multibase string has unsupported prefix or malformed alphabet. | Reject. |
| `InvalidMultihash` | Multihash has unknown function code or length mismatch. | Reject. |
| `IdentityError.InvalidMethod` | Builder called with incompatible `didMethod` override (e.g. `'key'` on multi-key input). | Caller fixes input. |
| `RotationChainBroken` | Walking rotation chain, an assertion is missing or invalid. | Treat as separate identities (or surface to app). |

### Edge cases

- **Token with `did:key` `iss`** — bypass cache entirely. Existing code path unchanged.
- **Token with `did:peer:4` short `iss`, no `kid`** — verifier uses first entry in `authentication`.
- **Cache poisoning** — short DID hash is collision-resistant under SHA-256. `cache.set` verifies the hash before storing; resolver returning unverified data is a bug.
- **Concurrent first use** — parallel tokens from the same unknown peer race the cache. `set` is idempotent (same hash → same doc); both writes are safe.
- **Doc size limit** — verifier enforces a max doc size on long-form parse (default 64 KB, configurable). Defends against DoS.

## Testing

Unit (per package):

- `packages/token/test/peer4.test.ts` — encode/decode round-trip; tampered doc rejected; canonical JSON determinism; mixed-algorithm docs; malformed multibase / multihash rejection.
- `packages/token/test/identity.test.ts` — auto-method selection; force-override validation; multi-key sign + verify; `kid` selection.
- `packages/token/test/token.test.ts` — sign with `did:peer:4` identity, verify with cached doc; `UnknownDID` when cache empty; `did:key` + `did:peer:4` mixed in one verifier.
- `packages/token/test/cache.test.ts` — sync and async resolver paths; idempotent `set`; hash mismatch rejection.

Integration:

- `packages/server/test/peer4-handshake.test.ts` — HTTP handshake exchanges long forms once; subsequent calls verify against cache.
- `packages/group/test/peer4-credential.test.ts` — MLS LeafNode carries long form; cache populated on Welcome processing.

Property / fuzz:

- Random key sets → builder → encode → decode → equal.
- Random byte tampering on encoded long form → always rejected.

## Open questions

None blocking. Future work captured in out-of-scope list above.

## References

- DIF Peer DID Method spec (numalgo 4): <https://identity.foundation/peer-did-method-spec/>
- W3C DID Core: <https://www.w3.org/TR/did-core/>
- RFC 8785 JSON Canonicalization Scheme: <https://datatracker.ietf.org/doc/html/rfc8785>
- multibase / multihash / multicodec: <https://github.com/multiformats>
- `paulmillr/noble-post-quantum` (future use): <https://github.com/paulmillr/noble-post-quantum>
