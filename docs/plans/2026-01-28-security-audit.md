# Security Audit Report - Enkaku v1 Hardening

**Date:** 2026-01-28
**Purpose:** Comprehensive security audit for v1 release
**Scope:** All packages - security, coverage gaps, performance improvements

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 12 | Pending |
| HIGH | 18 | Pending |
| MEDIUM | 14 | Pending |
| LOW | 3 | Pending |

---

## Critical Issues

### C-01: Token Expiration Not Validated
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/token.ts:94-146`
- **File:** `packages/token/src/schemas.ts:62-80`
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

**Description:**
Controllers stored indefinitely in `Record<string, HandlerController>` until message completion. No TTL, no max count, no cleanup for orphaned requests. Client IDs (`rid`) are user-controlled.

**Impact:**
Send many requests without completing → unbounded memory growth → server crash.

**Recommendation:**
- Implement session limits per client/IP
- Add session timeout (e.g., 5 minutes)
- Implement garbage collection for stale sessions

---

### C-06: No Concurrent Handler Limits
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:101-119`
- **Status:** [ ] Not Started

**Description:**
No queue, no worker limit, no semaphore. Single transport can spawn unlimited concurrent handlers. No backpressure on writes.

**Impact:**
Create 1000 long-running channels → thread/memory exhaustion.

**Recommendation:**
Implement concurrent handler limits with configurable max workers.

---

### C-07: Channel Send Messages Skip Authorization
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:179-182`
- **Status:** [ ] Not Started

**Description:**
`send` message type (channel data from client) does NOT go through access control. Once a channel is established, client can send unlimited data without re-authorization. Code: `case 'send': { controller?.writer.write(msg.payload.val); break; }` - no validation, no authorization check.

**Impact:**
Authorization bypass for all channel communications after initial handshake.

**Recommendation:**
Validate send messages against established channel permissions.

---

### C-08: Session Resource Exhaustion (HTTP Transport)
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:45-46, 149-169`
- **Status:** [ ] Not Started

**Description:**
Unbounded session creation with no limits. Sessions stored in Map with no expiration or cleanup mechanism except on client abort. No rate limiting on session creation.

**Impact:**
Slowloris attack variant - create unlimited sessions, exhaust server memory.

**Recommendation:**
- Implement session limits per client/IP
- Add session timeout (e.g., 5 minutes)
- Implement garbage collection for stale sessions

---

### C-09: Inflight Request Exhaustion (HTTP Transport)
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:45-46`
- **Status:** [ ] Not Started

**Description:**
Unbounded inflight request tracking. Entries deleted only when responses arrive. No cleanup for abandoned requests.

**Impact:**
Inflight requests accumulate if responses never arrive → memory exhaustion.

**Recommendation:**
Implement request timeout and auto-cleanup mechanism.

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
- **Status:** [ ] Not Started

**Description:**
Uses IndexedDB for storage. IndexedDB data is NOT encrypted in browsers. Keys stored as `CryptoKeyPair` objects directly. Private keys are stored unencrypted and accessible via DevTools, browser extensions, or XSS attacks.

**Impact:**
Complete compromise of all stored private keys via any same-origin code.

**Recommendation:**
Implement key encryption using `crypto.subtle.wrapKey()` before IndexedDB storage.

---

## High Severity Issues

### H-01: Malformed Token Parsing (Array Bounds)
- **Package:** `@enkaku/token`
- **File:** `packages/token/src/token.ts:113`
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

**Description:**
Requests wait indefinitely for responses. If handler never responds, request hangs forever.

**Recommendation:**
Add configurable timeout (default 30s), reject with 504 on timeout.

---

### H-10: Header Injection via Origin Reflection
- **Package:** `@enkaku/http-server-transport`
- **File:** `packages/http-server-transport/src/index.ts:108-126`
- **Status:** [ ] Not Started

**Description:**
Origin header is directly reflected back in CORS responses without validation. If `allowedOrigins` includes '*', any origin is accepted and reflected.

**Impact:**
HTTP Header Injection, cache poisoning.

**Recommendation:**
Validate origin format (URL parse) before reflecting; only return whitelisted origins.

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
- **Status:** [ ] Not Started

**Description:**
Payload type (`typ` field) validated only via switch statement. Type is user-controlled string from JSON.

**Recommendation:**
Use enum or const validation, strict type checking.

---

### H-13: Unbounded Stream Buffer
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/handlers/stream.ts:34-50`
- **Status:** [ ] Not Started

**Description:**
`receiveStream.writable` has no backpressure handling. Handler can write unlimited data to stream.

**Impact:**
Handler sends gigabytes of data before client reads → memory exhaustion.

---

### H-14: Unbounded Channel Buffer
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/handlers/channel.ts:40-76`
- **Status:** [ ] Not Started

**Description:**
Both send and receive streams lack explicit buffer limits.

**Impact:**
Client sends 1MB+ messages repeatedly → memory exhaustion.

---

### H-15: Event Handlers Skip Authorization Response
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:141-145`
- **Status:** [ ] Not Started

**Description:**
When authorization fails for events, only `events.emit('handlerError')` is called. Clients receive no indication that their event was rejected.

---

### H-16: Handler Error Messages Sent to Clients
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/utils.ts:40`
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

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
- **Status:** [ ] Not Started

**Description:**
When `params.protocol != null` check - validation is not mandatory. All input validation skipped if protocol not provided.

---

### M-11: Stream Not Closed on Handler Crash
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/handlers/stream.ts:34-50`
- **Status:** [ ] Not Started

**Description:**
If handler crashes, stream stays open. Potential resource leak.

---

### M-12: No Cleanup Timeout on Server Dispose
- **Package:** `@enkaku/server`
- **File:** `packages/server/src/server.ts:228-239`
- **Status:** [ ] Not Started

