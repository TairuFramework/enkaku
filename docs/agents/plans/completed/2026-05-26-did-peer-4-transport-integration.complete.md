# did:peer:4 transport integration

**Status:** complete
**Date:** 2026-05-26
**Branch / PR:** `feat/peer4-propagation` / TBD

## Goal

Wire the `did:peer:4` contracts shipped in `@enkaku/token` (resolver + content-addressed cache) into the rest of the stack so short-form DIDs can be exchanged and verified between peers across all transports, through capability delegation chains, and inside MLS groups (at the capability-token level).

## Key design decisions

- **Identity exchange at the token layer, not the transport layer.** A signing identity's first token to a given audience embeds the long-form `did:peer:4` (with full doc) in the `iss` claim. Receivers decode the doc inline, verify hash binding, and cache it. Subsequent tokens use the compact short form, resolved via cache. Transport-agnostic — covers HTTP, socket-transport, group MLS, capability chain delegations.
- **First-per-aud policy with override.** `MultiKeyIdentity.sign` tracks an internal `Set<string>` of audiences sent long-form to. Default: long form on first token to a given `payload.aud`, short form thereafter. `embedLongForm: true | false` overrides. `did:key` always uses short form (longForm === did).
- **Cache write-after-verify.** `verifyToken` populates the cache only after signature verification passes. Bad-sig tokens cannot pollute the cache via memory DoS.
- **Bounded cache with LRU.** `createInMemoryDIDCache({ maxEntries })` enforces a default 10,000-entry limit with LRU eviction. `get` is a recency hit.
- **`normalizeDID` helper for equality.** A single helper folds long ↔ short form for all DID string comparisons. did:key passes through unchanged. Used in capability delegation, server access-control, and group capability validation.
- **Cache + resolver threaded through delegation chains.** `DelegationChainOptions.cache?: DIDCache, resolver?: DIDResolver` — the same cache instance is passed to every recursive `verifyToken` call inside `checkDelegationChain` and `checkCapability`, so the cache populates transitively as the chain walks.
- **Resolver as escape hatch (D).** `DIDResolver` interface for short forms not in cache. Resolver-returned docs are hash-bound-verified by `resolveIssuerWithDoc` before use.
- **MLS credential carries optional `longForm`.** `SerializedCredential.longForm?: string`; `populateCacheFromCredential` decodes and writes to the group cache. Hash binding enforced against `serialized.did` before cache write.
- **Group-handle owns a cache.** `GroupHandle` exposes `cache: DIDCache` (defaulting to an in-memory instance) plus optional `resolver`. `validateGroupCapability` threads both into capability verification.
- **Server defaults a cache.** `EnkakuServer` constructor defaults `cache` to `createInMemoryDIDCache()` when none provided; threaded into outer-message verify and access-control.

## What was built

### `@enkaku/token`

- `normalizeDID(did)` — public helper folding peer:4 long↔short.
- `createInMemoryDIDCache({ maxEntries })` — bounded LRU.
- `resolveIssuer` refactored: handles long-form `iss` inline (no resolver call). New exported `resolveIssuerWithDoc` returns `{ alg, publicKey, peer4Doc? }` for callers that need the decoded doc for cache writes.
- `VerifyTokenOptions.cache?: DIDCache` — when present, `verifyToken` consults cache during resolution and writes to it only after sig verifies.
- `MultiKeyIdentity.sign({ embedLongForm })` — first-per-aud policy with explicit override.

### `@enkaku/capability`

- `DelegationChainOptions.cache?: DIDCache, resolver?: DIDResolver` — threaded through every recursive `verifyToken` call.
- `normalizeDID` used in `assertValidDelegation`, `checkDelegationChain` base case, `checkCapability` self-issued short-circuit, and `createCapability` parent comparisons.

### `@enkaku/server`

- **Security fix:** outer message signature is now cryptographically verified before access-control. Previously absent (see Critical security fix below).
- `EnkakuServer` constructor accepts `cache?: DIDCache, resolver?: DIDResolver`; defaults cache to in-memory.
- `access-control.ts` normalizes peer4 DIDs in all `iss`/`sub`/`aud`/`allow`-list comparisons.

### `@enkaku/group`

