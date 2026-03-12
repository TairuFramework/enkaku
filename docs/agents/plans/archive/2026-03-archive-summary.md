# 2026-03 Archive Summary

## Plans Completed

- **keystore-package-tests** (2026-03-02, complete) -- Added 78 unit tests across 4 keystore packages (node, electron, expo, browser) covering KeyEntry lifecycle, KeyStore caching, and identity helpers.

- **security-hardening-waves-4-6** (2026-03-03, complete) -- Executed 3 implementation waves resolving 12 security audit issues and 3 test coverage gaps across 16 commits: sanitized error messages, added key size/input validation, fixed CORS defaults, disabled AJV useDefaults, TOCTOU prevention, pattern validation, and 35 error path tests.

- **keystore-otel-refactor** (2026-03-04, complete) -- Moved OpenTelemetry span creation from key entry provide() methods to identity creation functions across all 4 keystores. Renamed signer.ts to identity.ts, removed unnecessary @noble/curves dependency from 3 packages.

- **observability-tracing** (2026-03-04, complete) -- Built end-to-end OpenTelemetry instrumentation from key generation through client signing, transport, server auth, handler execution, and error responses. Created new @enkaku/otel package with semantic constants, tracer utilities, and trace context propagation via JWT headers (tid/sid).

- **event-emitter-replacement** (2026-03-05, complete) -- Replaced emittery dependency in @enkaku/event with custom Map/Set implementation. Switched to parallel listener execution via Promise.allSettled, achieved zero runtime dependencies. Drop-in API replacement.

- **otel-integration** (2026-03-05, complete) -- Fully integrated @enkaku/otel across 10 packages by removing direct @opentelemetry/api imports. Added helpers (withSyncSpan, getActiveSpan), re-exported OTel types, added W3C traceparent support, and implemented stream/channel lifecycle spans.

- **security-audit-final-items** (2026-03-05, complete) -- Implemented 7 security audit items: refactored access control API from public/access booleans to unified accessControl parameter (breaking change), added optional verifyToken hook, and 4 performance optimizations.

- **http-transport-sse-redesign** (2026-03-06, complete) -- Redesigned SSE from EventSource API to fetch + eventsource-parser with POST-based session protocol, reducing stream setup from 3 requests to 1. Uses single multiplexed SSE connection with session IDs. Breaking protocol change.