**Description:**
When server disposes, if handler ignores abort signal and takes 10 seconds, server waits 10 seconds. No timeout on cleanup.

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
| `@enkaku/token` | 2 | ~30% | 11 error paths untested |
| `@enkaku/capability` | 1 | ~60% | Auth bypass untested (C-02, C-03) |
| `@enkaku/client` | 1 | ~70% | Memory leak paths untested |
| `@enkaku/server` | 6 | ~65% | Resource limits untested (C-05, C-06, C-07) |
| `@enkaku/http-server-transport` | 1 | ~30% | Session exhaustion untested |
| `@enkaku/http-client-transport` | 0 | 0% | **NO TESTS** |
| `@enkaku/socket-transport` | 0 | 0% | **NO TESTS** |
| `@enkaku/message-transport` | 0 | 0% | **NO TESTS** |
| `@enkaku/node-streams-transport` | 1 | ~20% | Error paths untested |
| `@enkaku/schema` | 1 | ~15% | Reference resolution untested (H-07) |
| `@enkaku/protocol` | 1 | ~20% | Size constraints untested (H-05) |
| `@enkaku/node-keystore` | 0 | 0% | **NO TESTS** |
| `@enkaku/browser-keystore` | 0 | 0% | **NO TESTS** |
| `@enkaku/expo-keystore` | 0 | 0% | **NO TESTS** |
| `@enkaku/electron-keystore` | 0 | 0% | **NO TESTS** |
| `@enkaku/codec` | 1 | ~60% | Depth limits untested (H-08) |
| `@enkaku/stream` | 4 | ~70% | Size limits untested (H-18) |
| `@enkaku/async` | 4 | ~85% | Good coverage |
| `@enkaku/result` | 3 | ~90% | Excellent coverage |
| `@enkaku/event` | 1 | ~65% | Error handling untested |
| `@enkaku/execution` | 1 | ~60% | Chain cleanup untested |

---

### T-01: Token Package - Missing Error Path Tests
- **Package:** `@enkaku/token`
- **Priority:** HIGH

**Untested Error Paths:**
| Function | Location | Error Case |
|----------|----------|------------|
| `verifyToken()` | token.ts:113 | Malformed JWT (not 3 parts) |
| `verifyToken()` | token.ts:116-118 | Invalid header type |
| `verifyToken()` | token.ts:124-126 | Missing signature |
| `verifyToken()` | token.ts:145 | Unsupported algorithm |
| `verifySignedPayload()` | token.ts:31-32 | Invalid signature |
| `getSignatureInfo()` | did.ts:47 | Invalid DID prefix |
| `getSignatureInfo()` | did.ts:53 | Unsupported codec |
| `isCodecMatch()` | did.ts:13-20 | Bytes shorter than codec |
| `signToken()` | signer.ts:50-52 | Issuer mismatch |
| `toTokenSigner()` | signer.ts:39-42 | Unsupported algorithm |
| `getVerifier()` | verifier.ts:29-30 | No verifier for algorithm |

---

### T-02: Capability Package - Authorization Tests Missing
- **Package:** `@enkaku/capability`
- **Priority:** CRITICAL

**Security-Critical Untested Paths:**
| Function | Location | Issue | Security Link |
|----------|----------|-------|---------------|
| `checkCapability()` | index.ts:179-182 | iss===sub bypass | C-02 |
| `createCapability()` | index.ts:67-76 | No auth checks | C-03 |
| `checkDelegationChain()` | index.ts:149-167 | Deep chain DoS | H-04 |
| `checkCapability()` | index.ts:174-176 | Missing subject | - |
| `assertCapabilityToken()` | index.ts:60-62 | Invalid token | - |

---

### T-03: Client/Server - Resource Limit Tests Missing
- **Package:** `@enkaku/client`, `@enkaku/server`
- **Priority:** CRITICAL

**Untested DoS Scenarios:**
| Issue | Location | Test Needed |
|-------|----------|-------------|
| Unbounded controllers | server.ts:58 | 10,000 concurrent requests |
| No handler limits | server.ts:101 | Handler explosion |
| Channel send auth | server.ts:179 | Auth bypass on send |
| Unbounded stream buffer | handlers/stream.ts:34 | 100MB writes |
| Unbounded channel buffer | handlers/channel.ts:40 | Memory exhaustion |
| Non-existent RID sends | client.ts:317 | Memory leak |

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

**Untested:**
| Function | Location | Issue |
|----------|----------|-------|
| `resolveReference()` | utils.ts:3-20 | Prototype pollution (H-07) |
| `resolveSchema()` | utils.ts:23-26 | Never tested |
| All helper functions | client.ts, server.ts | Only main schemas tested |
| Size constraints | All schemas | H-05 not enforced |

---

### T-07: Utility Packages - Security Tests Missing
- **Packages:** `@enkaku/codec`, `@enkaku/stream`
- **Priority:** HIGH

**Untested Security Scenarios:**
| Issue | Location | Test Needed |
|-------|----------|-------------|
| JSON depth limits | codec/index.ts:90 | 10,000+ nesting (H-08) |
| Payload size limits | stream/json-lines.ts:74 | 10MB+ payloads (H-18) |
| Base64 validation | codec/index.ts:33 | Invalid padding (M-03) |

---

## Test Priority Matrix

### Priority 1: Security-Critical (Before v1)
1. [ ] T-02: Capability authorization bypass tests
2. [ ] T-03: Server resource limit tests
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

## Next Steps

1. [ ] Prioritize issues by implementation order
2. [ ] Create tracking issues for each item
3. [ ] Implement fixes starting with CRITICAL items
4. [ ] Add test coverage for each fix
5. [ ] Perform performance audit after security fixes
