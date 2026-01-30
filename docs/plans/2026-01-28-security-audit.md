# Security Audit Report - Enkaku v1 Hardening

**Date:** 2026-01-28
**Purpose:** Comprehensive security audit for v1 release
**Scope:** All packages - security, coverage gaps, performance improvements

**Resolved via implementation plans (archived):**
- Token expiration validation (C-01, H-01) — `docs/plans/archive/2026-01-28-token-expiration-validation.md`
- Capability authorization hardening (C-02, C-03, H-04, M-04) — `docs/plans/archive/2026-01-28-capability-authorization.md`
- Server resource limits (C-05, C-06, C-07, H-13, H-14, H-15, M-10, M-11, M-12) — `docs/plans/archive/2026-01-28-server-resource-limits.md`
- Input validation hardening (H-02, H-07, H-08, H-12, H-16, H-18) — `docs/plans/archive/2026-01-30-input-validation-hardening.md`
- HTTP server transport hardening (C-08, C-09, H-09, H-10) — `docs/plans/archive/2026-01-30-http-transport-hardening.complete.md`

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 12 | 8 Fixed (C-01, C-02, C-03, C-05, C-06, C-07, C-08, C-09), 1 Won't Fix (C-12) |
| HIGH | 18 | 13 Fixed (H-01, H-02, H-04, H-07, H-08, H-09, H-10, H-12, H-13, H-14, H-15, H-16, H-18), 1 Partial (T-01) |
| MEDIUM | 14 | 4 Fixed (M-04, M-11, M-12), 1 Mitigated (M-10) |
| LOW | 3 | Pending |

---

## Critical Issues

### C-01: Token Expiration Not Validated
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/token.ts:94-146`
- **File:** `packages/token/src/schemas.ts:62-80`
- **Status:** [x] Fixed — Branch `claude/token-expiration-validation-Bcct6`, commit `4f79228`
- **Plan:** `docs/plans/2026-01-28-token-expiration-validation.md`

**Description:**
The `verifyToken()` function accepts `exp` (expiration), `nbf` (not before), and `iat` (issued at) claims in the token schema but never validates them. These fields are defined as optional numeric fields but there is no code path that checks if a token has expired or is used before its valid period.

**Impact:**
Tokens can be used indefinitely even after their expiration time. This breaks the security model for short-lived credentials.

**Recommendation:**
```typescript
if (payload.exp != null && payload.exp < Date.now() / 1000) {
  throw new Error('Token expired')
}
if (payload.nbf != null && payload.nbf > Date.now() / 1000) {
  throw new Error('Token not yet valid')
}
```

---

### C-02: Capability Authorization Bypass When iss === sub
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts:179-182`
- **Status:** [x] Fixed — Branch `claude/implement-capability-authorization-b65WS`, commit `e88ca19`
- **Plan:** `docs/plans/2026-01-28-capability-authorization.md`

**Description:**
In `checkCapability()`, when `payload.iss === payload.sub`, the function returns after only checking expiration without validating the requested permission against the token's actual `act` and `res` claims.

**Impact:**
A self-issued token can claim any action/resource without validation. Attacker can fabricate tokens granting themselves arbitrary permissions.

**Recommendation:**
Always validate the requested permission against the token, even for self-issued tokens.

---

### C-03: createCapability() Lacks Authorization Checks
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts:67-76`
- **Status:** [x] Fixed — Branch `claude/implement-capability-authorization-b65WS`, commit `0233141`
- **Plan:** `docs/plans/2026-01-28-capability-authorization.md`

**Description:**
`createCapability()` performs zero authorization checks. Any caller can create a capability with any `aud`, `sub`, `act`, `res` values. No verification that the signer actually has permission to delegate those capabilities.

**Impact:**
Attacker can fabricate capabilities claiming delegation without consent.

**Recommendation:**
Verify signer has authority to delegate requested permissions before creating capability.

---

### C-04: No Capability Revocation Mechanism
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts` (entire file)
- **Status:** [ ] Not Started

**Description:**
There is no revocation mechanism for capabilities. Once issued, a capability cannot be revoked early, must wait for natural expiration, has no `jti` (JWT ID) based revocation list support.

**Impact:**
If a capability token is stolen, it remains valid until `exp` regardless of actual compromise.

**Recommendation:**
Implement `jti`-based revocation list or add a revocation callback mechanism.

---

### C-05: Unbounded Controller Storage (Server DoS)
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:58`
- **Status:** [x] Fixed — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md` (Tasks 1-3, 5, 7)

**Description:**
Controllers stored indefinitely in `Record<string, HandlerController>` until message completion. No TTL, no max count, no cleanup for orphaned requests. Client IDs (`rid`) are user-controlled.

**Impact:**
Send many requests without completing → unbounded memory growth → server crash.

**Fix Applied:**
- `ResourceLimiter` enforces `maxControllers` limit (default: 10,000) — excess requests rejected with EK03
- Controller timeout tracking with periodic cleanup — expired controllers rejected with EK05
- `cleanupTimeoutMs` ensures server dispose completes even with stuck handlers

---

### C-06: No Concurrent Handler Limits
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:101-119`
- **Status:** [x] Fixed — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md` (Tasks 4, 5)

**Description:**
No queue, no worker limit, no semaphore. Single transport can spawn unlimited concurrent handlers. No backpressure on writes.

**Impact:**
Create 1000 long-running channels → thread/memory exhaustion.

