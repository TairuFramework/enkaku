# did:peer:4 transport integration — design

**Status:** spec
**Date:** 2026-05-26
**Predecessor:** [did:peer:4 PQ-friendly identifiers](../../agents/plans/completed/2026-05-26-did-peer-4-pq-friendly.complete.md)
**Source:** `docs/agents/plans/next/did-peer-4-transport-integration.md`

## Goal

Wire the `did:peer:4` contracts shipped in `@enkaku/token` (resolver + content-addressed cache) into the rest of the stack so short-form DIDs can be exchanged and verified between peers across all transports (HTTP, socket), through capability delegation chains, and inside MLS groups.

## Approach summary

Identity exchange happens at the **token layer**, not the transport layer. A signing identity's first token to a given audience embeds the long-form `did:peer:4` (which carries the full DID document) in the `iss` claim. Receivers decode the doc inline, verify hash binding, and cache it. Subsequent tokens use the compact short form, resolved via cache. An optional `DIDResolver` provides an escape hatch when long-form was not pre-shared (e.g. p2p discovery, capability chains referencing unknown peers).

Transports stay identity-agnostic. No HTTP header, no socket handshake frame, no protocol extension.

## Architecture

### Token layer (`@enkaku/token`)

- **`resolveIssuer` handles long-form `iss` inline.** When `isPeer4(iss)` and `iss` is long form, call `decodePeer4(iss)`, verify hash binding, resolve `kid` from the in-band doc — no resolver call. When `iss` is short form, look up cache, fall through to injected resolver, throw `UnknownDID` on miss. Return shape extended to `{ alg, publicKey, peer4Doc? }` so callers can write to cache after signature verification.
- **`verifyToken` accepts `{ cache, resolver }`.** Both threaded through `VerifyTokenOptions`. Cache populated only after signature verifies, preventing memory-DoS from bad-sig tokens.
- **`MultiKeyIdentity.sign` gains `embedLongForm?: boolean`** in `SignOptions`. Identity tracks an internal `Set<string>` of audiences it has sent long form to. Default policy: if `payload.aud` is set and not in the Set, use long form and add it; otherwise use short form. `embedLongForm: true|false` overrides. No `aud` → short form (caller must pass `embedLongForm: true` for first contact without aud).
- **Bounded cache.** `createInMemoryDIDCache({ maxEntries?: number })` with LRU eviction. Default e.g. 10_000.
- **New exported helper:** `normalizeDID(did: string): string` — returns `getPeer4ShortForm(did)` for peer4, else passes through. Used everywhere a DID string is compared.

### Capability layer (`@enkaku/capability`)

- **`DelegationChainOptions` gains `cache?: DIDCache`, `resolver?: DIDResolver`.** Threaded into every recursive `verifyToken` call inside `checkDelegationChain` and `checkCapability`. Single cache instance flows through entire chain — long-form entries in any token populate the cache transitively for the rest of the walk.
- **Normalization in equality checks.** `assertValidDelegation` compares `normalizeDID(to.iss) === normalizeDID(from.aud)` and same for `sub`. `checkCapability` `iss === sub` self-issued short-circuit uses normalization. `checkDelegationChain` base case uses normalization.

### Server (`@enkaku/server`)

- **`EnkakuServer` constructor and `HandleMessagesParams` accept `cache?: DIDCache`, `resolver?: DIDResolver`.** Default cache = `createInMemoryDIDCache()`. Threaded into `checkClientToken` via `DelegationChainOptions`.
- **Outer-message signature verify.** Before access-control, call `verifyToken(message as SignedToken, { cache, resolver, verifiers })`. Audit existing server.ts: if outer message signature is not currently verified anywhere, surface as critical security finding (Gate 3, see below).
- **`access-control.ts` normalization.** `payload.iss === serverID`, `payload.sub === serverID`, `payload.aud === serverID` all use `normalizeDID` on both sides. `checkProcedureAccess` `allow.includes(payload.iss)` normalizes allow list and `payload.iss`/`payload.sub`.

### Group (`@enkaku/group`)

