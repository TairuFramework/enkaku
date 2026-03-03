# Security Audit — Remaining Issues

**Extracted from:** `docs/plans/2026-01-28-security-audit.md`
**Last updated:** 2026-03-03
**Priority:** Varies (see severity ratings below)

## Summary

44 of 47 issues resolved. 3 issues closed (C-12 won't-fix, L-01/L-02 already handled). 3 issues remain open (critical/high only), plus test coverage gaps and performance.

**Resolution history:**
- Wave 1 (2026-01-28): Token expiration (C-01, H-01), capability authorization (C-02, C-03, H-04, M-04), server resource limits (C-05, C-06, C-07, H-13, H-14, H-15, M-10, M-11, M-12)
- Wave 2 (2026-01-29): Protocol schema hardening (H-05, H-06)
- Wave 3 (2026-01-30): Input validation (H-02, H-07, H-08, H-12, H-16, H-18), HTTP transport hardening (C-08, C-09, H-09, H-10), transport tests (T-04)
- Wave 4 (2026-03-03): Error message sanitization (M-01, M-08), input validation (M-02, M-03), CORS hardening (M-09), iat validation (L-03), close L-01/L-02
- Wave 5 (2026-03-03): AJV defaults (M-07), TOCTOU fix (M-05), pattern validation (M-06), public mode warning (H-17)

---

## Critical (2 open, 1 won't-fix)

| ID | Issue | Package | Status |
|----|-------|---------|--------|
| C-04 | No capability revocation mechanism | `@enkaku/capability` | Open |
| C-10 | No TLS/HTTPS enforcement | `@enkaku/http-*-transport` | Open |
| C-11 | Socket transport has no TLS support | `@enkaku/socket-transport` | Open |
| C-12 | Browser keystore stores keys unencrypted | `@enkaku/browser-keystore` | Won't Fix — non-extractable keys are the correct approach |

## High (2 open)

| ID | Issue | Package |
|----|-------|---------|
| H-03 | No cryptographic binding to caller identity | `@enkaku/capability` |
| H-11 | No message sequence validation | `@enkaku/http-*-transport` |

## Medium (2 open)

| ID | Issue | Package |
|----|-------|---------|
| M-13 | Socket buffer no backpressure | `@enkaku/socket-transport` |
| M-14 | No memory clearing in all keystores | All keystores |

## Low (0 open)

All low-priority issues resolved or closed.

## Test Coverage Gaps

| ID | Issue | Priority | Status |
|----|-------|----------|--------|
| T-01 | Token package — remaining error path tests (6 untested paths) | HIGH | Partial |
| T-05 | Keystore packages — zero unit test coverage (all 4 packages) | CRITICAL | Fixed (78 tests) |
| T-06 | Schema/protocol — schema helper function tests still needed | HIGH | Partial (H-05/H-06/H-07 tested) |
| T-07 | Utility packages — Base64 validation tests (M-03) | HIGH | Partial (H-08/H-18 tested) |

## Performance Issues (open)

| ID | Issue | Impact |
|----|-------|--------|
| P-01 | String concatenation in JSON-Lines parser | HIGH (10-50x slower) |
| P-02 | Multiple regex replacements in Base64URL | HIGH (3x slower) |
| P-03 | Regex in hot loop | MEDIUM (2-5x slower) |
| P-06 | String buffer growth without limits | HIGH (OOM) |
| P-07 | No backpressure in stream transforms | HIGH (overflow) |
| P-08 | O(n^2) chain unwinding | MEDIUM |
| P-09 | Redundant signal combining | MEDIUM |
| P-10 | Sequential capability verification | MEDIUM |
| P-11 | Redundant DID/signature decoding | MEDIUM |
| P-12 | Synchronous keyring operations | HIGH (event loop blocking) |
