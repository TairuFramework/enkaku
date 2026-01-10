import { type Logger, getLogger as logtape } from '@logtape/logtape'

export type { Logger }

export function getLogger(
  name: string | Array<string> | ReadonlyArray<string>,
  properties?: Record<string, unknown>,
): Logger {
  const logger = logtape(name)
  return properties ? logger.with(properties) : logger
}

export function getEnkakuLogger(namespace: string, properties?: Record<string, unknown>): Logger {
  return getLogger(['enkaku', namespace], properties)
}
