import type { BroadcastHandler, SuppressibleHandler } from './responder.js'

/** Resolve after `ms` milliseconds. Default delay used by responders. */
export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Uniform random integer in `[0, maxMs]`. Default jitter used by responders. */
export function defaultJitter(maxMs: number): number {
  return Math.floor(Math.random() * (maxMs + 1))
}

/** Generate a random request/correlation ID. */
export function defaultRandomID(): string {
  return globalThis.crypto.randomUUID()
}

/** Narrow a handler to one tagged for storm-collapse suppression. */
export function isSuppressible(handler: BroadcastHandler): handler is SuppressibleHandler {
  return (handler as SuppressibleHandler).suppress != null
}