**Fix Applied:**
- `ResourceLimiter` enforces `maxConcurrentHandlers` limit (default: 100) via acquire/release semaphore
- Excess requests rejected with EK04 error

---

### C-07: Channel Send Messages Skip Authorization
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:179-182`
- **Status:** [x] Fixed — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md` (Task 6)

**Description:**
`send` message type (channel data from client) does NOT go through access control. Once a channel is established, client can send unlimited data without re-authorization. Code: `case 'send': { controller?.writer.write(msg.payload.val); break; }` - no validation, no authorization check.

**Impact:**
Authorization bypass for all channel communications after initial handshake.

**Fix Applied:**
- In non-public mode, channel `send` messages must be signed and pass `checkClientToken` validation
- Unsigned sends in non-public mode rejected with EK02 error

---

### C-08: Session Resource Exhaustion (HTTP Transport)
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:45-46, 149-169`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-http-transport-hardening.complete.md` (Task 1)

**Description:**
Unbounded session creation with no limits. Sessions stored in Map with no expiration or cleanup mechanism except on client abort. No rate limiting on session creation.

**Impact:**
Slowloris attack variant - create unlimited sessions, exhaust server memory.

**Fix Applied:**
- `maxSessions` option (default: 1,000) enforces session creation limit — excess requests rejected with 503
- `sessionTimeoutMs` option (default: 5 minutes) with periodic cleanup of expired sessions
- SSE connect refreshes session timeout; expired sessions have their SSE controllers closed

---

### C-09: Inflight Request Exhaustion (HTTP Transport)
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:45-46`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-http-transport-hardening.complete.md` (Task 2)

**Description:**
Unbounded inflight request tracking. Entries deleted only when responses arrive. No cleanup for abandoned requests.

**Impact:**
Inflight requests accumulate if responses never arrive → memory exhaustion.

**Fix Applied:**
- `maxInflightRequests` option (default: 10,000) enforces inflight request limit — excess requests rejected with 503
- `requestTimeoutMs` option (default: 30 seconds) auto-resolves timed-out requests with 504 and cleans up inflight/timer maps
- Normal responses clear their associated timeout timer

---

### C-10: No TLS/HTTPS Enforcement (HTTP Transport)
- **Package:** `@enkaku/http-server-transport`, `@enkaku/http-client-transport`
- **File:** `packages/http-server-transport/src/index.ts:1-266`
- **File:** `packages/http-client-transport/src/index.ts:1-182`
- **Status:** [ ] Not Started

**Description:**
HTTP transport packages use standard Fetch API with no built-in HTTPS/TLS enforcement. No certificate validation options provided.

**Impact:**
Man-in-the-middle attacks, credential interception, message tampering.

**Recommendation:**
Enforce HTTPS in production, provide certificate validation options.

---

### C-11: Socket Transport Has No TLS Support
- **Package:** `@enkaku/socket-transport`
- **File:** `packages/socket-transport/src/index.ts:13, 21`
- **Status:** [ ] Not Started

**Description:**
Uses only `node:net` module, no TLS option available. Only IPC sockets supported.

**Impact:**
Unencrypted communication over network sockets, credential exposure.

**Recommendation:**
Support TLS connections via `node:tls.connect()`, add security options.

---

### C-12: Browser Keystore Stores Keys Unencrypted
- **Package:** `@enkaku/browser-keystore`
- **File:** `packages/browser-keystore/src/store.ts:36-41`
- **Status:** [—] Won't Fix
- **Severity downgraded:** CRITICAL → Informational

**Description:**
Uses IndexedDB for storage. IndexedDB data is NOT encrypted in browsers. Keys stored as `CryptoKeyPair` objects directly.

**Original recommendation:**
Implement key encryption using `crypto.subtle.wrapKey()` before IndexedDB storage.

**Rationale for won't-fix:**
The original analysis overstates the impact. Keys are generated with `extractable: false`, which means:

1. **Raw private key bytes cannot be extracted.** `exportKey()` and `wrapKey()` both throw `InvalidAccessError` on non-extractable keys. No JavaScript code — including XSS — can read the private key material.
2. **CryptoKeyPair in IndexedDB is a handle, not raw key data.** The actual key material lives in the browser's crypto engine, not in JS-accessible memory. An offline IndexedDB dump yields an opaque object, not usable key bytes.
3. **Wrapping would reduce security.** `wrapKey()` requires `extractable: true` at generation time, meaning the private key bytes would be accessible during key creation and after every unwrap. This is strictly weaker than the current non-extractable approach.
4. **Wrapping key storage has no viable secure location.** The wrapping key would also reside in IndexedDB (or be derived from same-origin-accessible data), so an XSS attacker who can read IndexedDB can unwrap and use the key — identical to the current threat.

**Remaining risk:** An XSS attacker can read the CryptoKeyPair handle from IndexedDB and call `crypto.subtle.sign()` with it. This is an inherent limitation of any browser-based key storage — the Web Crypto API with non-extractable keys is the strongest protection browsers offer. This is the same security model used by WebAuthn/FIDO2.

**Actual recommendation:** Add unit tests for the browser-keystore package (see T-05) and document the security model.

---

## High Severity Issues

