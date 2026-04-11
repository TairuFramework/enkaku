/**
 * Platform-provided runtime primitives.
 *
 * These APIs differ across JavaScript environments (Node.js, React Native,
 * browsers). createRuntime() fills in globalThis defaults so consumers
 * always get a fully resolved Runtime — no optional checks needed downstream.
 *
 * Default implementations delegate to globalThis at call time (not bind time),
 * so test spies and mocks on globalThis.fetch etc. still work.
 */

export type Fetch = typeof globalThis.fetch

export type GetRandomID = () => string

export type GetRandomValues = <T extends ArrayBufferView>(array: T) => T

export type Runtime = {
  fetch: Fetch
  getRandomID: GetRandomID
  getRandomValues: GetRandomValues
}

function defaultFetch(...args: Parameters<Fetch>): ReturnType<Fetch> {
  return globalThis.fetch(...args)
}

function defaultGetRandomID(): string {
  return globalThis.crypto.randomUUID()
}

function defaultGetRandomValues<T extends ArrayBufferView>(array: T): T {
  return globalThis.crypto.getRandomValues(array as ArrayBufferView<ArrayBuffer>) as T
}

export function createRuntime(overrides?: Partial<Runtime>): Runtime {
  return {
    fetch: overrides?.fetch ?? defaultFetch,
    getRandomID: overrides?.getRandomID ?? defaultGetRandomID,
    getRandomValues: overrides?.getRandomValues ?? defaultGetRandomValues,
  }
}
