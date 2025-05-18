import { type Schema, ValidationError, createValidator } from '@enkaku/schema'

import {
  type HandlerExecutionContext,
  type HandlersRecord,
  createFlow,
  createGenerator,
} from '../src/index.js'

const stateSchema = { type: 'number' } as const satisfies Schema
const stateValidator = createValidator(stateSchema)

const handlers = {
  add: ({ state, params }: HandlerExecutionContext<number, number>) => {
    return { status: 'action', state: state + params, action: 'subtract', params: 3 }
  },
  subtract: ({ state, params }: HandlerExecutionContext<number, number>) => {
    return { status: 'end', state: state - params }
  },
} satisfies HandlersRecord<number>

describe('createGenerator()', () => {
  test('returns a generator', async () => {
    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 1,
      action: { name: 'add', params: 2 },
    })

    await expect(generator.next()).resolves.toEqual({
      value: { status: 'action', state: 3, action: 'subtract', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'end', state: 0 },
      done: true,
    })
  })

  test('returns error when handler for initial action is missing', async () => {
    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 1,
      action: { name: 'multiply' as keyof typeof handlers, params: 2 },
    })

    await expect(generator.next()).resolves.toEqual({
      value: {
        status: 'error',
        state: 1,
        error: expect.objectContaining({
          name: 'MissingHandler',
          message: 'Handler for action multiply not found',
        }),
      },
      done: true,
    })
  })

  test('returns error when handler for subsequent action is missing', async () => {
    const handlersWithInvalidNext = {
      ...handlers,
      add: ({ state, params }: HandlerExecutionContext<number, number>) => {
        return {
          status: 'action' as const,
          state: state + params,
          action: 'multiply' as keyof typeof handlers,
          params: 3,
        }
      },
    } satisfies typeof handlers

    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers: handlersWithInvalidNext,
      state: 1,
      action: { name: 'add', params: 2 },
    })

    await expect(generator.next()).resolves.toEqual({
      value: { status: 'action', state: 3, action: 'multiply', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: {
        status: 'error',
        state: 3,
        error: expect.objectContaining({
          name: 'MissingHandler',
          message: 'Handler for action multiply not found',
        }),
      },
      done: true,
    })
  })

  test('handles abort signal', async () => {
    const abortController = new AbortController()

    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 1,
      action: { name: 'add', params: 2 },
      signal: abortController.signal,
    })

    const firstStep = generator.next()
    abortController.abort('reason')

    await expect(firstStep).resolves.toEqual({
      value: {
        status: 'aborted',
        state: 3,
        reason: 'reason',
      },
      done: true,
    })
  })

  test('returns error when initial state fails validation', async () => {
    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 'invalid' as unknown as number, // Type assertion to test invalid state
      action: { name: 'add', params: 2 },
    })

    await expect(generator.next()).resolves.toEqual({
      value: {
        status: 'error',
        state: 'invalid',
        error: expect.any(ValidationError),
      },
      done: true,
    })
  })

  test('returns error when handler output state fails validation', async () => {
    const handlersWithInvalidOutput = {
      ...handlers,
      add: () => {
        return {
          status: 'action' as const,
          state: 'invalid' as unknown as number,
          action: 'subtract',
          params: 3,
        }
      },
    } satisfies typeof handlers

    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers: handlersWithInvalidOutput,
      state: 1,
      action: { name: 'add', params: 2 },
    })

    await expect(generator.next()).resolves.toEqual({
      value: {
        status: 'error',
        state: 'invalid',
        error: expect.any(ValidationError),
      },
      done: true,
    })
  })

  test('can be provided an action when calling next()', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    await expect(generator.next({ action: { name: 'add', params: 2 } })).resolves.toEqual({
      value: { status: 'action', state: 3, action: 'subtract', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'end', state: 0 },
      done: true,
    })
  })

  test('ignore the step execution if the provided signal is aborted', async () => {
    const abortController = new AbortController()
    abortController.abort()
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    await expect(
      generator.next({ action: { name: 'add', params: 2 }, signal: abortController.signal }),
    ).resolves.toEqual({
      value: { status: 'state', state: 1 },
      done: false,
    })
  })

  test('can be provided state when calling next()', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    await expect(generator.next({ state: 2, action: { name: 'add', params: 2 } })).resolves.toEqual(
      {
        value: { status: 'action', state: 4, action: 'subtract', params: 3 },
        done: false,
      },
    )
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'end', state: 1 },
      done: true,
    })
  })

  test('can be provided only state when calling next()', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    await expect(generator.next({ state: 2 })).resolves.toEqual({
      value: { status: 'state', state: 2 },
      done: false,
    })
  })

  test('ends when calling next() with no action or state', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'end', state: 1 },
      done: true,
    })
  })

  test('handles return() with final value', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    const value = { status: 'end', state: 42 } as const
    await expect(generator.return(value)).resolves.toEqual({
      value,
      done: true,
    })
    // Subsequent calls should return done
    await expect(generator.next()).resolves.toEqual({
      value,
      done: true,
    })
  })

  test('handles throw() with error', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    const error = new Error('Test error')
    const value = { status: 'error', state: 1, error }
    await expect(generator.throw(error)).resolves.toEqual({
      value,
      done: true,
    })
    // Subsequent calls should return done
    await expect(generator.next()).resolves.toEqual({
      value,
      done: true,
    })
  })
})