- **`SerializedCredential` gains `longForm?: string`** (optional). Member emits credential including `longForm` when their identity is `did:peer:4`. `mlsIdentityToSerializedCredential` parses the field. New helper consumes it on credential decode: `decodePeer4(longForm)`, assert `shortForm === serialized.did`, `cache.set(shortForm, doc)`.
- **`GroupOptions.cache?: DIDCache`.** Defaults to `createInMemoryDIDCache()`. One cache per group handle. Credentials processed during Welcome/Add/Commit populate it.
- **Did:key members unaffected.** No `longForm` → peer4 path is skipped. Mixed groups (peer4 + did:key members) supported.

### Transports

**No changes.** `@enkaku/http-server-transport`, `@enkaku/http-client-transport`, `@enkaku/socket-transport` stay identity-agnostic. Identity exchange rides inside the token, not the transport envelope.

## Data flow

### First-contact client → server

1. Client's `MultiKeyIdentity.sign({ aud: serverID, prc, ... })` sees aud not in `sentTo` → `iss = client_long_form`, header `kid` set to signing key fragment.
2. Token posted via any transport. Transport unchanged.
3. Server `verifyToken(message, { cache, resolver })`: `resolveIssuer` detects long form, decodes inline, verifies hash binding. Signature verified. Cache write deferred until after verify: `cache.set(client_short, client_doc)`.
4. `checkClientToken` runs with normalized DID comparisons. Access granted.
5. Subsequent requests use short-form `iss`, resolve via cache, faster.

### Delegated request

1. Bob requests `foo` on server, presenting capability chain `[A→B delegation]`. Bob's request token: `iss=bob_long` (first contact), `sub=bob, aud=serverID, prc=foo, cap=[<jws>]`. A→B delegation token was originally signed by Alice with `iss=alice_long` (her first contact with bob as audience).
2. Server `verifyToken(bob_request, { cache, resolver })` populates `bob_short → bob_doc`.
3. `checkClientToken` → `checkProcedureAccess` → `verifyDelegation` → `checkCapability` → walks `cap`. Calls `verifyToken(A→B, { cache, resolver })` (same cache). Decodes `alice_long`, populates `alice_short → alice_doc`.
4. `assertValidDelegation` compares normalized `from.aud` against `to.iss` etc. Chain validates.
5. Cache now holds both Alice and Bob. Subsequent requests from either with short-form resolve via cache.

### Group join (MLS)

1. Bob's `KeyPackage` carries `SerializedCredential = { did: bob_short, groupID, capabilityChain, longForm: bob_long }`.
2. Alice processes Welcome/Add. `mlsIdentityToSerializedCredential` parses. `decodePeer4(longForm)` + `cache.set` on `groupHandle.cache`.
3. Alice verifies Bob's `capabilityChain` (each entry a JWS) using group cache — same delegation flow as above.
4. Other members process same Commit symmetrically.
5. Application messages signed with short-form `iss` later resolve via group cache.

### Cache miss with resolver

1. Cache miss for `charlie_short`. `resolver(charlie_short)` returns `charlie_doc`.
2. Verify: `encodePeer4(charlie_doc).shortForm === charlie_short` — reject on mismatch.
3. Pick `kid` from doc, return public key.
4. After outer sig verify: `cache.set(charlie_short, charlie_doc)`.

### Rotation

Existing rotation contract unchanged. Old DID's outstanding delegations stay verifiable against cached old doc. New DID is a new short form — no accidental cross-rotation acceptance via normalization (form-folding is per-identifier only).

## Implementation gates

Implementation proceeds in stages with mandatory pass conditions. **If any gate fails, stop and surface — do not move forward.**

### Gate 1 — token layer

1. `resolveIssuer` long-form inline path — unit test.
2. `verifyToken` cache write deferred until after sig verify; bad-sig token does not populate cache — unit test.
3. Bounded LRU cache eviction — unit test.
4. `MultiKeyIdentity.sign` first-per-aud policy + `embedLongForm` override — unit test.
5. `normalizeDID` helper — unit test peer4 long↔short fold, did:key passthrough.

### Gate 2 — capability delegation matrix

Hard gate. Before any server/group code:

- **2a.** Root cap long-form, leaf short-form, single hop → validates, cache populates.
- **2b.** Root short, leaf long.
- **2c.** Multi-hop (3+ levels) with mixed forms at every hop.
- **2d.** Access rule `allow: [alice_short]` matches `iss: alice_long`; reverse also.
- **2e.** Regression: existing did:key delegation tests pass unchanged.
- **2f.** `iss === sub` self-issued short-circuit with normalized peer4: long-`iss` + short-`sub` of same identity → short-circuits. Mixed identities → does not short-circuit even if both are peer4.

