---
"@enkaku/client": patch
"@enkaku/electron": patch
"@enkaku/react": patch
"@enkaku/standalone": patch
---

Emit `requestWritten`, `requestTimeout` and `lateReply` events, so observers can measure write latency, see a request's effective timeout budget, and detect replies that arrive after a timeout. Packages that depend on `@enkaku/client` are released with it, so their published range includes the new events.
