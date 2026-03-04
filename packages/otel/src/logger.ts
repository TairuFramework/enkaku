import type { Logger } from '@enkaku/log'
import { context, trace } from '@opentelemetry/api'

export function traceLogger(logger: Logger): Logger {
  const span = trace.getSpan(context.active())
  if (span == null) {
    return logger
  }
  const ctx = span.spanContext()
  if (ctx.traceId === '00000000000000000000000000000000') {
    return logger
  }
  return logger.with({ traceID: ctx.traceId, spanID: ctx.spanId })
}
