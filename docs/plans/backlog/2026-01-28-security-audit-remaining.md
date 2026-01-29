# Security Audit — Remaining Issues

**Extracted from:** `docs/plans/archive/2026-01-28-security-audit.md`
**Priority:** Varies (see severity ratings below)

## Summary

15 of 47 issues were resolved across three implementation plans. 1 issue (C-12) was closed as won't-fix. The remaining open issues are listed below, grouped by severity.

---

## Critical (5 open, 1 won't-fix)

| ID | Issue | Package | Status |
|----|-------|---------|--------|
| C-04 | No capability revocation mechanism | `@enkaku/capability` | Open |
| C-08 | Session resource exhaustion (HTTP transport) | `@enkaku/http-server-transport` | Open |
| C-09 | Inflight request exhaustion (HTTP transport) | `@enkaku/http-server-transport` | Open |
| C-10 | No TLS/HTTPS enforcement | `@enkaku/http-*-transport` | Open |
| C-11 | Socket transport has no TLS support | `@enkaku/socket-transport` | Open |
| C-12 | Browser keystore stores keys unencrypted | `@enkaku/browser-keystore` | Won't Fix — non-extractable keys are the correct approach; wrapping would require extractable keys, reducing security |

## High (13 open)

| ID | Issue | Package |
|----|-------|---------|
| H-02 | Codec comparison missing bounds check | `@enkaku/token` |
| H-03 | No cryptographic binding to caller identity | `@enkaku/capability` |
| H-05 | Missing payload size constraints (protocol) | `@enkaku/protocol` |
| H-06 | additionalProperties: true allows arbitrary fields | `@enkaku/protocol` |
| H-07 | Unsafe reference resolution (prototype pollution) | `@enkaku/schema` |
| H-08 | JSON.parse() without depth limits | `@enkaku/codec` |
| H-09 | No request timeout (HTTP transport) | `@enkaku/http-server-transport` |
| H-10 | Header injection via origin reflection | `@enkaku/http-server-transport` |
| H-11 | No message sequence validation | `@enkaku/http-*-transport` |
| H-12 | No input validation on message payload type | `@enkaku/http-server-transport` |
| H-16 | Handler error messages sent to clients | `@enkaku/server` |
| H-17 | Conditional authentication bypass (public mode) | `@enkaku/server` |
| H-18 | No payload size limits (stream JSON lines) | `@enkaku/stream` |

## Medium (10 open)

| ID | Issue | Package |
|----|-------|---------|
| M-01 | Information disclosure in error messages | `@enkaku/token` |
| M-02 | No public key size validation | `@enkaku/token` |
| M-03 | Base64URL padding not validated | `@enkaku/codec` |
| M-05 | TOCTOU race in expiration checks | `@enkaku/capability` |
| M-06 | No validation of resource/action patterns | `@enkaku/capability` |
| M-07 | useDefaults: true in AJV | `@enkaku/schema` |
| M-08 | Schema structure exposure in error objects | `@enkaku/schema` |
| M-09 | Wildcard CORS default | `@enkaku/http-server-transport` |
| M-13 | Socket buffer no backpressure | `@enkaku/socket-transport` |
| M-14 | No memory clearing in all keystores | All keystores |

## Low (3 open)

| ID | Issue | Package |
|----|-------|---------|
| L-01 | Weak DID codec uniqueness | `@enkaku/token` |
| L-02 | Missing algorithm constant validation | `@enkaku/token` |
| L-03 | Missing iat validation | `@enkaku/capability` |

## Test Coverage Gaps (open)

| ID | Issue | Priority |
|----|-------|----------|
| T-01 | Token package — remaining error path tests | HIGH (partially fixed) |
| T-04 | Transport packages — zero coverage | CRITICAL |
| T-05 | Keystore packages — zero coverage | CRITICAL |
| T-06 | Schema/protocol — validation tests missing | HIGH |
| T-07 | Utility packages — security tests missing | HIGH |

## Performance Issues (open)

| ID | Issue | Impact |
|----|-------|--------|
| P-01 | String concatenation in JSON-Lines parser | HIGH (10-50x slower) |
| P-02 | Multiple regex replacements in Base64URL | HIGH (3x slower) |
| P-03 | Regex in hot loop | MEDIUM (2-5x slower) |
| P-05 | Session map growth without limits | HIGH (DoS) |
| P-06 | String buffer growth without limits | HIGH (OOM) |
| P-07 | No backpressure in stream transforms | HIGH (overflow) |
| P-08 | O(n^2) chain unwinding | MEDIUM |
| P-09 | Redundant signal combining | MEDIUM |
| P-10 | Sequential capability verification | MEDIUM |
| P-11 | Redundant DID/signature decoding | MEDIUM |
| P-12 | Synchronous keyring operations | HIGH (event loop blocking) |
