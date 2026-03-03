# Security Hardening Waves 4-6 — Complete

**Status:** Complete
**Date:** 2026-03-03
**Branch:** `feat/security-hardening-quick-fixes`

## Summary

Three implementation plans executed in sequence, resolving 12 security audit issues and 3 test coverage gaps across 16 commits.

## Wave 4: Quick Fixes (M-01, M-02, M-03, M-08, M-09, L-03)

**Original plan:** `docs/plans/2026-03-03-security-hardening-quick-fixes.md`

- **M-01** — Sanitized error messages in `@enkaku/token` to prevent information disclosure (removed interpolated DID strings, algorithm names, issuer identifiers)
- **M-02** — Added public key size validation in DID decoding (32 bytes for Ed25519, 33 bytes for P-256)
- **M-03** — Added base64url input character set validation in `@enkaku/codec`
- **M-08** — Removed `schemaPath` from `ValidationErrorObject` fallback error messages in `@enkaku/schema`
- **M-09** — Changed default CORS policy from wildcard to same-origin in `@enkaku/http-server-transport`
- **L-03** — Added `assertValidIssuedAt()` to reject capability tokens with future issued-at timestamps
- Also closed **L-01** (DID codec values follow multicodec standard) and **L-02** (algorithm already bound by DID codec prefix)

## Wave 5: Tier 2 Fixes (M-07, M-05, M-06, H-17)

**Original plan:** `docs/plans/2026-03-03-security-hardening-tier2.md`

- **M-07** — Disabled `useDefaults` in AJV to prevent input mutation during validation
- **M-05** — Captured `now()` once at capability validation entry points (`assertValidDelegation`, `checkDelegationChain`) to eliminate TOCTOU race between expiration and issued-at checks
- **M-06** — Added `assertValidPattern()` to reject path traversal, control characters, double slashes, and misplaced wildcards in capability `act`/`res` values
- **H-17** — Added logger warning when `public: true` is combined with non-empty access control records (makes the authentication bypass explicit)

## Wave 6: Test Coverage Gaps (T-01, T-06, T-07)

**Original plan:** `docs/plans/2026-03-03-test-coverage-gaps.md`

- **T-01** — Added 9 JWE/envelope error path tests: `decryptToken` format/algorithm/encryption validation, `createTokenEncrypter` unsupported algorithm, `wrapEnvelope` missing signer/encrypter for all modes, `unwrapEnvelope` missing decrypter and invalid format
- **T-06** — Added 13 schema helper tests: `asType`, `toStandardValidator`, `createStandardValidator`, `ValidationError.issues/schema/value`, `ValidationErrorObject.details/path`
- **T-07** — Added 13 codec utility tests: `canonicalStringify` deterministic ordering, `fromUTF`/`toUTF` round-trips with ASCII/Unicode/multibyte text, `b64uFromJSON` canonicalize parameter

## Packages Modified

- `@enkaku/token` — error message sanitization, public key validation, iat validation, JWE error path tests
- `@enkaku/codec` — base64url validation, utility function tests
- `@enkaku/schema` — error message sanitization, AJV defaults, validator helper tests
- `@enkaku/http-server-transport` — CORS default policy
- `@enkaku/capability` — iat validation, TOCTOU fix, pattern validation
- `@enkaku/server` — public mode access control warning
- `@enkaku/browser-keystore` — error message sanitization
