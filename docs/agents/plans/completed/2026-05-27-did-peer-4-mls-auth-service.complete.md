# did:peer:4 MLS authentication service binding

**Status:** complete
**Date:** 2026-05-27
**Branch / PR:** `feat/multikey-own-identity` / [#29](https://github.com/TairuFramework/enkaku/pull/29)
**Predecessor:** [did:peer:4 transport integration](2026-05-26-did-peer-4-transport-integration.complete.md)

## Goal

Enable `did:peer:4` identities to participate as full MLS group members. Prior work (predecessor) wired peer4 at the capability-token layer only; the MLS leaf-node credential binding was did:key-only. This work closes that gap end-to-end.

## Key design decisions

- **`MultiKeyIdentity` structurally satisfies `OwnIdentity`.** Renamed `.did → .id`; added `publicKey` / `privateKey` aliases sourced from the first sig key. Group APIs (`createGroup`, `createKeyPackageBundle`, `joinGroupExternal`, `processWelcome`, `removeMember`) accept peer4 identities without overload or adapter. The predecessor's "adapt MultiKeyIdentity to SigningIdentity/FullIdentity" follow-up retired here.
- **Unified signing API.** `sign(payload, SignOptions)` + `signToken(payload, header?)` collapsed into a single `signToken(payload, options?: SignTokenOptions)` with `options = { header?, kid?, embedLongForm? }`. Applies across `SigningIdentity`, `createSigningIdentity`, `MultiKeyIdentity`, `@enkaku/browser-keystore`, `@enkaku/ledger-identity`. Header merge order spreads `options.header` first then `typ`/`alg`/`kid` so callers cannot override security-critical fields.
- **MLS leaf credential is a single self-describing JSON shape.** `MLSCredentialIdentity = { id: string; longForm?: string }` replaces the dual-format `SerializedCredential` (which conflated identity binding with group membership state). did:key omits `longForm`; peer4 always carries it. Plain-DID wire format dropped entirely.
- **Auth service is self-contained.** `createDIDAuthenticationService.validateCredential` never touches the cache or resolver. peer4 path: decode `longForm` inline; enforce hash binding (`shortForm === id`); restrict to VMs listed in `doc.authentication` (per DID Core); validate each VM's multibase via `getAlgorithmAndPublicKey` to reject unknown codecs; constant-time compare the stripped pubkey to the MLS leaf signature key. did:key path: `getSignatureInfo` + constant-time compare. Multi-sig peer4 leaves bind naturally — any sig key in the doc may sign the MLS leaf.
- **Membership state lives outside the MLS leaf.** `MemberCredential` (capability chain, permission, groupID) is local-only. The MLS leaf bytes carry only identity binding.
- **`makeMLSCredential` requires `longForm` for peer4.** Throws if a peer4 identity is missing `longForm` (i.e. not produced by `createIdentity`).
- **First-sig-key seeds the MLS leaf** for multi-sig peer4 identities. `MultiKeyIdentity.publicKey` / `.privateKey` expose the first `purpose === 'sig'` key; `buildIdentity` throws eagerly if no sig key exists.
- **`joinGroupExternal` resync guard.** ts-mls's `joinGroupExternal` with `resync: true` enters an unbounded loop when the rejoining keypackage signature key matches no existing leaf (downstream `removeLeafNodeMutable(tree, -1)`). We pre-check `normalizeDID(identity.id) === normalizeDID(credential.id)` and throw a clear error.

## What was built

### `@enkaku/token`

- `MultiKeyIdentity.did → .id`; added `publicKey`, `privateKey` (first sig key, eager throw if absent).
- `SignTokenOptions` type; `SigningIdentity.signToken(payload, options?)`; legacy `SignOptions` removed.
- `createSigningIdentity`, internal callers in `jwe.ts` and `token.ts`, and `rotation.ts` migrated.

### `@enkaku/capability`

- `createCapability` migrated to `signer.signToken(payload, { header })`; dropped vestigial `HeaderParams` generic.

### `@enkaku/client`

- `createClient`'s message factory migrated to the options-object form.

### `@enkaku/browser-keystore`, `@enkaku/ledger-identity`

- Custom `signToken` impls rewritten to take `SignTokenOptions`; header merge order preserved.

### `@enkaku/group`

- `MLSCredentialIdentity` and `parseMLSCredentialIdentity` introduced; `SerializedCredential`, `credentialToMLSIdentity`, `mlsIdentityToSerializedCredential` removed.
- `MemberCredential.did → .id`; `Invite.inviterDID → .inviterID`.
- `populateCacheFromCredential` re-typed to `MLSCredentialIdentity`; hash-binding check unchanged.
- `makeMLSCredential(identity: OwnIdentity)` rewritten: always JSON, peer4 requires `longForm`, exported.
- `createDIDAuthenticationService` rewritten for peer4 binding via `doc.authentication`-filtered VM scan with multicodec validation.
- `findMemberLeafIndex(id)` rewritten to use `parseMLSCredentialIdentity` + `normalizeDID` for peer4 short-form equivalence.
- `joinGroupExternal` resync identity-mismatch guard.

### Test coverage

`@enkaku/group`: 90 tests across 9 files. New end-to-end peer4 scenarios in `group.test.ts`: two-member peer4 group with message round-trip, mixed peer4 + did:key group, multi-sig peer4 leaf binding, peer4 member removal. `external-rejoin.test.ts` gains a peer4 same-key rederivation case and a resync identity-mismatch guard test. `authentication.test.ts` gains 7 peer4-specific cases (single-sig, multi-sig non-primary, missing longForm, hash-binding tamper, missing-from-doc, mixed sig+kem, no-authentication-array, non-JSON, non-basic type). All workspace gates green (`pnpm run test`: 36/36 tasks; `rtk proxy pnpm run lint`: clean; `pnpm run build`: 39/39).

## Critical security fixes / hardening

- **VM scan tightened to `doc.authentication`-listed VMs only.** Originally the auth service iterated every `verificationMethod` entry, which would have permitted (in principle) future doc shapes to bind an MLS leaf to a key-agreement or assertion-only key. Not exploitable today but the principle was over-permissive. Now strictly DID Core-compliant.
- **Multicodec prefix validation.** Replaced `subarray(2)` blind strip with `getAlgorithmAndPublicKey`, which rejects unknown codecs (X25519 KEM, future PQ) instead of comparing truncated bytes of unknown provenance.
- **Resync hang guard.** Documented and guarded against the ts-mls `removeLeafNodeMutable(tree, -1)` infinite loop on resync no-match.

## Breaking changes

- `MultiKeyIdentity.did` → `MultiKeyIdentity.id`
- `MultiKeyIdentity.sign(payload, options)` → `MultiKeyIdentity.signToken(payload, options)`
- `SigningIdentity.signToken(payload, header?)` → `signToken(payload, options?: SignTokenOptions)`
- `SignOptions` removed; use `SignTokenOptions`
- `MemberCredential.did` → `.id`
- `Invite.inviterDID` → `.inviterID`
- `SerializedCredential`, `credentialToMLSIdentity`, `mlsIdentityToSerializedCredential` removed; replaced by `MLSCredentialIdentity` and `parseMLSCredentialIdentity`
- `makeMLSCredential(did: string)` → `makeMLSCredential(identity: OwnIdentity)`; plain-DID wire format dropped

## Out of scope (lands in follow-up work)

- Peer4 leaf-credential rotation via MLS Update proposal — wires `@enkaku/token`'s rotation flow through `@enkaku/group`.
- Re-export `makeMLSCredential` / `MLSCredentialIdentity` from `packages/group/src/index.ts` for external consumers.
- Add `test:types` to the turbo pipeline so package-level TypeScript regressions surface in `pnpm run test` (a pre-existing failure in `packages/client/test/controller-on-done-once.test.ts:107` is currently masked).
- JSDoc on `createIdentity` / `IdentityKeySpec.privateKey` documenting deterministic peer4 short-form derivation from provided private key bytes.
- CHANGELOG entry covering the breaking renames for downstream consumers (Kubun, Mokei).
- Post-quantum MLS ciphersuites.
- Cross-implementation standardization of the MLS basic credential JSON schema.
- Ledger hardware peer4 support.
- Browser/Expo keystore changes for large keys.

## References

- Spec: previously at `docs/superpowers/specs/2026-05-27-did-peer-4-mls-auth-service-design.md` (deleted on completion; preserved in git history).
- Plan: previously at `docs/superpowers/plans/2026-05-27-did-peer-4-mls-auth-service.md` (deleted on completion; preserved in git history).
- Predecessor: [did:peer:4 transport integration](2026-05-26-did-peer-4-transport-integration.complete.md).
- DIF Peer DID Method spec, numalgo 4: <https://identity.foundation/peer-did-method-spec/#method-4-short-form-and-long-form>
- RFC 9420 §5.3 (Credentials), §7.2 (AuthenticationService responsibility).
