---
'@enkaku/client': patch
'@enkaku/server': patch
'@enkaku/protocol': patch
'@enkaku/http-serve': patch
'@enkaku/standalone': patch
---

Raise the `@kokuin/token` floor to `^0.3.0` and `@kokuin/capability` to `^0.2.1`.

`@kokuin/token@0.3.0` reworks the `KeyStore`/`KeyEntry` contract -- no API these packages call changed, so the bump only moves the required range. It matters for consumers pinning `@kokuin/token@0.2.x`, who now have to upgrade in step.
