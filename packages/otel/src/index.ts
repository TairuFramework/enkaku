// Re-export commonly used OTel types so consuming packages don't need @opentelemetry/api directly
export {
  type Context,
  type Span,
  type SpanOptions,
  SpanStatusCode,
  TraceFlags,
  type Tracer,
} from '@opentelemetry/api'
export {
  extractTraceContext,
  injectTraceContext,
  setSpanOnContext,
  withActiveContext,
} from './context.js'
export { createOTelLogSink } from './log-sink.js'
export { traceLogger } from './logger.js'
export { AttributeKeys, SpanNames, ZERO_TRACE_ID } from './semantic.js'
export { formatTraceparent, parseTraceparent, type TraceparentData } from './traceparent.js'
export {
  createTracer,
  getActiveSpan,
  getActiveTraceContext,
  type TraceContext,
  withSpan,
  withSyncSpan,
} from './tracers.js'
