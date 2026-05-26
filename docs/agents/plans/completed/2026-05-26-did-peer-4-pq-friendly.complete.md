# did:peer:4 PQ-friendly identifiers

**Status:** complete
**Date:** 2026-05-26
**Branch / PR:** `feat/did-peer` / [PR #27](https://github.com/TairuFramework/enkaku/pull/27)

## Goal

Add `did:peer:4` support to `@enkaku/token` alongside the existing `did:key` method, so that multi-key and (future) post-quantum identities can be referenced by compact (~50 char) identifiers instead of inline-encoded public-key strings that explode to thousands of characters for PQ keys.

## Key design decisions

- **Two DID methods coexist.** `did:key` stays the default for single classical signing keys (backward compatible). `did:peer:4` is used whenever an identity has multiple keys, a non-`sig` key, or any post-quantum key. The identity builder auto-selects; callers can override via `didMethod`.
- **DIF `did:peer:4` numalgo 4** is adopted verbatim — long form (`did:peer:4{hash}:{encodedDoc}`) is self-contained and verifiable; short form (`did:peer:4{hash}`) is compact and bound to the long form by SHA-256 collision resistance.
- **Doc delivery is contract-only at the token layer.** The token package exposes `DIDResolver` and `DIDCache` interfaces (sync or async returns) plus an in-memory cache implementation. Transport-layer plumbing (HTTP handshake header, WebSocket frame, MLS `LeafNode` credential) is deferred to a follow-up plan.
- **Cache binding is enforced on write.** `DIDCache.set` recomputes the short-form hash from the doc and rejects mismatches, so a malicious resolver cannot poison the cache.
- **Rotation is immutable + signed assertion.** Any key change produces a new `did:peer:4`; the old identity signs a `RotationAssertion` token linking the two. No mutable docs.
- **Token integration via `kid` header.** Signed tokens for `did:peer:4` issuers carry an optional `kid` selecting which verification method in the doc signed. Verifier falls back to the first `authentication` entry when `kid` is absent (per DIF spec edge case).
- **API design follows project review feedback.** `verifyToken(token, options?)` and `verifySignedPayload(input)` use single options/input objects rather than long positional lists; `concatBytes` lives in `utils.ts` (not duplicated per module).
- **Public API stays minimal.** Internal helpers (`verifySignedPayload`, `concatBytes`) are not exported. New public surface: `encodeMultibase`, `decodeMultibase`, `multihashSHA256`, `verifyMultihash`, `encodePeer4`, `decodePeer4`, `isPeer4`, `getPeer4ShortForm`, `validateDIDDoc`, `createInMemoryDIDCache`, `resolveIssuer`, `createIdentity`, `createRotationAssertion`, plus accompanying types.

## What was built

Inside `@enkaku/token`:

- `multibase.ts` — base58btc multibase + SHA-256 multihash helpers.
- `peer4.ts` — DID document schema + validator; `did:peer:4` encode/decode with hash binding verification, JSON multicodec framing, oversize-doc guards (default 64 KB, preflight at 2× the encoded-form bound).
- `cache.ts` — `DIDResolver` and `DIDCache` types; in-memory implementation that verifies short-form/doc binding on every `set`.
- `did.ts` — adds `resolveIssuer()` that dispatches by DID method. `did:key` issuers resolve inline (unchanged backward path); `did:peer:4` short-form issuers resolve via the passed-in resolver, look up the verification method by `kid` (or fall back to the first authentication entry), and decode the multibase public key.
- `identity.ts` — adds the unified `createIdentity()` multi-key builder. Returns a `MultiKeyIdentity` with `did`, `longForm`, `doc`, `keys`, `sign(payload, { kid? })`, `decrypt(jwe)`, and `agreeKey(epk, kid?)`. Existing `createSigningIdentity`/`createDecryptingIdentity`/`createFullIdentity`/`randomIdentity` are untouched.
- `schemas.ts` — optional `kid: string` field added to `signedHeaderSchema`.
- `token.ts` — `verifyToken(token, options?)` accepts an optional `DIDResolver` and threads it through the verification path. `verifySignedPayload` refactored to single input object.
- `rotation.ts` — `RotationPayload` type and `createRotationAssertion(old, new, issuedAt?)` helper that produces a signed token linking the two identities.
- `utils.ts` — `concatBytes` helper, shared by `peer4.ts` and `identity.ts`.

Test coverage: 143 unit tests across 16 files in the token package. Workspace build, full test suite, and biome lint all clean. Two commits absorbed direct PR feedback before merge.

## Out of scope (lands in follow-up work)

- Transport-layer doc delivery: HTTP `X-Enkaku-Identity` header, WebSocket handshake frame in `@enkaku/server`, MLS `LeafNode` credential carrying long form in `@enkaku/group`.
- PQ algorithm integration via `paulmillr/noble-post-quantum` (ML-DSA, ML-KEM).
- Browser and Expo keystore refactor for large keys (current backends have size limits incompatible with PQ key material).
- Adapting `MultiKeyIdentity` to the existing `SigningIdentity` / `FullIdentity` interfaces for reuse in transport packages.
- MLS post-quantum ciphersuites in `@enkaku/group`.
- Ledger hardware PQ support.

## References

- Spec: previously at `docs/superpowers/specs/2026-05-26-did-peer-4-pq-friendly.md` (deleted on completion; preserved in git history).
- Plan: previously at `docs/superpowers/plans/2026-05-26-did-peer-4-pq-friendly.md` (deleted on completion; preserved in git history).
- DIF Peer DID Method spec, numalgo 4: <https://identity.foundation/peer-did-method-spec/#method-4-short-form-and-long-form>
