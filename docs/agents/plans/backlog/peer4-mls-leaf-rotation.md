# peer4 MLS leaf credential rotation

**Priority:** backlog
**Status:** blocked on ts-mls — see Blocker.
**Predecessor:** [did:peer:4 MLS authentication service binding](../completed/2026-05-27-did-peer-4-mls-auth-service.complete.md)

## Blocker

ts-mls (as of 2026-05-27) does not export `signLeafNodeUpdate` — only `signLeafNodeCommit` and `signLeafNodeKeyPackage`. Building a `LeafNodeUpdate` requires the same `signWithLabel("LeafNodeTBS", ...)` operation, but the public surface omits it. Paths forward when revisiting:

1. File an issue / PR upstream to expose `signLeafNodeUpdate` (and `signWithLabel`).
2. Vendor a small internal sign helper inside `@enkaku/group`. Risk: TBS encoding tied to ts-mls internals; needs version pin + compat test.
3. Implement rotation via Remove + Add. Loses tree-level continuity; doesn't work for single-member groups.

Defer until path 1 lands or paths 2/3 are acceptable.

## Goal

Allow a peer4 member to rotate their identity (new keypair → new short form / longForm) without leaving and rejoining the group. Today an identity change requires Remove + external rejoin; native MLS Update proposal isn't wired for credential changes.

## Scope

- **`proposeUpdate(group, newIdentity, options?)`** — wraps `ts-mls` Update proposal. New `LeafNode` carries `makeMLSCredential(newIdentity)` and a new signature key, signed by the old leaf's sig key (continuity proof at the MLS layer).
- **Capability continuity** — old identity issues a rotation token via `@enkaku/token`'s existing `createRotationAssertion(oldIdentity, newIdentity)`. New `MemberCredential.capabilityChain` extends with the rotation token. Existing group admins must accept the chain.
- **`processMessage`** — on receipt of an Update commit, pre-populate the cache with the new peer4 doc via `populateCacheFromCredential`. Auth service unchanged (each leaf is validated against its own credential).
- **`findMemberLeafIndex(oldID)` post-rotation** — returns `undefined` (the leaf now binds to the new id). Optional `findMemberLeafIndex(newID)` works as expected.

## Open questions

- Does ts-mls's Update proposal API support credential changes, or only signature-key changes? If only sig-key, peer4 rotation must go through Remove + Add (worse ergonomics).
- Should rotation be allowed for any member, or only `admin` permission? RFC 9420 places no restriction; access control is application-defined. Reasonable default: any member can rotate themselves; admins can rotate anyone (TBD).
- Cache write-after-verify: when receiving an Update commit, write the new peer4 doc to cache only after the commit's signature verifies.

## Out of scope

- Identity revocation / key compromise recovery (separate flow).
- Rotating between peer4 and did:key.
- Post-quantum ciphersuites.

## Test plan sketch

- Single-key peer4 self-rotation: alice rotates; bob receives the Update; alice's new key signs subsequent messages.
- Multi-sig peer4: rotate the primary sig key while preserving a secondary.
- Concurrent rotation: two members rotate at the same epoch; one commit wins, the other rebases.
- Rotation across cached resolver state.
