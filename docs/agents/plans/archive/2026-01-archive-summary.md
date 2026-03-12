# 2026-01 Archive Summary

## Plans Completed

- **capability-authorization** (2026-01-28, complete) -- Fixed four capability authorization vulnerabilities: self-issued token bypass (C-02), missing parent validation in delegation (C-03), unbounded delegation chain depth (H-04), and incomplete token type checking (M-04). Added 34 new tests.

- **server-resource-limits** (2026-01-28, complete) -- Added configurable resource limits to the server package: controller count limits, concurrent handler limits with timeouts, channel message authorization, stream buffer limits, and cleanup mechanisms. Addresses C-05, C-06, C-07, H-13, H-14, H-15, M-10, M-11, M-12.

- **token-expiration-validation** (2026-01-28, complete) -- Implemented proper token expiration (exp), not-before (nbf), and issued-at (iat) validation with clock tolerance support. Breaking change -- expired tokens now rejected.

- **protocol-schema-hardening** (2026-01-29, complete) -- Hardened protocol message schemas: reject unknown properties (H-06) via additionalProperties: false, enforce string length limits (H-05) on rid, jti, rsn, code, msg, signature, and DID fields. Breaking protocol change.

- **http-transport-hardening** (2026-01-30, complete) -- Hardened HTTP server transport against resource exhaustion: configurable session limits with cleanup (C-08), inflight request limits with timeouts (C-09), request timeout with 504 auto-resolve (H-09), and origin validation (H-10).

- **input-validation-hardening** (2026-01-30, complete) -- Fixed six HIGH severity input validation issues across five packages: codec bounds checking (H-02), prototype pollution protection (H-07), JSON parsing depth limit (H-08), generic error messages (H-16), buffer size limits (H-18), and message type validation (H-12).

- **transport-package-tests** (2026-01-30, complete) -- Added ~28 tests to three previously untested transport packages (message-transport, socket-transport, http-client-transport) addressing T-04 coverage gap.

- **security-audit** (2026-01-28, complete) -- Comprehensive v1 security audit covering 47 findings across all packages. 36 fixed, 4 won't-fix (TLS enforcement is deployment-level, cryptographic caller binding implicit in JWT model, message ordering handled by transport, JS memory clearing infeasible), 1 mitigated, 2 closed. Drove six implementation waves from Jan 28 through Mar 5 covering auth/authorization, resource limits, schema hardening, input validation, error sanitization, and performance optimizations.

- **http-transport-sse-redesign** (undated, superseded) -- Design proposal to replace EventSource API with fetch-based SSE parsing. Superseded by the March 2026 implementation.