### H-01: Malformed Token Parsing (Array Bounds)
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/token.ts:113`
- **Status:** [x] Fixed — Branch `claude/token-expiration-validation-Bcct6`, commit `f3a024a`
- **Plan:** `docs/plans/2026-01-28-token-expiration-validation.md` (Task 1)

**Description:**
JWT string parsing uses array destructuring without bounds checking: `const [encodedHeader, encodedPayload, signature] = token.split('.')`. Tokens with fewer or more parts silently produce undefined values.

**Recommendation:**
```typescript
const parts = token.split('.')
if (parts.length !== 3) {
  throw new Error('Invalid token format: expected 3 parts separated by dots')
}
```

---

### H-02: Codec Comparison Missing Bounds Check
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/did.ts:13-20`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-input-validation-hardening.md` (Task 1)

**Description:**
`isCodecMatch()` function accesses `bytes[i]` where `i >= bytes.length` when `bytes` is shorter than `codec.length`, returning `undefined`.

**Recommendation:**
```typescript
function isCodecMatch(codec: Uint8Array, bytes: Uint8Array): boolean {
  if (bytes.length < codec.length) return false
  // ... rest of comparison
}
```

---

### H-03: No Cryptographic Binding to Caller Identity
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts:169-199`
- **Status:** [ ] Not Started

**Description:**
The final token in capability chain doesn't have to match the entity actually performing the action. No binding between who is calling `checkCapability()` and who the token was issued to.

**Impact:**
Token replay attacks - token issued to user B can be replayed by any third party.

**Recommendation:**
Require the caller identity in capability checks.

---

### H-04: Unbounded Delegation Chain Depth (DoS)
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts:149-167`
- **Status:** [x] Fixed — Branch `claude/implement-capability-authorization-b65WS`, commit `76a461e`
- **Plan:** `docs/plans/2026-01-28-capability-authorization.md`

**Description:**
`checkDelegationChain()` has no length limit on the capabilities array. Recursive calls are unbounded.

**Impact:**
Stack overflow via deep recursion, DoS by making validation extremely slow.

**Recommendation:**
Add depth limits: `const MAX_DELEGATION_DEPTH = 20`

---

### H-05: Missing Payload Size Constraints (Protocol DoS)
- **Package:** `@enkaku/protocol`
- **File:** `packages/protocol/src/schemas/client.ts:14-24, 47-57, 73-90, 120-137`
- **File:** `packages/protocol/src/schemas/server.ts:13-25, 33-49, 52-70, 73-87`
- **Status:** [ ] Not Started

**Description:**
No `maxLength`, `maxItems`, or `maxProperties` constraints defined on string, array, or object payloads. Attacker can send arbitrarily large strings in message fields.

**Impact:**
Memory exhaustion during JSON parsing, parser DoS.

**Recommendation:**
Add `maxLength` constraints to all string fields (1KB for protocol fields, 10KB for data fields).

---

### H-06: additionalProperties: true Allows Arbitrary Fields
- **Package:** `@enkaku/protocol`
- **File:** `packages/protocol/src/schemas/client.ts:14, 23, 42, 56, 88, 103, 135`
- **Status:** [ ] Not Started

**Description:**
Message payload schemas allow `additionalProperties: true`, permitting any additional fields in protocol messages.

**Impact:**
Arbitrary fields can carry hidden data, message size grows unboundedly.

**Recommendation:**
Change all message payload schemas to `additionalProperties: false`.

---

### H-07: Unsafe Reference Resolution (Prototype Pollution Risk)
- **Package:** `@enkaku/schema`
- **File:** `packages/schema/src/utils.ts:3-20`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-input-validation-hardening.md` (Task 2)

**Description:**
`resolveReference()` has no `__proto__` / `constructor` / `prototype` filtering. Unbounded traversal depth. No validation that resolved schema is actually a Schema.

**Recommendation:**
```typescript
if (['__proto__', 'constructor', 'prototype'].includes(segment)) {
  throw new Error('Invalid reference segment')
}
```

---

