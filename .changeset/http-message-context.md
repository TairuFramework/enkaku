---
"@enkaku/http-serve": minor
---

Expose HTTPMessageContext through getMessageContext, with the original request and optional SSE session handle.
Add explicit session owner binding and enforceSessionOwner checks, enabled by default for bound sessions.
Add onFrameWritten and FrameWrittenInfo for UTF-8 response, SSE frame and heartbeat byte counts.
Count initial SSE comments as heartbeats and report enqueued frames even when they trigger session buffer overflow.
Client disconnects and session drops cancel pending server invocation hooks through their signal.
