---
"@enkaku/http-serve": patch
---

Write an SSE comment line to every open stream every `heartbeatIntervalMs` (default 15 seconds, `0` disables it), so proxies and clients with body or idle timeouts no longer drop a quiet stream. A comment is skipped while a stream's buffer is full.