### H-08: JSON.parse() Without Depth Limits
- **Package:** `@enkaku/codec`
- **File:** `packages/codec/src/index.ts:90`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-input-validation-hardening.md` (Task 3)

**Description:**
`b64uToJSON()` uses `JSON.parse()` without any depth or size limits. Vulnerable to stack exhaustion from deeply nested objects.

**Impact:**
Stack overflow from 10,000+ level nesting.

**Recommendation:**
Implement custom JSON parser with depth limits: `MAX_DEPTH = 100`.

---

### H-09: No Request Timeout (HTTP Transport)
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:198-204`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-http-transport-hardening.complete.md` (Task 2)

**Description:**
Requests wait indefinitely for responses. If handler never responds, request hangs forever.

**Fix Applied:**
- `requestTimeoutMs` option (default: 30 seconds) applies a per-request timeout — timed-out requests resolve with 504 `{ error: 'Request timeout' }`
- Timer cleared on normal response arrival

---

### H-10: Header Injection via Origin Reflection
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:108-126`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-http-transport-hardening.complete.md` (Task 3)

**Description:**
Origin header is directly reflected back in CORS responses without validation. If `allowedOrigins` includes '*', any origin is accepted and reflected.

**Impact:**
HTTP Header Injection, cache poisoning.

**Fix Applied:**
- `isValidOrigin()` helper validates origin by parsing with `new URL()` and checking for http:/https: scheme
- Invalid origins in wildcard mode rejected with 403
- Non-http/https schemes (e.g., `javascript:`) rejected

---

### H-11: No Message Sequence Validation
- **Package:** `@enkaku/http-server-transport`, `@enkaku/http-client-transport`
- **File:** `packages/http-server-transport/src/index.ts:48-87`
- **Status:** [ ] Not Started

**Description:**
No sequence numbers or message ordering guarantees. Messages identified only by `rid`. Duplicate RIDs could overwrite previous entries.

**Impact:**
Message duplication, replay attacks, out-of-order execution.

**Recommendation:**
Add message sequence numbers, implement deduplication.

---

### H-12: No Input Validation on Message Payload Type
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:190-217`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-input-validation-hardening.md` (Task 6)

**Description:**
Payload type (`typ` field) validated only via switch statement. Type is user-controlled string from JSON.

**Recommendation:**
Use enum or const validation, strict type checking.

---

### H-13: Unbounded Stream Buffer
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/handlers/stream.ts:34-50`
- **Status:** [x] Fixed — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md` (Task 10)

**Description:**
`receiveStream.writable` has no backpressure handling. Handler can write unlimited data to stream.

**Impact:**
Handler sends gigabytes of data before client reads → memory exhaustion.

**Fix Applied:**
- Per-message size check (`maxMessageSize`, default 10 MB) applied to all incoming client messages in `handleMessages` before dispatch
- Oversized messages rejected with EK06 error before reaching any handler

---

### H-14: Unbounded Channel Buffer
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/handlers/channel.ts:40-76`
- **Status:** [x] Fixed — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md` (Task 10)

**Description:**
Both send and receive streams lack explicit buffer limits.

**Impact:**
Client sends 1MB+ messages repeatedly → memory exhaustion.

**Fix Applied:**
- Per-message size check (`maxMessageSize`) applied to all incoming client messages including channel init and send messages
- Oversized messages rejected with EK06 error before reaching handlers

---

### H-15: Event Handlers Skip Authorization Response
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:141-145`
- **Status:** [x] Fixed — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md` (Task 12)

**Description:**
When authorization fails for events, only `events.emit('handlerError')` is called. Clients receive no indication that their event was rejected.

**Fix Applied:**
- Server now emits `eventAuthError` event when event authorization fails, in addition to `handlerError`
- Allows monitoring/logging of event auth failures

---

### H-16: Handler Error Messages Sent to Clients
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/utils.ts:40`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-input-validation-hardening.md` (Task 4)

**Description:**
Raw error message from handler exception sent in response payload. Developers might include sensitive info in error messages.

**Recommendation:**
Return generic "Handler execution failed" to clients, log detailed errors server-side.

---

### H-17: Conditional Authentication Bypass (Public Mode)
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:121`
- **Status:** [ ] Not Started

**Description:**
When `params.public = true`, the entire authentication check is skipped. ALL message types bypass access control in public mode.

---

### H-18: No Payload Size Limits (Stream JSON Lines)
- **Package:** `@enkaku/stream`
- **File:** `packages/stream/src/json-lines.ts:63-102`
- **Status:** [x] Fixed — Branch `main`
- **Plan:** `docs/plans/archive/2026-01-30-input-validation-hardening.md` (Task 5)

**Description:**
No buffer size limits in JSON parsing. Accumulates chunks indefinitely.

**Impact:**
Large message attack - send million-line JSON, crash parser.

**Recommendation:**
Implement max buffer size (e.g., 10MB), reject oversized messages.

---

## Medium Severity Issues

### M-01: Information Disclosure in Error Messages (Token)
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/did.ts:47-53`
- **File:** `packages/token/src/signer.ts:41, 51`
- **File:** `packages/token/src/token.ts:117, 145`
- **Status:** [ ] Not Started

**Description:**
Error messages expose the full DID string, issuer, and algorithm choices to potential attackers.

**Recommendation:**
Use generic error messages in security-sensitive contexts.

---

### M-02: No Public Key Size Validation
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/verifier.ts:18-23`
- **Status:** [ ] Not Started

**Description:**
Verifiers accept arbitrary-length public keys without validation.

---

### M-03: Base64URL Padding Not Validated
- **Package:** `@enkaku/codec`
- **File:** `packages/codec/src/index.ts:47-48`
- **Status:** [ ] Not Started

**Description:**
`fromB64U()` silently strips whitespace and accepts non-standard formatting.

**Recommendation:**
Add strict validation: `if (!/^[A-Za-z0-9_-]*$/.test(base64url)) throw Error`

---

### M-04: Incomplete Capability Token Type Checking
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts:45-55`
- **Status:** [x] Fixed — Branch `claude/implement-capability-authorization-b65WS`, commit `54ff100`
- **Plan:** `docs/plans/2026-01-28-capability-authorization.md`

**Description:**
Type checking only validates presence, not format. `aud`, `sub`, `act`, `res` can be any truthy value.

---

### M-05: TOCTOU Race in Expiration Checks
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts:178`
- **Status:** [ ] Not Started

**Description:**
When `atTime` is not provided, time passes between expiration check and capability use.

**Recommendation:**
Always require explicit `atTime` parameter from caller.

---

