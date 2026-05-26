# did:peer:4 transport integration

**Priority:** next
**Predecessor:** [did:peer:4 PQ-friendly identifiers](../completed/2026-05-26-did-peer-4-pq-friendly.complete.md)

## Goal

Wire the `did:peer:4` contracts shipped in `@enkaku/token` (resolver + content-addressed cache) into the transport and group layers so that short-form DIDs can actually be exchanged and verified between peers.

## Scope

- **`@enkaku/server` HTTP transport.** Add an identity-exchange header (e.g. `X-Enkaku-Identity`) carrying each side's long-form DID on first contact. Populate a `DIDCache` instance on the server; allow callers to inject one. Subsequent requests carry short-form `iss` only.
- **`@enkaku/server` WebSocket transport.** Same idea, via the initial WS frame (`{ identity: longForm }`).
- **`@enkaku/group` MLS integration.** Carry the long-form DID inside the `BasicCredential` payload (or a custom credential type) so members learn each other's long form as a side effect of MLS Welcome/Commit processing. Populate the verifier cache during MLS state advancement.
- **Cache wiring.** Provide a default cache per server instance and per group instance; allow injection.
- **End-to-end tests.** `packages/server/test/peer4-handshake.test.ts` and `packages/group/test/peer4-credential.test.ts` (referenced in the original spec, deferred from the foundation plan).

## Out of scope

- PQ algorithm integration (separate follow-up).
- Adapting `MultiKeyIdentity` to the existing `SigningIdentity` interface — needed if the new builder is to replace the older identity factories in transport code. Decide once during this work.

## Open questions

- Spec said `did:peer:4` verifiers fall back to the first `authentication` entry when no `kid` is present in the header. Token-layer implementation does this. Make sure transport-emitted tokens still set `kid` explicitly where it matters (e.g. when more than one authentication key exists).
- Should the server expose `UnknownDID` errors back to the client so the client can re-send the long form, or should clients always send the long form on first request per session? Decide based on transport semantics.
