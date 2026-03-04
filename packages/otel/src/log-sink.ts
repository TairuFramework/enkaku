import { context, trace } from '@opentelemetry/api'
import { type LogAttributes, logs, type SeverityNumber } from '@opentelemetry/api-logs'

type LogRecord = {
  category: ReadonlyArray<string>
  level: string
  message: ReadonlyArray<string | (() => unknown)>
  rawMessage: string
  properties: Record<string, unknown>
  timestamp: number
}

const LEVEL_TO_SEVERITY: Record<string, SeverityNumber> = {
  trace: 1,
  debug: 5,
  info: 9,
  warning: 13,
  warn: 13,
  error: 17,
  fatal: 21,
}

export function createOTelLogSink(): (record: LogRecord) => void {
  const logger = logs.getLogger('enkaku')

  return (record: LogRecord) => {
    const activeSpan = trace.getSpan(context.active())

    const attributes: LogAttributes = {
      ...(record.properties as LogAttributes),
      'log.category': record.category.join('.'),
    }

    logger.emit({
      severityNumber: (LEVEL_TO_SEVERITY[record.level] ?? 9) as SeverityNumber,
      severityText: record.level,
      body: record.rawMessage,
      attributes,
      timestamp: record.timestamp,
      context: activeSpan ? context.active() : undefined,
    })
  }
}
