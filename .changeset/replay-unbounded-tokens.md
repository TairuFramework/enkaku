---
'@enkaku/server': patch
---

Refuse authenticated signed messages with neither `iat` nor `exp` before recording a replay key. Add `replay.maxLifetime` (default 5 minutes) to refuse tokens whose `exp`, or `iat + maxAge` without `exp`, lies further ahead than the cap. Both cases report `replay_unbounded`, and the server returns `EK09` (`REPLAY_DETECTED`). Set `replay.rejectStale` to `false` to retain deduplication-only handling, or set `maxLifetime: Infinity` to disable the lifetime cap while keeping stale-message rejection.