### M-06: No Validation of Resource/Action Patterns
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts:78-95`
- **Status:** [ ] Not Started

**Description:**
No whitelist/validation of resource naming patterns. Allows suspicious patterns like `'../../../'`.

---

### M-07: useDefaults: true in AJV (Schema)
- **Package:** `@enkaku/schema`
- **File:** `packages/schema/src/validation.ts:9`
- **Status:** [ ] Not Started

**Description:**
AJV configured with `useDefaults: true`, causing mutation of input objects and implicit type coercion.

**Recommendation:**
Set `useDefaults: false`.

---

### M-08: Schema Structure Exposure in Error Objects
- **Package:** `@enkaku/schema`
- **File:** `packages/schema/src/errors.ts:14-27`
- **Status:** [ ] Not Started

**Description:**
`details` getter returns raw AJV `ErrorObject` which contains keyword, schemaPath, and params.

**Recommendation:**
Limit exposure of `details` getter, filter `schemaPath` from public errors.

---

### M-09: Wildcard CORS Default
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:42-44`
- **Status:** [ ] Not Started

**Description:**
Default allows all origins if no `allowedOrigin` specified.

**Recommendation:**
Default to same-origin only, require explicit allowedOrigin configuration.

---

### M-10: Validation is Optional (Server)
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:265-267`
- **Status:** [~] Mitigated — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md` (Task 11)

**Description:**
When `params.protocol != null` check - validation is not mandatory. All input validation skipped if protocol not provided.

**Mitigation Applied:**
- Server now logs a warning via `logger.warn()` when created without a protocol, alerting developers that message validation is disabled

---

### M-11: Stream Not Closed on Handler Crash
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/handlers/stream.ts:34-50`
- **Status:** [x] Fixed — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md` (Task 9)

**Description:**
If handler crashes, stream stays open. Potential resource leak.

**Fix Applied:**
- Stream and channel handlers now wrap execution in try/finally to close `receiveStream.writable` on handler completion or error

---

### M-12: No Cleanup Timeout on Server Dispose
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:228-239`
- **Status:** [x] Fixed — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md` (Task 8)

**Description:**
When server disposes, if handler ignores abort signal and takes 10 seconds, server waits 10 seconds. No timeout on cleanup.

**Fix Applied:**
- Server dispose now races graceful cleanup against `cleanupTimeoutMs` (default: 30s)
- Force-disposes remaining transports if timeout elapses

---

### M-13: Socket Buffer No Backpressure
- **Package:** `@enkaku/socket-transport`
- **File:** `packages/socket-transport/src/index.ts:38-45`
- **Status:** [ ] Not Started

**Description:**
No backpressure handling. Could buffer unlimited data in memory.

---

### M-14: No Memory Clearing in All Keystores
- **Package:** `@enkaku/node-keystore`, `@enkaku/browser-keystore`, `@enkaku/expo-keystore`, `@enkaku/electron-keystore`
- **Status:** [ ] Not Started

**Description:**
Keys remain in memory throughout application lifetime. No clearing after key is used. Vulnerable to process memory dump attacks.

---

## Low Severity Issues

### L-01: Weak DID Codec Uniqueness
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/did.ts:6-9`
- **Status:** [ ] Not Started

**Description:**
Codec values are only 2 bytes. Unlikely collision in practice due to different key lengths.

---

### L-02: Missing Algorithm Constant Validation
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/signer.ts:21-24`
- **Status:** [ ] Not Started

**Description:**
`getSigner()` hardcodes algorithm as 'EdDSA' without validating key is actually valid for Ed25519.

---

