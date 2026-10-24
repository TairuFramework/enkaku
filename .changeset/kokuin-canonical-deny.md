---
"@enkaku/server": patch
---

Require `@kokuin/capability` ^0.5.2, `@kokuin/controller` ^0.2.4 and `@kokuin/token` ^0.6.2, so audience and controller deny checks compare `did:peer:4` DIDs canonically (a peer denied in long form is also denied in short form).
