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
    return { status: 'next', state: state + params, task: 'subtract', params: 3 }
  },
  subtract: ({ state, params }: HandlerExecutionContext<number, number>) => {
    return { status: 'ended', state: state - params }
  },
} satisfies HandlersRecord<number>

describe('createGenerator()', () => {
  test('returns a generator', async () => {
    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 1,
      task: { name: 'add', params: 2 },
    })

    await expect(generator.next()).resolves.toEqual({
      value: { status: 'next', state: 3, task: 'subtract', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'ended', state: 0 },
      done: true,
    })
  })

  test('returns error when handler for initial task is missing', async () => {
    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 1,
      task: { name: 'multiply' as keyof typeof handlers, params: 2 },
    })

    await expect(generator.next()).resolves.toEqual({
      value: {
        status: 'error',
        state: 1,
        error: expect.objectContaining({
          name: 'MissingHandler',
          message: 'Handler for task multiply not found',
        }),
      },
      done: true,
    })
  })

  test('returns error when handler for subsequent task is missing', async () => {
    const handlersWithInvalidNext = {
      ...handlers,
      add: ({ state, params }: HandlerExecutionContext<number, number>) => {
        return {
          status: 'next' as const,
          state: state + params,
          task: 'multiply' as keyof typeof handlers,
          params: 3,
        }
      },
    } satisfies typeof handlers

    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers: handlersWithInvalidNext,
      state: 1,
      task: { name: 'add', params: 2 },
    })

    await expect(generator.next()).resolves.toEqual({
      value: { status: 'next', state: 3, task: 'multiply', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: {
        status: 'error',
        state: 3,
        error: expect.objectContaining({
          name: 'MissingHandler',
          message: 'Handler for task multiply not found',
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
      task: { name: 'add', params: 2 },
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
      task: { name: 'add', params: 2 },
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
          status: 'next' as const,
          state: 'invalid' as unknown as number,
          task: 'subtract',
          params: 3,
        }
      },
    } satisfies typeof handlers

    const generator = createGenerator<number, typeof handlers>({
      stateValidator,
      handlers: handlersWithInvalidOutput,
      state: 1,
      task: { name: 'add', params: 2 },
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

  test('can be provided a task when calling next()', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    await expect(generator.next({ task: { name: 'add', params: 2 } })).resolves.toEqual({
      value: { status: 'next', state: 3, task: 'subtract', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'ended', state: 0 },
      done: true,
    })
  })

  test('can be provided state when calling next()', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    await expect(generator.next({ state: 2, task: { name: 'add', params: 2 } })).resolves.toEqual({
      value: { status: 'next', state: 4, task: 'subtract', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'ended', state: 1 },
      done: true,
    })
  })

  test('ends when calling next() with no task', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'ended', state: 1 },
      done: true,
    })
  })

  test('handles return() with final value', async () => {
    const generator = createGenerator({ handlers, stateValidator, state: 1 })
    const value = { status: 'ended', state: 42 } as const
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
    const generator = flow({ state: 1, task: { name: 'add', params: 2 } })

    await expect(generator.next()).resolves.toEqual({
      value: { status: 'next', state: 3, task: 'subtract', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'ended', state: 0 },
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
      return { status: 'next', state: result, task: 'subtract', params: 3 }
    },
    subtract: async ({
      state,
      params,
      emit,
    }: HandlerExecutionContext<number, number, TestEvents>) => {
      const result = state - params
      emit('subtract:started', { value: state })
      emit('subtract:completed', { result })
      return { status: 'ended', state: result }
    },
  } satisfies HandlersRecord<number, TestEvents>

  test('emits events from handlers', async () => {
    const generator = createGenerator<number, typeof handlersWithEvents>({
      stateValidator,
      handlers: handlersWithEvents,
      state: 1,
      task: { name: 'add', params: 2 },
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
      task: { name: 'add', params: 2 },
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
    expect(firstStep.value).toEqual({ status: 'next', state: 3, task: 'subtract', params: 3 })
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
    expect(secondStep.value).toEqual({ status: 'ended', state: 0 })
    expect(events).toEqual([
      { type: 'subtract:started', data: { value: 3 } },
      { type: 'subtract:completed', data: { result: 0 } },
    ])
  })
})