### L-03: Missing iat Validation
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts:36`
- **Status:** [ ] Not Started

**Description:**
`iat` is optional and never validated (no check for `iat > now()`).

---

## Breaking Changes Recommended

The following fixes will require breaking changes:

1. **C-01, C-02, C-03, C-04**: Token/capability API changes for proper validation
2. **C-05, C-06, C-07**: Server API changes for resource limits and authorization
3. **H-05, H-06**: Protocol schema changes (additionalProperties, maxLength)
4. **C-12**: Browser keystore storage format change (encrypted keys)

---

## Phase 2: Test Coverage Gaps

### Coverage Summary by Package

| Package | Test Files | Coverage | Critical Gaps |
|---------|-----------|----------|---------------|
| `@enkaku/token` | 3 | ~40% | 8 error paths untested (3 tested: H-02) |
| `@enkaku/capability` | 1 | ~90% | Auth bypass fixed and tested (C-02, C-03, H-04, M-04) |
| `@enkaku/client` | 1 | ~70% | Memory leak paths untested |
| `@enkaku/server` | 16 | ~85% | Resource limits tested (C-05, C-06, C-07, H-13, H-14, H-15, M-10, M-11, M-12) |
| `@enkaku/http-server-transport` | 4 | ~60% | Session limits, inflight limits, origin validation tested (C-08, C-09, H-09, H-10) |
| `@enkaku/http-client-transport` | 0 | 0% | **NO TESTS** |
| `@enkaku/socket-transport` | 0 | 0% | **NO TESTS** |
| `@enkaku/message-transport` | 0 | 0% | **NO TESTS** |
| `@enkaku/node-streams-transport` | 1 | ~20% | Error paths untested |
| `@enkaku/schema` | 2 | ~40% | Reference resolution tested (H-07) |
| `@enkaku/protocol` | 1 | ~20% | Size constraints untested (H-05) |
| `@enkaku/node-keystore` | 0 | 0% | **NO TESTS** |
| `@enkaku/browser-keystore` | 0 | 0% | **NO TESTS** |
| `@enkaku/expo-keystore` | 0 | 0% | **NO TESTS** |
| `@enkaku/electron-keystore` | 0 | 0% | **NO TESTS** |
| `@enkaku/codec` | 1 | ~70% | Depth limits tested (H-08) |
| `@enkaku/stream` | 4 | ~75% | Size limits tested (H-18) |
| `@enkaku/async` | 4 | ~85% | Good coverage |
| `@enkaku/result` | 3 | ~90% | Excellent coverage |
| `@enkaku/event` | 1 | ~65% | Error handling untested |
| `@enkaku/execution` | 1 | ~60% | Chain cleanup untested |

---

### T-01: Token Package - Missing Error Path Tests
- **Package:** `@enkaku/token`
- **Priority:** HIGH
- **Status:** Partially fixed — Malformed JWT, time validation, and DID error paths now tested. Remaining error paths still need coverage.
- **Plan:** `docs/plans/2026-01-28-token-expiration-validation.md` (Tasks 1, 3, 4, 6), `docs/plans/archive/2026-01-30-input-validation-hardening.md` (Task 1)

**Error Paths:**
| Function | Location | Error Case | Status |
|----------|----------|------------|--------|
| `verifyToken()` | token.ts:113 | Malformed JWT (not 3 parts) | TESTED (H-01) |
| `verifyToken()` | token.ts | Token expired (exp) | TESTED (C-01) |
| `verifyToken()` | token.ts | Token not yet valid (nbf) | TESTED (C-01) |
| `verifyToken()` | token.ts:116-118 | Invalid header type | Untested |
| `verifyToken()` | token.ts:124-126 | Missing signature | Untested |
| `verifyToken()` | token.ts:145 | Unsupported algorithm | Untested |
| `verifySignedPayload()` | token.ts:31-32 | Invalid signature | Untested |
| `getSignatureInfo()` | did.ts:47 | Invalid DID prefix | TESTED (H-02) |
| `getSignatureInfo()` | did.ts:53 | Unsupported codec | TESTED (H-02) |
| `isCodecMatch()` | did.ts:13-20 | Bytes shorter than codec | TESTED (H-02) |
| `signToken()` | signer.ts:50-52 | Issuer mismatch | Untested |
| `toTokenSigner()` | signer.ts:39-42 | Unsupported algorithm | Untested |
| `getVerifier()` | verifier.ts:29-30 | No verifier for algorithm | Untested |

---

### T-02: Capability Package - Authorization Tests Missing
- **Package:** `@enkaku/capability`
- **Priority:** CRITICAL
- **Status:** [x] Fixed — Branch `claude/implement-capability-authorization-b65WS`
- **Plan:** `docs/plans/2026-01-28-capability-authorization.md`

**Security-Critical Paths — Now Tested (34 tests total):**
| Function | Location | Issue | Security Link | Status |
|----------|----------|-------|---------------|--------|
| `checkCapability()` | index.ts:179-182 | iss===sub bypass | C-02 | TESTED |
| `createCapability()` | index.ts:67-76 | No auth checks | C-03 | TESTED |
| `checkDelegationChain()` | index.ts:149-167 | Deep chain DoS | H-04 | TESTED |
| `isCapabilityToken()` | index.ts:45-55 | Type validation | M-04 | TESTED |
| `checkCapability()` | index.ts:174-176 | Missing subject | - | Previously tested |
| `assertCapabilityToken()` | index.ts:60-62 | Invalid token | - | Previously tested |

---

### T-03: Client/Server - Resource Limit Tests Missing
- **Package:** `@enkaku/client`, `@enkaku/server`
- **Priority:** CRITICAL
- **Status:** [x] Fixed — Branch `claude/implement-resource-limits-4wW1Y`
- **Plan:** `docs/plans/2026-01-28-server-resource-limits.md`

**DoS Scenarios — Now Tested (62 server tests total):**
| Issue | Location | Test File | Status |
|-------|----------|-----------|--------|
| Unbounded controllers | server.ts | resource-limits.test.ts | TESTED |
| No handler limits | server.ts | resource-limits.test.ts | TESTED |
| Channel send auth | server.ts | channel-send-auth.test.ts | TESTED |
| Per-message size limit | server.ts | buffer-limits.test.ts | TESTED |
| Controller timeout | server.ts | controller-timeout.test.ts | TESTED |
| Dispose timeout | server.ts | dispose-timeout.test.ts | TESTED |
| Stream crash cleanup | handlers/stream.ts | stream-crash.test.ts | TESTED |
| Event auth failure | server.ts | event-auth.test.ts | TESTED |
| Validation warning | server.ts | validation-warning.test.ts | TESTED |
| Non-existent RID sends | client.ts:317 | Untested (client package) |

---

### T-04: Transport Packages - Zero Coverage
- **Packages:** `@enkaku/http-client-transport`, `@enkaku/socket-transport`, `@enkaku/message-transport`
- **Priority:** CRITICAL

**Complete test suites needed for:**
- Connection lifecycle (connect, disconnect, error)
- Session management (create, timeout, cleanup)
- Message framing (valid, malformed, oversized)
- Backpressure handling
- Abort signal propagation

---

### T-05: Keystore Packages - Zero Coverage
- **Packages:** All 4 keystore packages
- **Priority:** CRITICAL

**Test suites needed for:**
- Key lifecycle: create, retrieve, delete
- Error handling: platform failures, invalid data
- Security: encryption (C-12), memory clearing (M-14)
- Edge cases: empty IDs, large keys, concurrent access

---

### T-06: Schema/Protocol - Validation Tests Missing
- **Package:** `@enkaku/schema`, `@enkaku/protocol`
- **Priority:** HIGH
- **Status:** Partially fixed — `resolveReference()` and `resolveSchema()` now tested (H-07). Schema helper and size constraint tests still needed.

**Untested:**
| Function | Location | Issue |
|----------|----------|-------|
| `resolveReference()` | utils.ts:3-20 | Prototype pollution — TESTED (H-07) |
| `resolveSchema()` | utils.ts:23-26 | TESTED (H-07) |
| All helper functions | client.ts, server.ts | Only main schemas tested |
| Size constraints | All schemas | H-05 not enforced |

---

### T-07: Utility Packages - Security Tests Missing
- **Packages:** `@enkaku/codec`, `@enkaku/stream`
- **Priority:** HIGH
- **Status:** Partially fixed — JSON depth limits (H-08) and payload size limits (H-18) now tested. Base64 validation (M-03) still needed.

**Untested Security Scenarios:**
| Issue | Location | Test Needed |
|-------|----------|-------------|
| JSON depth limits | codec/index.ts:90 | TESTED — depth >128 rejected (H-08) |
| Payload size limits | stream/json-lines.ts:74 | TESTED — maxBufferSize/maxMessageSize (H-18) |
| Base64 validation | codec/index.ts:33 | Invalid padding (M-03) |

---

## Test Priority Matrix

### Priority 1: Security-Critical (Before v1)
1. [x] T-02: Capability authorization bypass tests — DONE
2. [x] T-03: Server resource limit tests — DONE (62 tests across 16 files)
3. [ ] T-04: Transport package test suites
4. [ ] T-05: Keystore package test suites

### Priority 2: High Severity
1. [ ] T-01: Token error path tests
2. [ ] T-06: Schema validation tests
3. [ ] T-07: Codec/stream security tests

### Priority 3: Coverage Improvement
1. [ ] Event listener error handling
2. [ ] Execution chain cleanup
3. [ ] Stream backpressure

---

## Phase 3: Performance Improvements

### Serialization Performance

#### P-01: String Concatenation in JSON-Lines Parser
- **Package:** `@enkaku/stream`
- **File:** `packages/stream/src/json-lines.ts:37, 42, 47, 52, 57, 81`
- **Impact:** HIGH - 10-50x slower for large payloads

**Issue:** `output += char` in hot loop creates thousands of intermediate strings.

**Recommendation:** Use array buffer approach:
```typescript
let output: string[] = []
output.push(char)  // Instead of output += char
output.join('')    // Join once at end
```

---

#### P-02: Multiple Regex Replacements in Base64URL
- **Package:** `@enkaku/codec`
- **File:** `packages/codec/src/index.ts:48`
- **Impact:** HIGH - 3x slower encoding

**Issue:** Three sequential `.replace()` calls create 3 intermediate strings.

**Recommendation:** Single regex with alternation:
```typescript
return toB64(bytes).replace(/[=+/]/g, m => m === '=' ? '' : m === '+' ? '-' : '_')
```

---

#### P-03: Regex in Hot Loop
- **Package:** `@enkaku/stream`
- **File:** `packages/stream/src/json-lines.ts:56`
- **Impact:** MEDIUM - 2-5x slower per message

**Issue:** `/\S/.test(char)` regex executed for every character.

**Recommendation:** Use character code comparison:
```typescript
if (char.charCodeAt(0) > 32) { ... }
```

---

### Memory Usage

#### P-04: Unbounded Controller Storage
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:58`
- **Impact:** CRITICAL - Memory leak in long-running servers
- **Status:** [x] Fixed — See C-05

