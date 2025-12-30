import { describe, expect, test } from 'vitest'

import {
  AbortInterruption,
  CancelInterruption,
  DisposeInterruption,
  Interruption,
  type InterruptionOptions,
  TimeoutInterruption,
} from '../src/interruptions.js'

describe('Interruption', () => {
  test('creates interruption with default message', () => {
    const interruption = new Interruption()

    expect(interruption).toBeInstanceOf(Error)
    expect(interruption).toBeInstanceOf(Interruption)
    expect(interruption.name).toBe('Interruption')
    expect(interruption.message).toBe('Interruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates interruption with custom message', () => {
    const message = 'Custom interruption message'
    const interruption = new Interruption({ message })

    expect(interruption.message).toBe(message)
    expect(interruption.name).toBe('Interruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates interruption with ErrorOptions', () => {
    const cause = new Error('Original error')
    const interruption = new Interruption({ cause })

    expect(interruption.cause).toBe(cause)
    expect(interruption.name).toBe('Interruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates interruption with both message and ErrorOptions', () => {
    const message = 'Custom message'
    const cause = new Error('Original error')
    const interruption = new Interruption({ message, cause })

    expect(interruption.message).toBe(message)
    expect(interruption.cause).toBe(cause)
    expect(interruption.name).toBe('Interruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('isInterruption property is true', () => {
    const interruption = new Interruption()
    expect(interruption.isInterruption).toBe(true)
  })
})

describe('AbortInterruption', () => {
  test('creates abort interruption with default message', () => {
    const interruption = new AbortInterruption()

    expect(interruption).toBeInstanceOf(Error)
    expect(interruption).toBeInstanceOf(Interruption)
    expect(interruption).toBeInstanceOf(AbortInterruption)
    expect(interruption.name).toBe('AbortInterruption')
    expect(interruption.message).toBe('Interruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates abort interruption with custom message', () => {
    const message = 'Operation was aborted'
    const interruption = new AbortInterruption({ message })

    expect(interruption.message).toBe(message)
    expect(interruption.name).toBe('AbortInterruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates abort interruption with ErrorOptions', () => {
    const cause = new Error('Abort signal triggered')
    const interruption = new AbortInterruption({ cause })

    expect(interruption.cause).toBe(cause)
    expect(interruption.name).toBe('AbortInterruption')
    expect(interruption.isInterruption).toBe(true)
  })
})

describe('CancelInterruption', () => {
  test('creates cancel interruption with default message', () => {
    const interruption = new CancelInterruption()

    expect(interruption).toBeInstanceOf(Error)
    expect(interruption).toBeInstanceOf(Interruption)
    expect(interruption).toBeInstanceOf(CancelInterruption)
    expect(interruption.name).toBe('CancelInterruption')
    expect(interruption.message).toBe('Interruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates cancel interruption with custom message', () => {
    const message = 'Operation was cancelled'
    const interruption = new CancelInterruption({ message })

    expect(interruption.message).toBe(message)
    expect(interruption.name).toBe('CancelInterruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates cancel interruption with ErrorOptions', () => {
    const cause = new Error('User cancelled operation')
    const interruption = new CancelInterruption({ cause })

    expect(interruption.cause).toBe(cause)
    expect(interruption.name).toBe('CancelInterruption')
    expect(interruption.isInterruption).toBe(true)
  })
})

describe('DisposeInterruption', () => {
  test('creates dispose interruption with default message', () => {
    const interruption = new DisposeInterruption()

    expect(interruption).toBeInstanceOf(Error)
    expect(interruption).toBeInstanceOf(Interruption)
    expect(interruption).toBeInstanceOf(DisposeInterruption)
    expect(interruption.name).toBe('DisposeInterruption')
    expect(interruption.message).toBe('Interruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates dispose interruption with custom message', () => {
    const message = 'Resource was disposed'
    const interruption = new DisposeInterruption({ message })

    expect(interruption.message).toBe(message)
    expect(interruption.name).toBe('DisposeInterruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates dispose interruption with ErrorOptions', () => {
    const cause = new Error('Resource cleanup failed')
    const interruption = new DisposeInterruption({ cause })

    expect(interruption.cause).toBe(cause)
    expect(interruption.name).toBe('DisposeInterruption')
    expect(interruption.isInterruption).toBe(true)
  })
})

describe('TimeoutInterruption', () => {
  test('creates timeout interruption with default message', () => {
    const interruption = new TimeoutInterruption()

    expect(interruption).toBeInstanceOf(Error)
    expect(interruption).toBeInstanceOf(Interruption)
    expect(interruption).toBeInstanceOf(TimeoutInterruption)
    expect(interruption.name).toBe('TimeoutInterruption')
    expect(interruption.message).toBe('Interruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates timeout interruption with custom message', () => {
    const message = 'Operation timed out'
    const interruption = new TimeoutInterruption({ message })

    expect(interruption.message).toBe(message)
    expect(interruption.name).toBe('TimeoutInterruption')
    expect(interruption.isInterruption).toBe(true)
  })

  test('creates timeout interruption with ErrorOptions', () => {
    const cause = new Error('Timeout threshold exceeded')
    const interruption = new TimeoutInterruption({ cause })

    expect(interruption.cause).toBe(cause)
    expect(interruption.name).toBe('TimeoutInterruption')
    expect(interruption.isInterruption).toBe(true)
  })
})

describe('Interruption inheritance', () => {
  test('all interruption types inherit from Interruption', () => {
    const abort = new AbortInterruption()
    const cancel = new CancelInterruption()
    const dispose = new DisposeInterruption()
    const timeout = new TimeoutInterruption()

    expect(abort).toBeInstanceOf(Interruption)
    expect(cancel).toBeInstanceOf(Interruption)
    expect(dispose).toBeInstanceOf(Interruption)
    expect(timeout).toBeInstanceOf(Interruption)
  })

  test('all interruption types have isInterruption property', () => {
    const abort = new AbortInterruption()
    const cancel = new CancelInterruption()
    const dispose = new DisposeInterruption()
    const timeout = new TimeoutInterruption()

    expect(abort.isInterruption).toBe(true)
    expect(cancel.isInterruption).toBe(true)
    expect(dispose.isInterruption).toBe(true)
    expect(timeout.isInterruption).toBe(true)
  })

  test('interruption types have distinct names', () => {
    const base = new Interruption()
    const abort = new AbortInterruption()
    const cancel = new CancelInterruption()
    const dispose = new DisposeInterruption()
    const timeout = new TimeoutInterruption()

    expect(base.name).toBe('Interruption')
    expect(abort.name).toBe('AbortInterruption')
    expect(cancel.name).toBe('CancelInterruption')
    expect(dispose.name).toBe('DisposeInterruption')
    expect(timeout.name).toBe('TimeoutInterruption')
  })
})

describe('InterruptionOptions type', () => {
  test('InterruptionOptions extends ErrorOptions', () => {
    // This test ensures the type is properly defined
    // We can't directly test TypeScript types at runtime,
    // but we can verify the behavior works as expected
    const options: InterruptionOptions = {
      message: 'Test message',
      cause: new Error('Test cause'),
    }

    const interruption = new Interruption(options)
    expect(interruption.message).toBe('Test message')
    expect(interruption.cause).toBe(options.cause)
  })
})
