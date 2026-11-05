---
'@enkaku/client': minor
'@enkaku/http-serve': minor
'@enkaku/protocol': minor
'@enkaku/server': minor
'@enkaku/standalone': minor
---

Adopt kokuin 0.7: `Server`, `serve` and `standalone` accept `crypto?: CryptoProvider`, used to verify message signatures and capability chains. Signature verification now defaults to strict `nobleCrypto`, so signatures accepted only under the previous ZIP-215 policy are refused. Identities, capabilities and verifier hooks passed to these packages use the kokuin 0.7 named-params APIs.
