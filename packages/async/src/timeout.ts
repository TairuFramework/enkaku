import { type InterruptionOptions, TimeoutInterruption } from './interruptions.js'

export type ScheduledTimeoutParams = InterruptionOptions & { delay: number }

export class ScheduledTimeout implements Disposable {
  static at(date: Date, options?: InterruptionOptions): ScheduledTimeout {
    const delay = date.getTime() - Date.now()
    return new ScheduledTimeout({ delay, ...options })
  }

  static in(delay: number, options?: InterruptionOptions): ScheduledTimeout {
    return new ScheduledTimeout({ delay, ...options })
  }

  #controller: AbortController
  #timeout: NodeJS.Timeout

  constructor(params: ScheduledTimeoutParams) {
    const { delay, ...options } = params
    this.#controller = new AbortController()
    this.#timeout = setTimeout(() => {
      this.#controller.abort(
        new TimeoutInterruption({ message: `Timeout after ${delay}ms`, ...options }),
      )
    }, delay)
  }

  [Symbol.dispose]() {
    this.cancel()
  }

  get signal() {
    return this.#controller.signal
  }

  cancel() {
    clearTimeout(this.#timeout)
  }
}
