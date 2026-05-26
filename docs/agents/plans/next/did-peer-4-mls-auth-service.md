# did:peer:4 MLS authentication service binding

**Priority:** next
**Predecessor:** [did:peer:4 transport integration](../completed/2026-05-26-did-peer-4-transport-integration.complete.md)

## Goal

Enable did:peer:4 identities to participate as full MLS group members. Currently `@enkaku/group` supports peer4 only at the capability-token level (credential JSON parsing + cache-threaded capability checks); MLS leaf-node credential binding remains did:key-only.

## Scope

- **`createDIDAuthenticationService(options?: { cache?: DIDCache, resolver?: DIDResolver })`** — when validating an MLS basic credential whose `identity` payload is a peer4-format `SerializedCredential` (JSON with `longForm` or `did:peer:4z...` short form), look up the doc (long-form decoded inline, short-form via cache → resolver), find the verification method that matches the MLS leaf's `signaturePublicKey`, and return `true`/`false`. Hash binding enforced for any resolver-returned docs.
- **`makeMLSCredential(identity, longForm?)`** — when identity is peer4, emit JSON-format basic credential bytes (a `SerializedCredential` skeleton with `longForm`) so the auth service can find the doc. did:key path unchanged.
- **`createGroup`, `createKeyPackageBundle`, `joinGroupExternal`** — pass `longForm` to `makeMLSCredential` when the local identity is peer4.
- **Design decision:** which verification method binds the MLS leaf when a peer4 identity has multiple sig keys? Likely the one matching the MLS leaf's signature key bytes; document the contract.
- **Test:** two-member peer4 group join via Welcome / Commit; mixed peer4 + did:key group; peer4 leaf with multiple sig keys.

## Out of scope

- PQ ciphersuites.
- Migrating existing groups from did:key to peer4 (one-way; we only add peer4 as a new option).
- Ledger hardware support.

## Open questions

- For multi-sig-key peer4 identities, does the MLS leaf bind to a specific `kid`? Likely yes — record `kid` in the credential JSON, auth service uses it to pick the verification method.
- How do existing groups discover that a new member can join via peer4? KeyPackage advertises the credential format; receiver inspects.
- Interaction with rotation: when a peer4 member rotates (new short form), MLS Update proposal carries the new credential; auth service binds to new key.
