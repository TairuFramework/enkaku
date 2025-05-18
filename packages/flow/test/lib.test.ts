import { EventEmitter } from '@enkaku/event'
import { type Schema, ValidationError, createValidator } from '@enkaku/schema'

import {
  type HandlerExecutionContext,
  type HandlersEvents,
  type HandlersRecord,
  createFlow,
  createFlowGenerator,
} from '../src/index.js'

const stateSchema = { type: 'number' } as const satisfies Schema
const stateValidator = createValidator(stateSchema)

const handlers = {
  add: ({ state, params }: HandlerExecutionContext<number, number>) => {
    return { status: 'next', state: state + params, task: 'subtract', params: 3 }
  },
  subtract: ({ state, params }: HandlerExecutionContext<number, number>) => {
    return { status: 'done', state: state - params }
  },
} satisfies HandlersRecord<number>

describe('createFlowGenerator()', () => {
  test('returns a generator', async () => {
    const events = new EventEmitter<HandlersEvents<number, typeof handlers>>()

    const generator = createFlowGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 1,
      task: { name: 'add', params: 2 },
      events,
    })

    await expect(generator.next()).resolves.toEqual({
      value: { status: 'next', state: 3, task: 'subtract', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'done', state: 0 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: undefined,
      done: true,
    })
  })

  test('returns error when handler for initial task is missing', async () => {
    const events = new EventEmitter<HandlersEvents<number, typeof handlers>>()
    const generator = createFlowGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 1,
      task: { name: 'multiply' as keyof typeof handlers, params: 2 },
      events,
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
      done: false,
    })
  })

  test('returns error when handler for subsequent task is missing', async () => {
    const events = new EventEmitter<HandlersEvents<number, typeof handlers>>()
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

    const generator = createFlowGenerator<number, typeof handlers>({
      stateValidator,
      handlers: handlersWithInvalidNext,
      state: 1,
      task: { name: 'add', params: 2 },
      events,
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
      done: false,
    })
  })

  test('handles abort signal', async () => {
    const events = new EventEmitter<HandlersEvents<number, typeof handlers>>()
    const abortController = new AbortController()

    const generator = createFlowGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 1,
      task: { name: 'add', params: 2 },
      events,
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
      done: false,
    })
  })

  test('returns error when initial state fails validation', async () => {
    const events = new EventEmitter<HandlersEvents<number, typeof handlers>>()
    const generator = createFlowGenerator<number, typeof handlers>({
      stateValidator,
      handlers,
      state: 'invalid' as unknown as number, // Type assertion to test invalid state
      task: { name: 'add', params: 2 },
      events,
    })

    await expect(generator.next()).resolves.toEqual({
      value: {
        status: 'error',
        state: 'invalid',
        error: expect.any(ValidationError),
      },
      done: false,
    })
  })

  test('returns error when handler output state fails validation', async () => {
    const events = new EventEmitter<HandlersEvents<number, typeof handlers>>()
    const handlersWithInvalidOutput = {
      ...handlers,
      add: ({ state, params }: HandlerExecutionContext<number, number>) => {
        return {
          status: 'next' as const,
          state: 'invalid' as unknown as number,
          task: 'subtract',
          params: 3,
        }
      },
    } satisfies typeof handlers

    const generator = createFlowGenerator<number, typeof handlers>({
      stateValidator,
      handlers: handlersWithInvalidOutput,
      state: 1,
      task: { name: 'add', params: 2 },
      events,
    })

    await expect(generator.next()).resolves.toEqual({
      value: {
        status: 'error',
        state: 'invalid',
        error: expect.any(ValidationError),
      },
      done: false,
    })
  })
})

describe('createFlow()', () => {
  test('returns a generate function returning a generator', async () => {
    const flow = createFlow({ handlers, stateValidator })
    const events = new EventEmitter<HandlersEvents<number, typeof handlers>>()
    const generator = flow({ state: 1, task: { name: 'add', params: 2 }, events })

    await expect(generator.next()).resolves.toEqual({
      value: { status: 'next', state: 3, task: 'subtract', params: 3 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: { status: 'done', state: 0 },
      done: false,
    })
    await expect(generator.next()).resolves.toEqual({
      value: undefined,
      done: true,
    })
  })
})
