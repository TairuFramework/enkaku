# did:peer:4 MLS authentication service binding

**Date:** 2026-05-27
**Predecessor:** [did:peer:4 transport integration](../../agents/plans/completed/2026-05-26-did-peer-4-transport-integration.complete.md)

## Goal

Enable `did:peer:4` identities to participate as full MLS group members. Today `@enkaku/group` supports peer4 only at the capability-token layer (credential JSON parsing + cache-threaded capability checks); the MLS leaf-node credential binding is still did:key-only. This spec closes that gap by:

1. Adapting `MultiKeyIdentity` to satisfy the existing `OwnIdentity` / `SigningIdentity` / `FullIdentity` interfaces so peer4 identities flow through group APIs unchanged.
2. Replacing the dual-format MLS leaf credential with a single JSON shape that always self-describes (no cache/resolver required inside MLS validation).
3. Teaching `createDIDAuthenticationService` to bind a peer4 MLS leaf signature key to a verification method in the embedded long-form DID document.

## Decisions

- **Identity unification.** `MultiKeyIdentity` is widened to structurally satisfy `OwnIdentity`. Existing group APIs (`createGroup`, `createKeyPackageBundle`, `joinGroupExternal`, `processWelcome`, `removeMember`) keep their `OwnIdentity` parameter type; peer4 identities just pass through. Predecessor's "adapt MultiKeyIdentity to SigningIdentity/FullIdentity" follow-up is retired here.
- **Breaking renames:** `MultiKeyIdentity.did` → `MultiKeyIdentity.id`. All `*DID` field references on identities, `MemberCredential.did` → `.id`, `Invite.inviterDID` → `inviterID` (`@enkaku/group` only).
- **Unified signing API.** `sign(payload, SignOptions)` and `signToken(payload, header?)` collapse into a single `signToken(payload, options?: SignTokenOptions)` where `options.header` carries the old header arg and `options.kid` / `options.embedLongForm` are the existing peer4-specific knobs.
- **MLS leaf credential format.** Single JSON shape `{ id: string, longForm?: string }`. Plain-DID wire format is dropped. peer4 leaves always carry `longForm`; did:key leaves omit it.
- **`SerializedCredential` deleted.** It mixed identity binding (`did`, `longForm`) with group membership state (`groupID`, `capabilityChain`). Those concerns split: identity binding lives in the MLS leaf bytes; membership state lives only in local `MemberCredential` and on the wire via `Invite`. Cleaner boundary, no zero-value placeholders.
- **Auth service is self-contained.** `validateCredential` never touches the cache or resolver. It decodes `longForm` inline, enforces hash binding (`shortForm === id`), and scans `doc.verificationMethod` for any VM whose decoded public-key bytes equal `signaturePublicKey`. No `kid` in the credential — MLS already commits to the leaf sig key.
- **Multi-sig peer4 identity → first sig key seeds MLS leaf.** `MultiKeyIdentity.publicKey` / `.privateKey` expose `keys.find(k => k.purpose === 'sig')`. `buildIdentity` throws eagerly if no sig key exists.
- **Rotation deferred.** MLS Update proposal flow for peer4 leaf-credential rotation is out of scope; lands in a follow-up that wires `@enkaku/token`'s rotation flow through `@enkaku/group`.

## Scope

### `@enkaku/token`

- Rename `MultiKeyIdentity.did` → `id`. Update all internal call sites (`rotation.ts`, identity factories, tests).
- Add to `MultiKeyIdentity`: `publicKey: Uint8Array`, `privateKey: Uint8Array` (from first sig key in `keys`).
- Replace `MultiKeyIdentity.sign` with `signToken(payload, options?: SignTokenOptions)` where:
  ```ts
  type SignTokenOptions = {
    header?: Record<string, unknown>
    kid?: string
    embedLongForm?: boolean
  }
  ```
- Update `SigningIdentity.signToken` to match the new signature. `createSigningIdentity` updates accordingly (header arg now reached via `options.header`).
- Migrate all `signToken(payload, header)` call sites to `signToken(payload, { header })`: `packages/capability/src/index.ts:199,238`, `packages/client/src/client.ts:228`, `packages/token/src/jwe.ts:271,277,286`, `packages/token/src/token.ts:123`.
- `buildIdentity` throws if `keys` contains no sig key (currently lazy via `pickSigningKey`).

### `@enkaku/group`

- **`credential.ts`:**
  - Delete `SerializedCredential`, `credentialToMLSIdentity`, `mlsIdentityToSerializedCredential`.
  - Add `type MLSCredentialIdentity = { id: string; longForm?: string }`.
  - Add `parseMLSCredentialIdentity(bytes: Uint8Array): MLSCredentialIdentity` — JSON parse with strict shape validation.
  - `populateCacheFromCredential(parsed: MLSCredentialIdentity, cache: DIDCache)` — signature changes (was `SerializedCredential`); behavior unchanged (decode longForm, hash-bind via `decodePeer4` + cache check, write).
  - `MemberCredential.did` → `MemberCredential.id`.