**Issue:** Controllers stored indefinitely until message completion. No TTL, max count, or orphan cleanup.

**Fix Applied:** Controller count limit (`maxControllers`), timeout-based cleanup (`controllerTimeoutMs`), and periodic garbage collection.

---

#### P-05: Session Map Growth Without Limits
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:45-46`
- **Impact:** HIGH - DoS vector
- **Status:** [x] Fixed — See C-08, C-09

**Issue:** Sessions and inflight requests accumulate without cleanup.

**Fix Applied:** Session limits (`maxSessions`, `sessionTimeoutMs`) and inflight request limits (`maxInflightRequests`, `requestTimeoutMs`).

---

#### P-06: String Buffer Growth Without Limits
- **Package:** `@enkaku/stream`
- **File:** `packages/stream/src/json-lines.ts:21-22`
- **Impact:** HIGH - OOM on large inputs

**Issue:** `input` and `output` buffers grow unbounded.

**Recommendation:** Add `MAX_BUFFER_SIZE` (1MB) and `MAX_OUTPUT_SIZE` (10MB).

---

### Async/Stream Performance

#### P-07: No Backpressure in Stream Transforms
- **Package:** `@enkaku/stream`
- **File:** `packages/stream/src/json-lines.ts:63-89`
- **Impact:** HIGH - Stream overflow

**Issue:** Never checks `controller.desiredSize` before enqueueing.

**Recommendation:** Check backpressure before enqueue, pause on slow consumers.

---

#### P-08: O(n²) Chain Unwinding
- **Package:** `@enkaku/execution`
- **File:** `packages/execution/src/execution.ts:134-139`
- **Impact:** MEDIUM - Slow iteration

**Issue:** `unshift()` is O(n) per call, making chain traversal O(n²).

**Recommendation:** Use `push()` then `reverse()` for O(n).

---

#### P-09: Redundant Signal Combining
- **Package:** `@enkaku/execution`
- **File:** `packages/execution/src/execution.ts:80-86`
- **Impact:** MEDIUM - Extra listeners

**Issue:** `AbortSignal.any()` called twice with overlapping signals.

**Recommendation:** Combine signals once with deduplication.

---

### Crypto Performance

#### P-10: Sequential Capability Verification
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts:163, 193`
- **Impact:** MEDIUM - O(n) verification time

