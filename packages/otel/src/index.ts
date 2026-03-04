export { extractTraceContext, injectTraceContext } from './context.js'
export { createOTelLogSink } from './log-sink.js'
export { traceLogger } from './logger.js'
export { AttributeKeys, SpanNames } from './semantic.js'
export {
  createTracer,
  getActiveTraceContext,
  type TraceContext,
  withSpan,
} from './tracers.js'
