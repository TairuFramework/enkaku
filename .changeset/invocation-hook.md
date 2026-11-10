---
"@enkaku/server": minor
---

Add an awaited onInvocation hook with verified caller context, shared delegation verification and transport metadata.
Expose a cancellation signal to pending hooks and skip handler dispatch after transport cancellation.
Export InvocationContext, InvocationCaller, InvocationHook, InvocationRejectedError and AccessDecision.
Report hook failures through invocation handler errors and existing invocation spans.
