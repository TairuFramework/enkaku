import type { Config, ConsoleSinkOptions, Logger } from '@logtape/logtape'
import { configureSync, getConsoleSink, getLogger as logtape } from '@logtape/logtape'

export type { Config, ConsoleSinkOptions, Logger }
export { getConsoleSink }

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

export function getDefaultConfig(options?: ConsoleSinkOptions): Config<'console', never> {
  return {
    sinks: { console: getConsoleSink(options) },
    loggers: [
      { category: ['logtape', 'meta'], lowestLevel: 'error', sinks: ['console'] },
      { category: ['enkaku'], lowestLevel: 'error', sinks: ['console'] },
    ],
  }
}

export function setup(maybeConfig?: Config<string, string>) {
  configureSync(maybeConfig ?? getDefaultConfig())
}
