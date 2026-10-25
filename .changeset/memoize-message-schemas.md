---
"@enkaku/protocol": patch
"@enkaku/server": patch
---

Memoize `createClientMessageSchema()` and `createServerMessageSchema()` per protocol object and message type. Every `Server` built from the same protocol now reuses one compiled validator instead of recompiling the whole protocol with ajv.
