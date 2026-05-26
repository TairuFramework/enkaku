# Critical: server outer-message signature is not verified

**Branch:** feat/peer4-propagation
**Auditor task:** Task 3.1, did:peer:4 transport integration plan
**Date:** 2026-05-26

## Reproduction sketch

Build a SignedToken-shaped message with valid header.alg = 'EdDSA', valid payload structure (iss, aud=serverID, prc=allowed), but with a tampered signature. Send it through `EnkakuServer.handleMessages`. Observe whether the server rejects it at any pre-handler stage.

## Expected behavior

Rejection at a signature-verification boundary BEFORE access-control. EK02 (or similar auth error) propagated to the client.

## Observed behavior (from code audit)

In `packages/server/src/server.ts`, the authenticated path of the `process` closure (lines 428-496) does the following when `params.requireAuth === true`:

1. **Line 437**: `isSignedToken(message as Token)` — this is a pure structural check from `@enkaku/token`. It confirms `header.alg` is set, `header.typ === 'JWT'`, `payload.iss` is a string, and `message.signature != null`. It does **not** verify the cryptographic integrity of the signature against the public key of the claimed issuer.

2. **Lines 442-447**: `checkClientToken(params.serverID, params.access, message, { verifyToken: params.verifyToken })` — this function (in `packages/server/src/access-control.ts`, lines 116-149) checks audience (`payload.aud === serverID`), expiration (`assertNonExpired`), and procedure access rules. For delegated tokens with a `cap` array it calls `checkCapability()` (from `@enkaku/capability`) which in turn calls `verifyToken()` from `@enkaku/token` on each **capability chain element**. The `verifyToken` hook passed via `params.verifyToken` is an after-verification hook for revocation, not the cryptographic verifier.

At no point in this chain is `verifyToken()` (the cryptographic signature verification function from `@enkaku/token`) called on the **outer message token** itself. The server trusts whatever `iss` appears in the message payload so long as the shape is valid and the access rules allow that DID.

## Impact

Any party that knows the protocol shape can forge a signed-looking message asserting any iss/sub/aud and access procedures the server's access rules grant to those DIDs. This nullifies the auth model. Concretely:

- An unauthenticated attacker who knows a whitelisted DID can impersonate it.
- Access rules using `allow: ['did:key:...']` provide no cryptographic guarantee that the sender controls that DID.
- The `verifyToken` hook mechanism exists and is wired through the capability chain but is never invoked for the outer message, suggesting this was either an oversight or a now-broken layering assumption (e.g. that a transport-level verifier would handle it upstream — but no such verifier was found in `packages/transport/`, `packages/runtime/`, `packages/message-transport/`, or `packages/protocol/`).

## Recommended fix scope

Add a `verifyToken(rawMessage, { cache, resolver })` invocation in `packages/server/src/server.ts` in the authenticated `process` closure, after the `isSignedToken` structural check and before `checkClientToken`. The raw serialized form of the outer message must be available for signature verification (JWS compact serialization or equivalent). Investigate whether the transport layer discards the raw bytes before the server sees the message — if so, the fix must be coordinated with the transport layer.

## Action

Halt did:peer:4 transport integration plan pending dedicated security work. Gate 3 cannot proceed until outer-signature verification is wired.