- **`authentication.ts`:**
  - `createDIDAuthenticationService(): AuthenticationService` — no parameters.
  - `validateCredential` logic:
    1. Return false for non-basic credential type.
    2. Try `parseMLSCredentialIdentity(credential.identity)` — return false on parse failure.
    3. If `isPeer4(parsed.id)`:
       - Return false if `parsed.longForm` missing.
       - `{ shortForm, doc } = decodePeer4(parsed.longForm)`; return false if `shortForm !== parsed.id`.
       - Iterate `doc.verificationMethod`; decode each `publicKeyMultibase`; constant-time-compare to `signaturePublicKey`. Return true on match.
       - Return false if no VM matched.
    4. Else (did:key): `[, pk] = getSignatureInfo(parsed.id)`; constant-time-compare to `signaturePublicKey`.
- **`group.ts`:**
  - `makeMLSCredential(identity: OwnIdentity): Credential` — always JSON. peer4: include `longForm` from identity (throw if `isPeer4(identity.id)` but no `longForm` field — meaning a peer4 identity was constructed via the older `createSigningIdentity`/`createFullIdentity` factories instead of `createIdentity`; in practice, peer4 identities always come from `createIdentity` so `longForm` is always present). did:key: `{ id: identity.id }`.
  - `findMemberLeafIndex(id: string)` — parse JSON identity bytes; compare via `normalizeDID(parsed.id) === normalizeDID(id)`.
  - `Invite.inviterDID` → `inviterID`.
  - No signature changes to `createGroup`, `createKeyPackageBundle`, `joinGroupExternal`, `processWelcome`, `removeMember` — `MultiKeyIdentity` now structurally satisfies `OwnIdentity`.

### Other packages

- Rename `identity.did` → `identity.id` access anywhere in tests/fixtures. Bulk of consumers already use `.id`.

## Tests

### `packages/group/test/authentication.test.ts`

- peer4 single-sig identity: well-formed credential, correct sig key → true.
- peer4 multi-sig identity: leaf bound to key #1 (non-primary) → true (VM scan).
- peer4 credential where `longForm` decodes to a doc whose `shortForm` ≠ credential `id` → false (hash binding).
- peer4 credential missing `longForm` → false.
- peer4 credential whose doc lacks the leaf sig key → false.
- did:key credential, valid → true (regression).
- did:key credential, wrong sig key → false (regression).
- Non-JSON identity bytes → false.
- Non-basic credential type → false.

### `packages/group/test/credential.test.ts`

- `makeMLSCredential` for did:key → `{ id }`, no `longForm`.
- `makeMLSCredential` for peer4 → `{ id, longForm }`.
- `makeMLSCredential` for peer4 identity missing `longForm` (synthetic) → throws.
- `parseMLSCredentialIdentity` accepts both shapes.
- `parseMLSCredentialIdentity` rejects malformed JSON, missing `id`, non-string `longForm`.
- `populateCacheFromCredential` writes peer4 doc, no-op for did:key, throws on hash-binding mismatch.

### `packages/group/test/peer4-credential.test.ts`

- Existing capability-layer cases preserved. Update `.did` accesses → `.id`.

### `packages/group/test/group.test.ts`

- **Two-member peer4 group end-to-end:** alice (peer4) creates group, invites bob (peer4), bob processes Welcome, both encrypt/decrypt round-trip.
- **Mixed peer4 + did:key group:** alice peer4 admin, bob did:key member; round-trip succeeds.
- **Multi-sig peer4 leaf:** alice's peer4 identity has two sig keys; MLS leaf uses primary; bob (any method) validates.
- **Remove peer4 member:** admin removes a peer4 member; epoch advances; subsequent message from removed member rejected.

### `packages/group/test/external-rejoin.test.ts`

- peer4 variant: alice peer4 creates, exports `GroupInfo`, second-device alice peer4 rejoins via `joinGroupExternal`. State at post-commit epoch.

### Workspace gates

```
pnpm --filter @enkaku/token test
pnpm --filter @enkaku/group test
pnpm run test       # full workspace
rtk proxy pnpm run lint
pnpm run build
```

## Out of scope

- Peer4 leaf-credential rotation via MLS Update proposal (follow-up; will wire `@enkaku/token` rotation flow through `@enkaku/group`).
- Post-quantum MLS ciphersuites.
- Cross-implementation standardization of the MLS basic credential JSON schema.
- Ledger hardware peer4 support.
- Browser/Expo keystore changes for large keys.

## Open questions (deferred)

- For multi-sig peer4 with no primary preference, should `mlsKeyKid` option in `GroupOptions` allow callers to override? Decided: not needed now; revisit if a real use case appears.
- Should `MemberCredential` carry rotation lineage for replay protection? Folds into the rotation follow-up.

## References

- DIF Peer DID Method spec, numalgo 4: <https://identity.foundation/peer-did-method-spec/#method-4-short-form-and-long-form>
- RFC 9420 §5.3 (Credentials), §7.2 (AuthenticationService responsibility): basic credential is `opaque identity<V>`; binding to leaf signature key is application-defined.
- Predecessor: `docs/agents/plans/completed/2026-05-26-did-peer-4-transport-integration.complete.md`.
- Original `next/` item: `docs/agents/plans/next/did-peer-4-mls-auth-service.md`.