**Issue:** Signature verification in chains is purely sequential.

**Recommendation:** Parallelize with `Promise.all()` for independent chains.

---

#### P-11: Redundant DID/Signature Decoding
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/token.ts:103, 131`
- **Impact:** MEDIUM - Extra decode per verify

**Issue:** Signature and DID re-decoded on every verification.

**Recommendation:** Cache decoded results for tokens verified within time window.

---

#### P-12: Synchronous Keyring Operations
- **Package:** `@enkaku/node-keystore`
- **File:** `packages/node-keystore/src/entry.ts:37, 58, 90`
- **Impact:** HIGH - Event loop blocking

**Issue:** Sync methods block event loop.

**Recommendation:** Document preference for async variants; deprecate sync in v1.

---

### Performance Priority Matrix

| Priority | Issue | Package | Impact | Effort |
|----------|-------|---------|--------|--------|
| P0 | P-01: String concat in JSON-L | stream | 10-50x slower | Low |
| ~~P0~~ | ~~P-04: Unbounded controllers~~ | ~~server~~ | ~~Memory leak~~ | ~~DONE~~ |
| P1 | P-02: Triple regex replace | codec | 3x slower | Low |
| ~~P1~~ | ~~P-05: Session map growth~~ | ~~http-transport~~ | ~~DoS risk~~ | ~~DONE~~ |
| P1 | P-06: Buffer growth | stream | OOM risk | Low |
| P1 | P-07: No backpressure | stream | Overflow | Medium |
| P2 | P-03: Regex in hot loop | stream | 2-5x slower | Low |
| P2 | P-08: O(n²) chain unwind | execution | Slow iteration | Low |
| P2 | P-10: Sequential verify | capability | O(n) time | Medium |
| P3 | P-09: Redundant signals | execution | Extra overhead | Low |
| P3 | P-11: Redundant decode | token | Extra decode | Medium |
| P3 | P-12: Sync keyring | node-keystore | Blocking | Low |

---

## Implementation Roadmap

### Phase 1: Critical Security (Breaking Changes OK)
1. ~~C-01: Token expiration validation~~ DONE
2. ~~C-02, C-03: Capability authorization~~ DONE
3. ~~C-05, C-06, C-07: Server resource limits~~ DONE (includes H-13, H-14, H-15, M-10, M-11, M-12)
4. ~~C-12: Browser keystore encryption~~ Won't Fix (non-extractable keys already provide strongest browser protection; wrapping would require extractable keys, reducing security)
5. ~~H-05, H-06: Protocol schema hardening~~ DONE (see `archive/2026-01-29-protocol-schema-hardening.md`)

### Phase 2: High Priority Security
1. ~~H-01~~, ~~H-02~~, ~~H-04~~, ~~H-05~~, ~~H-06~~, ~~H-07~~, ~~H-08~~, ~~H-09~~, ~~H-10~~, ~~H-12~~, ~~H-13~~, ~~H-14~~, ~~H-15~~, ~~H-16~~, ~~H-18~~: Fixed; H-03, H-11, H-17: Remaining high severity issues
2. T-01 (partial): Remaining token error paths; ~~T-02~~: Fixed; ~~T-03~~: Fixed; T-04 through T-07: Test coverage gaps

### Phase 3: Performance
1. P-01, P-02, P-03: Serialization quick wins
2. P-04, P-05, P-06: Memory limits
3. P-07: Stream backpressure

### Phase 4: Medium Security + Polish
1. M-01 through M-14: Medium severity issues
2. L-01 through L-03: Low severity issues
3. P-08 through P-12: Remaining performance

---

## Appendix: Breaking Changes Summary

| Issue | Change | Migration |
|-------|--------|-----------|
| C-01 | Tokens with `exp` now validated | Ensure valid expiration times |
| C-02 | Self-issued tokens validated | Ensure tokens include `act`/`res` claims |
| C-05 | Controller limits enforced (EK03, EK05) | Handle rejection errors; configure `maxControllers`, `controllerTimeoutMs` |
| C-06 | Handler concurrency limits (EK04) | Handle rejection errors; configure `maxConcurrentHandlers` |
| C-07 | Channel send auth required | Sign channel send messages in non-public mode |
| H-13/H-14 | Per-message size limit (EK06) | `maxPayloadSize` renamed to `maxMessageSize`; applied per-message to all types |
| C-08 | Session limits enforced (503) | Configure `maxSessions`, `sessionTimeoutMs` |
| C-09 | Inflight request limits enforced (503/504) | Configure `maxInflightRequests`, `requestTimeoutMs` |
| H-10 | Origin validation in wildcard CORS | Invalid origins now rejected with 403 |
| M-12 | Dispose cleanup timeout | Configure `cleanupTimeoutMs` |
| ~~C-12~~ | ~~Browser keys encrypted~~ | Won't Fix — non-extractable keys are the correct approach |
| H-05 | Field size limits | Reduce payload sizes |
| H-06 | additionalProperties: false | Remove extra fields |
| P-12 | Sync keyring deprecated | Use async variants |