- `SerializedCredential.longForm?: string` plus `populateCacheFromCredential(serialized, cache)` helper that verifies hash binding before caching.
- `credentialToMLSIdentity` now embeds `longForm` for peer:4 credentials; `mlsIdentityToSerializedCredential` validates the field type.
- `GroupOptions.cache?: DIDCache, resolver?: DIDResolver`; `GroupHandle` owns a cache (always populated — default in-memory), exposed via getters.
- `validateGroupCapability` threads cache/resolver into `verifyToken` and `checkDelegationChain`, and normalizes the `iss !== sub` guard.

### Test coverage

Token: 165 tests across 17 files. Capability: 71 tests. Server: 118 tests. Group: 75 tests. Workspace build, lint, and test suites all clean.

## Critical security fix — outer-message signature verification

An audit during Gate 3 discovered that `EnkakuServer.handleMessages` was accepting signed-shaped messages without cryptographically verifying their outer signature. `isSignedToken()` was a structural check only; `checkClientToken()` validated capability chains but never the outer message envelope. Any party knowing the protocol shape and a whitelisted DID could impersonate it with a junk signature.

**Reproduction:** Send a `SignedToken`-shaped message with valid header / payload / `data` but a tampered `signature` field. Server previously accepted and dispatched it.

**Fix:** Call `verifyToken(message as SignedToken, { cache, resolver })` after the existing `isSignedToken` structural check and before `checkClientToken` in the authenticated branch of the `process` closure. The existing try/catch surfaces any thrown error as an `EK02` access-denied response.

The fix is general — it protects both did:key and did:peer:4 identities. Tests in `packages/server/test/outer-signature.test.ts` cover forged-signature rejection, missing-`data` rejection, valid did:key acceptance, and valid did:peer:4 long-form acceptance with cache population.

**Pre-existing test exposed:** A `handles channels` test in `packages/server/test/lib.test.ts` had a latent race — the first `send` message was dispatched before the channel controller was registered. The async overhead of `verifyToken` made the race reliably manifest. Fixed by waiting for the `handlerStart` event before sending.

## Gate-driven execution

The plan ran four gates with stop-and-surface conditions:

- **Gate 1 (token layer):** passed.
- **Gate 2 (capability matrix):** required one test-design redesign after early cells exposed misuse of `checkCapability` (calling with request-token payloads that have `iss === sub` and no `cap` chain access — real flow short-circuits earlier in `checkProcedureAccess`). Tests adjusted to match real protocol shape. All 6 cells passed.
- **Gate 3 (server):** audit confirmed missing outer-signature verification (see Critical security fix). User approved fixing in-branch. Fix landed alongside cache/resolver wiring.
- **Gate 4 (group):** scope question surfaced during Task 4.2 — MLS auth-service peer4 binding (resolving peer4 docs to MLS leaf signing keys) is bigger than the original plan accounted for. User approved a minimal scope: capability-layer cache threading + credential JSON longForm only. MLS-level peer4 leaf joins deferred to a follow-up plan.

## Out of scope (lands in follow-up work)

- **MLS auth-service peer4 binding.** `createDIDAuthenticationService` still uses `getSignatureInfo` which only works for did:key. For peer4, the auth service must look up the doc (via cache/resolver) and find the verification method matching the MLS leaf signing pubkey. Also `makeMLSCredential` needs to emit `longForm` for peer4 identities. See `docs/agents/plans/next/`.
- **Post-quantum algorithm integration** via `paulmillr/noble-post-quantum` (ML-DSA, ML-KEM).
- **Browser and Expo keystore refactor for large keys** (current backends have size limits incompatible with PQ key material).
- **Adapting `MultiKeyIdentity` to the existing `SigningIdentity` / `FullIdentity` interfaces** for reuse where the older identity factories are wired.
- **MLS post-quantum ciphersuites in `@enkaku/group`.**
- **Ledger hardware peer4 support.**

## References

- Spec: previously at `docs/superpowers/specs/2026-05-26-did-peer-4-transport-integration-design.md` (deleted on completion; preserved in git history).
- Plan: previously at `docs/superpowers/plans/2026-05-26-did-peer-4-transport-integration.md` (deleted on completion; preserved in git history).
- Predecessor: [did:peer:4 PQ-friendly identifiers](2026-05-26-did-peer-4-pq-friendly.complete.md).
- DIF Peer DID Method spec, numalgo 4: <https://identity.foundation/peer-did-method-spec/#method-4-short-form-and-long-form>
