export type InterruptionOptions = ErrorOptions & {
  message?: string
}

export class Interruption extends Error {
  constructor(options: InterruptionOptions = {}) {
    super(options.message ?? 'Interruption', options)
    this.name = 'Interruption'
  }

  get isInterruption() {
    return true
  }
}

export class AbortInterruption extends Interruption {
  constructor(options: InterruptionOptions = {}) {
    super(options)
    this.name = 'AbortInterruption'
  }
}

export class CancelInterruption extends Interruption {
  constructor(options: InterruptionOptions = {}) {
    super(options)
    this.name = 'CancelInterruption'
  }
}

export class DisposeInterruption extends Interruption {
  constructor(options: InterruptionOptions = {}) {
    super(options)
    this.name = 'DisposeInterruption'
  }
}

export class TimeoutInterruption extends Interruption {
  constructor(options: InterruptionOptions = {}) {
    super(options)
    this.name = 'TimeoutInterruption'
  }
}
