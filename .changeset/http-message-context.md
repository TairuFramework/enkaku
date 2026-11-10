---
"@enkaku/http-serve": minor
---

Expose HTTPMessageContext through getMessageContext, with the original request and optional SSE session handle.
Add explicit session owner binding and enforceSessionOwner checks, enabled by default for bound sessions.
Add onFrameWritten and FrameWrittenInfo for UTF-8 response, SSE frame and heartbeat byte counts.