Tests live in `packages/capability/test/delegation-peer4.test.ts`. If any cell fails: write finding doc, stop, surface.

### Gate 3 — server wiring

- `EnkakuServer` accepts `cache`, `resolver`; threaded to access-control and outer verify.
- **Audit outer-message signature verification.** If `server.ts` does not currently verify the outer signed message's signature before access-control, surface as critical security finding and halt plan pending separate security work.
- Server integration tests `packages/server/test/peer4-handshake.test.ts`: §2.1 + §2.2 flows over both socket-transport (in-process) and HTTP transport (in-process fetch).

### Gate 4 — group wiring

- `SerializedCredential.longForm`, parse + cache populate.
- `GroupOptions.cache` injection.
- `packages/group/test/peer4-credential.test.ts`: two-member peer4 group join, subsequent short-form app messages verify via cache, mixed peer4 + did:key group works.

## Errors

- `UnknownDID: <shortForm>` — existing, thrown by `resolveIssuer` on cache miss with no resolver / resolver returns undefined.
- `did:peer:4 hash mismatch` — existing, used by inline decode and resolver-path hash check.
- `DIDCache: short form/doc hash mismatch` — existing, enforced on `cache.set`.
- `KidNotFound: <kid>` — existing.
- Span attribute `enkaku.auth.unknown_did: <shortForm>` added for trace visibility on resolver gaps.

## Integration points

| Package | File | Change |
|---|---|---|
| token | `did.ts` | `resolveIssuer` accepts `cache`; long-form inline decode; returns `{ alg, publicKey, peer4Doc? }`. |
| token | `token.ts` | `VerifyTokenOptions.cache`; defer `cache.set` until after sig verify. |
| token | `identity.ts` | `SignOptions.embedLongForm`; identity-internal `sentTo: Set<string>`; auto-policy. |
| token | `cache.ts` | `createInMemoryDIDCache({ maxEntries })` LRU. |
| token | `index.ts` | new export `normalizeDID`. |
| capability | `index.ts` | `DelegationChainOptions.cache`, `.resolver`; thread through `verifyToken`; normalize in `assertValidDelegation`, `checkDelegationChain`, `checkCapability`. |
| server | `server.ts` | `cache`, `resolver` ctor / `handleMessages` params; outer-message verify (subject to Gate 3 audit); thread to `checkClientToken`. |
| server | `access-control.ts` | Normalize `iss/sub/aud` comparisons; normalize allow list. |
| group | `credential.ts` | `SerializedCredential.longForm?`; parser populates cache. |
| group | `group.ts`, `types.ts` | `GroupOptions.cache?`; credential emission embeds `longForm` for peer4 identities. |

## Testing strategy

### Unit tests

Per gate, in the respective package's `test/` directory. Tests scoped to the matrix described under each gate above.

### Integration tests

- `packages/server/test/peer4-handshake.test.ts` — end-to-end client/server over socket-transport and HTTP transport.
- `packages/group/test/peer4-credential.test.ts` — two-member group with peer4 + mixed peer4/did:key.

### Type-level tests

`SignOptions.embedLongForm: boolean | undefined`; `VerifyTokenOptions.cache: DIDCache | undefined`. `MultiKeyIdentity.sentTo` internal (not in public type).

### Build / lint

`pnpm run build`, `pnpm run lint`, `pnpm run test` must pass at end of every gate.

## Out of scope

- Capability-layer refactor of `iss === sub` short-circuit (only normalization touch — no behavioral change unless Gate 2f surfaces a bug, which would be a separate plan).
- Outer-message signature verification implementation if Gate 3 audit finds it missing — that becomes its own security-critical plan.
- Resolver service implementation (interface only here).
- Post-quantum algorithm integration.
- Browser/Expo keystore changes for large keys.
- MLS post-quantum ciphersuites.
- Ledger hardware support.

## References

- DIF Peer DID Method spec, numalgo 4: <https://identity.foundation/peer-did-method-spec/#method-4-short-form-and-long-form>
- Predecessor completion doc: `docs/agents/plans/completed/2026-05-26-did-peer-4-pq-friendly.complete.md`
- Source backlog entry: `docs/agents/plans/next/did-peer-4-transport-integration.md`
