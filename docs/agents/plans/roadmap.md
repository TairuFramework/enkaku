# Enkaku Roadmap

## Completed Goals (Jan-Mar 2026)

- **Security hardening** — Comprehensive audit (47 findings), 6 implementation waves, all critical/high items resolved
- **Message-level encryption** — JWE with ECDH-ES + A256GCM, identity type hierarchy, 4 envelope modes
- **Observability** — @enkaku/otel package, integrated across 10 packages, trace context propagation
- **Transport modernization** — SSE redesign with POST-based sessions, fetch + eventsource-parser
- **API refinement** — Unified `accessControl` parameter, event emitter rewrite (zero deps), downstream migration to Kubun/Mokei complete
- **Agent documentation** — Progressive discovery system (6 domain skills), AGENTS.md, capability docs

## Backlog (Low priority)

1. **Remaining discovery skills** — `/enkaku:utilities` and `/enkaku:platform` (nice-to-have, core discovery works without them)
2. **JWE multi-recipient** — `ECDH-ES+A256KW` key wrapping + JWE JSON Serialization (no known consumer demand)
