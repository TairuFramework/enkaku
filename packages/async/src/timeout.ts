import { type InterruptionOptions, TimeoutInterruption } from './interuptions.js'

export class ScheduledTimeout implements Disposable {
  static create(delay: number, options?: InterruptionOptions): ScheduledTimeout {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort(new TimeoutInterruption({ message: `Timeout after ${delay}ms`, ...options }))
    }, delay)
    return new ScheduledTimeout(controller.signal, timer)
  }

  #signal: AbortSignal
  #timeout: NodeJS.Timeout

  constructor(signal: AbortSignal, timeout: NodeJS.Timeout) {
    this.#signal = signal
    this.#timeout = timeout
  }

  get signal() {
    return this.#signal
  }

  clear() {
    clearTimeout(this.#timeout)
  }

  [Symbol.dispose]() {
    this.clear()
  }
}