describe('createFlow()', () => {
  test('returns a generate function returning a generator', async () => {
    const flow = createFlow({ handlers, stateValidator })
    const generator = flow({ state: 1, action: { name: 'add', params: 2 } })

    await expect(generator.next()).resolves.toEqual({
      value: { status: 'action', state: 3, action: 'subtract', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'end', state: 0 },
      done: true,
    })
  })
})

describe('events support', () => {
  type TestEvents = {
    'add:started': { value: number }
    'add:completed': { result: number }
    'subtract:started': { value: number }
    'subtract:completed': { result: number }
  }

  const handlersWithEvents = {
    add: async ({ state, params, emit }: HandlerExecutionContext<number, number, TestEvents>) => {
      const result = state + params
      emit('add:started', { value: state })
      emit('add:completed', { result })
      return { status: 'action', state: result, action: 'subtract', params: 3 }
    },
    subtract: async ({
      state,
      params,
      emit,
    }: HandlerExecutionContext<number, number, TestEvents>) => {
      const result = state - params
      emit('subtract:started', { value: state })
      emit('subtract:completed', { result })
      return { status: 'end', state: result }
    },
  } satisfies HandlersRecord<number, TestEvents>

  test('emits events from handlers', async () => {
    const generator = createGenerator<number, typeof handlersWithEvents>({
      stateValidator,
      handlers: handlersWithEvents,
      state: 1,
      action: { name: 'add', params: 2 },
    })

    const events: Array<{ type: keyof TestEvents; data: TestEvents[keyof TestEvents] }> = []
    generator.events.on('add:started', (data) => {
      events.push({ type: 'add:started', data })
    })
    generator.events.on('add:completed', (data) => {
      events.push({ type: 'add:completed', data })
    })
    generator.events.on('subtract:started', (data) => {
      events.push({ type: 'subtract:started', data })
    })
    generator.events.on('subtract:completed', (data) => {
      events.push({ type: 'subtract:completed', data })
    })

    // Run the flow
    await generator.next()
    await generator.next()

    expect(events).toEqual([
      { type: 'add:started', data: { value: 1 } },
      { type: 'add:completed', data: { result: 3 } },
      { type: 'subtract:started', data: { value: 3 } },
      { type: 'subtract:completed', data: { result: 0 } },
    ])
  })

  test('events are emitted in correct order with state changes', async () => {
    const generator = createGenerator<number, typeof handlersWithEvents>({
      stateValidator,
      handlers: handlersWithEvents,
      state: 1,
      action: { name: 'add', params: 2 },
    })

    const events: Array<{ type: keyof TestEvents; data: TestEvents[keyof TestEvents] }> = []
    generator.events.on('add:started', (data) => {
      events.push({ type: 'add:started', data })
    })
    generator.events.on('add:completed', (data) => {
      events.push({ type: 'add:completed', data })
    })

    // Run first step
    const firstStep = await generator.next()
    expect(firstStep.value).toEqual({ status: 'action', state: 3, action: 'subtract', params: 3 })
    expect(events).toEqual([
      { type: 'add:started', data: { value: 1 } },
      { type: 'add:completed', data: { result: 3 } },
    ])

    // Clear events and listen for subtract events
    events.length = 0
    generator.events.on('subtract:started', (data) => {
      events.push({ type: 'subtract:started', data })
    })
    generator.events.on('subtract:completed', (data) => {
      events.push({ type: 'subtract:completed', data })
    })

    // Run second step
    const secondStep = await generator.next()
    expect(secondStep.value).toEqual({ status: 'end', state: 0 })
    expect(events).toEqual([
      { type: 'subtract:started', data: { value: 3 } },
      { type: 'subtract:completed', data: { result: 0 } },
    ])
  })
})
