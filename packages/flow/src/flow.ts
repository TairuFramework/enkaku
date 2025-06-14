import { EventEmitter } from '@enkaku/event'
import { ValidationError, type Validator } from '@enkaku/schema'

import type { GeneratorDoneValue, GeneratorValue, HandlersEvents, HandlersRecord } from './types.js'
import { isDoneValue } from './types.js'

function toError(cause: unknown, message: string): Error {
  return cause instanceof Error ? cause : new Error(message, { cause })
}

export class MissingHandlerError extends Error {
  name = 'MissingHandler'

  constructor(action: string) {
    super(`Handler for action ${action} not found`)
  }
}

export type FlowAction<
  State extends Record<string, unknown>,
  Handlers extends HandlersRecord<State>,
  Action extends keyof Handlers = keyof Handlers,
> = {
  name: Action & string
  params: Parameters<Handlers[Action]>[0]['params']
}

export type CreateFlowParams<
  State extends Record<string, unknown>,
  Handlers extends HandlersRecord<State, Record<string, unknown>> = HandlersRecord<State>,
> = {
  handlers: Handlers
  stateValidator?: Validator<State>
}

export type GenerateFlowParams<
  State extends Record<string, unknown>,
  Handlers extends HandlersRecord<State, Record<string, unknown>> = HandlersRecord<State>,
> = {
  signal?: AbortSignal
  state: State
  action?: FlowAction<State, Handlers>
}

export type CreateGeneratorParams<
  State extends Record<string, unknown>,
  Handlers extends HandlersRecord<State, Record<string, unknown>> = HandlersRecord<State>,
> = CreateFlowParams<State, Handlers> & GenerateFlowParams<State, Handlers>

export type GenerateNext<
  State extends Record<string, unknown>,
  Handlers extends HandlersRecord<State, Record<string, unknown>> = HandlersRecord<State>,
> = {
  action?: FlowAction<State, Handlers>
  signal?: AbortSignal
  state?: State
}

export type FlowGenerator<
  State extends Record<string, unknown>,
  Handlers extends HandlersRecord<State, Record<string, unknown>> = HandlersRecord<State>,
> = AsyncGenerator<
  GeneratorValue<State>,
  GeneratorDoneValue<State> | undefined,
  GenerateNext<State, Handlers> | undefined
> & {
  events: EventEmitter<HandlersEvents<State, Handlers>>
  getState(): Readonly<State>
}

export function createGenerator<
  State extends Record<string, unknown>,
  Handlers extends HandlersRecord<State, Record<string, unknown>> = HandlersRecord<State>,
>(params: CreateGeneratorParams<State, Handlers>): FlowGenerator<State, Handlers> {
  const {
    handlers,
    signal: flowSignal,
    state: initialState,
    stateValidator,
    action: defaultAction,
  } = params

  const events = new EventEmitter<HandlersEvents<State, Handlers>>()
  const emit = events.emit.bind(events)

  let value: GeneratorValue<State> = { status: 'state', state: initialState }

  return {
    async [Symbol.asyncDispose]() {
      await this.return(undefined)
    },
    [Symbol.asyncIterator]() {
      return this
    },
    events,
    getState: () => Object.freeze(value.state),
    next: async (step?: GenerateNext<State, Handlers>) => {
      // Check the flow is not already ended
      if (isDoneValue(value)) {
        return { value, done: true }
      }

      // Check the step is not aborted
      if (step?.signal?.aborted) {
        return { value, done: false }
      }

      // Validate the state
      const state = step?.state ?? value.state
      if (stateValidator != null) {
        const validatedState = stateValidator(state)
        if (validatedState instanceof ValidationError) {
          value = { status: 'error', state, error: validatedState }
          return { value, done: true }
        }
      }

      // Check the flow is not aborted
      if (flowSignal?.aborted) {
        value = { status: 'aborted', state, reason: flowSignal.reason }
        return { value, done: true }
      }

      if (step?.state != null && step?.action == null) {
        value = { status: 'state', state: step.state }
        return { value, done: false }
      }

      const nextAction =
        value?.status === 'action' ? { name: value.action, params: value.params } : null
      const action = step?.action ?? nextAction ?? defaultAction
      if (action == null) {
        value = { status: 'end', state }
        return { value, done: true }
      }

      const handler = handlers[action.name]
      if (handler == null) {
        value = {
          status: 'error',
          state,
          error: new MissingHandlerError(action.name),
        }
        return { value, done: true }
      }

      try {
        const nextValue = await handler({
          state,
          params: action.params,
          signal: AbortSignal.any([flowSignal, step?.signal].filter((s) => s != null)),
          emit,
        })
        // Don't update the state if the action is aborted
        if (step?.signal?.aborted) {
          return { value, done: false }
        }

        value = nextValue
        if (stateValidator != null) {
          const validatedOutputState = stateValidator(value.state)
          if (validatedOutputState instanceof ValidationError) {
            value = { status: 'error', state: value.state, error: validatedOutputState }
            return { value, done: true }
          }
        }
      } catch (cause) {
        // Don't update the state if the action is aborted
        if (step?.signal?.aborted) {
          return { value, done: false }
        }

        value = { status: 'error', state, error: toError(cause, 'Handler execution failed') }
        return { value, done: true }
      }

      // Check the flow is not aborted
      if (flowSignal?.aborted) {
        value = { status: 'aborted', state: value.state, reason: flowSignal.reason }
        return { value, done: true }
      }

      return isDoneValue(value) ? { value, done: true } : { value, done: false }
    },
    return: async (
      returnValue?: GeneratorDoneValue<State> | PromiseLike<GeneratorDoneValue<State>>,
    ) => {
      value = returnValue ? await returnValue : { status: 'end', state: value.state }
      return { value, done: true }
    },
    throw: async (cause?: unknown) => {
      value = {
        status: 'error',
        state: value.state,
        error: toError(cause, 'Flow execution failed'),
      }
      return { value, done: true }
    },
  }
}

export function createFlow<
  State extends Record<string, unknown>,
  Handlers extends HandlersRecord<State, Record<string, unknown>> = HandlersRecord<State>,
>(flowParams: CreateFlowParams<State, Handlers>) {
  return function generateFlow(params: GenerateFlowParams<State, Handlers>) {
    return createGenerator({ ...flowParams, ...params })
  }
}
