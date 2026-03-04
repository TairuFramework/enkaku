import type { Logger } from '@enkaku/log'
import { context, trace } from '@opentelemetry/api'

import { ZERO_TRACE_ID } from './semantic.js'

export function traceLogger(logger: Logger): Logger {
  const span = trace.getSpan(context.active())
  if (span == null) {
    return logger
  }
  const ctx = span.spanContext()
  if (ctx.traceId === ZERO_TRACE_ID) {
    return logger
  }
  return logger.with({ traceID: ctx.traceId, spanID: ctx.spanId })
}
