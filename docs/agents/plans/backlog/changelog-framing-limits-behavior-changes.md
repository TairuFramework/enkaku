# Changelog entry for transport framing-limits behavior changes

**Origin:** transport framing/size limits work (PR #36, completed 2026-06-12). The repo has no `.changeset/` directory, so the two hardening behavior changes need a manual changelog/release-note entry before the next release.

## To document

- **`@enkaku/stream`** — `fromJSONLines` `maxBufferSize` now bounds total framer memory (`input + output`), not just the per-line input buffer. A multi-line stream that passed under the old input-only cap may now error. **Transitively affects `@enkaku/socket-transport`**, which threads the same option.
- **`@enkaku/http-server-transport`** — new `maxRequestBodySize` option defaults to `1_048_576` (1 MiB). Request bodies larger than 1 MiB now return `413` unless the cap is raised.

Both are intentional hardening. Additive on the other two packages (`node-streams-transport` framing limits, `http-client-transport` SSE `maxBufferSize`) — no behavior change when options are omitted.
