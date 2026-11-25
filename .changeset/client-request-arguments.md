---
"@enkaku/client": patch
---

Export `RequestOptions`, the options of a `request` call apart from its param, and `AnyRequestArguments`, the arguments `request` accepts for a procedure of any param type. A wrapper around `Client.prototype.request` can then be typed without `Parameters<>` or casts.
