---
"@enkaku/http-fetch": patch
---

Retry a POST once when it fails with a peer reset (ECONNRESET, EPIPE, UND_ERR_SOCKET), so a stale pooled keep-alive socket left by a same-port server restart no longer errors the whole transport.
