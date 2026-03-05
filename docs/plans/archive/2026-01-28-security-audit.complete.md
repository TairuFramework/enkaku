# Security Audit Report - Enkaku v1 Hardening

**Date:** 2026-01-28
**Status:** complete
**Purpose:** Comprehensive security audit for v1 release
**Scope:** All packages - security, coverage gaps, performance improvements

## Summary

Full security audit covering 47 findings across all severity levels, plus test coverage gaps and performance improvements.

| Severity | Count | Outcome |
|----------|-------|---------|
| CRITICAL | 12 | 9 Fixed, 3 Won't Fix (TLS/encryption — deployment concerns or already secure) |
| HIGH | 18 | 16 Fixed, 2 Won't Fix (cryptographic binding already implicit; message ordering handled by transport) |
| MEDIUM | 14 | 11 Fixed, 1 Mitigated, 2 Won't Fix (IPC backpressure; JS memory clearing infeasible) |
| LOW | 3 | 1 Fixed, 2 Closed (follow standards) |

## Key Changes

### Authentication & Authorization
- Token expiration (`exp`, `nbf`, `iat`) now validated in `verifyToken()`
- Capability authorization enforced for self-issued tokens and `createCapability()`
- Delegation chain depth limited; TOCTOU race fixed with consistent time capture
- Optional `verifyToken` hook added for capability revocation
- Server `public`/`access` params replaced with unified `accessControl` parameter
- Channel `send` messages require auth in non-public mode

### Resource Limits & DoS Protection
- Server: `maxControllers`, `maxConcurrentHandlers`, controller timeout, dispose timeout, per-message size limit
- HTTP transport: `maxSessions`, `sessionTimeoutMs`, `maxInflightRequests`, `requestTimeoutMs`
- Protocol schemas: `maxLength`/`maxProperties` constraints, `additionalProperties: false`
- Stream JSON-lines: buffer size limits

### Input Validation
- Token format validation (3-part JWT check), public key size validation
- Prototype pollution prevention in schema reference resolution
- JSON parse depth limits, base64url strict validation
- CORS origin validation (invalid origins rejected), default changed from wildcard to same-origin
- Generic error messages to clients (no internal details leaked)

### Test Coverage
- 78 keystore tests across 4 packages (node, browser, electron, expo)
- 62 server tests for resource limits, auth, timeouts
- 28 transport tests (HTTP client, socket, message)
- 35+ tests for token error paths, schema validation, codec utilities

### Performance
- JSON-lines parser: array buffer + charCode comparison (10-50x improvement for large payloads)
- Base64url: single regex replacement (3x faster)
- Execution: O(n) chain unwinding, deduplicated signal combining

## Deferred (Low Priority)
- P-07: Stream backpressure (no `controller.desiredSize` check)
- P-10: Parallel capability chain verification
- P-11: DID/signature decode caching

## Implementation Plans (Archived)
- `2026-01-28-token-expiration-validation.md`
- `2026-01-28-capability-authorization.md`
- `2026-01-28-server-resource-limits.md`
- `2026-01-30-input-validation-hardening.md`
- `2026-01-30-http-transport-hardening.complete.md`
- `2026-01-30-transport-package-tests.complete.md`
- `2026-03-02-keystore-package-tests.complete.md`
- `2026-03-03-security-hardening-waves-4-6.complete.md`
- `2026-03-05-security-audit-final-items.complete.md`
