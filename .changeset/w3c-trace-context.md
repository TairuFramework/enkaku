---
'@enkaku/client': minor
'@enkaku/server': minor
'@enkaku/http-serve': patch
'@enkaku/http-fetch': patch
---

Propagate trace context over W3C `traceparent`/`tracestate` instead of the custom `tid`/`sid` header pair, adopting `@sozai/otel` `^0.3.0`.

`@sozai/otel@0.3.0` removes `injectTraceContext`/`extractTraceContext`. That contract was a second, unvalidated encoding of what the W3C path already carries: it skipped trace/span ID validation and hardcoded `TraceFlags.SAMPLED`, so any string became a remote `SpanContext` and every remote trace was force-sampled. The client now stamps `traceparent` (and `tracestate`) onto the message header via `injectW3CTraceContext`, and the server reads it back with `extractW3CTraceContext`, including for the span link it builds from the caller's context -- which now carries the caller's real sampling flags rather than an assumed `SAMPLED`.

Wire-format change: a client and server that disagree on this version still interoperate, but the server no longer sees the client's trace context, so their spans land in separate traces instead of one.

`@enkaku/http-serve` reads the inbound `traceparent` header directly rather than reparsing it into the custom shape, and `@enkaku/http-fetch` omits the header when `formatTraceparent` returns `undefined` (it now declines to emit a structurally invalid header) instead of sending the literal `undefined`.
