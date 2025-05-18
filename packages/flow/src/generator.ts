import { EventEmitter } from '@enkaku/event'
import { ValidationError, type Validator } from '@enkaku/schema'

import type {
  Handler,
  HandlerOutput,
  HandlerReturnOutput,
  HandlersEvents,
  HandlersRecord,
} from './types.js'

export class MissingHandlerError extends Error {
  name = 'MissingHandler'

  constructor(action: string) {
    super(`Handler for action ${action} not found`)
  }
}

export type FlowAction<
  State,
  Handlers extends HandlersRecord<State>,
  Action extends keyof Handlers = keyof Handlers,
> = {
  name: Action & string
  params: Handlers[Action] extends Handler<State, infer P, Record<string, unknown>> ? P : never
}

export type CreateFlowParams<State, Handlers extends HandlersRecord<State>> = {
  handlers: Handlers
  stateValidator: Validator<State>
}

export type GenerateFlowParams<State, Handlers extends HandlersRecord<State>> = {
  signal?: AbortSignal
  state: State
  action?: FlowAction<State, Handlers>
}

export type CreateGeneratorParams<State, Handlers extends HandlersRecord<State>> = CreateFlowParams<
  State,
  Handlers
> &
  GenerateFlowParams<State, Handlers>

export type GenerateNext<State, Handlers extends HandlersRecord<State>> = {
  action?: FlowAction<State, Handlers>
  signal?: AbortSignal
  state?: State
}

export type FlowGenerator<State, Handlers extends HandlersRecord<State>> = AsyncGenerator<
  HandlerOutput<State>,
  HandlerReturnOutput<State>,
  GenerateNext<State, Handlers>
> & { events: EventEmitter<HandlersEvents<State, Handlers>> }

export function createGenerator<State, Handlers extends HandlersRecord<State>>(
  params: CreateGeneratorParams<State, Handlers>,
): FlowGenerator<State, Handlers> {
  const {
    handlers,
    signal: flowSignal,
    state: initialState,
    stateValidator,
    action: initialAction,
  } = params

  const events = new EventEmitter<HandlersEvents<State, Handlers>>()
  const emit = events.emit.bind(events)

  let output: HandlerOutput<State> = { status: 'state', state: initialState }

  return {
    [Symbol.asyncIterator]() {
      return this
    },
    events,
    next: async (step?: GenerateNext<State, Handlers>) => {
      // Check the flow is not already ended
      if (['aborted', 'end', 'error'].includes(output.status)) {
        return { value: output as HandlerReturnOutput<State>, done: true }
      }

      // Check the step is not aborted
      if (step?.signal?.aborted) {
        return { value: output, done: false }
      }

      // Validate the state
      const state = step?.state ?? output.state
      const validatedState = stateValidator(state)
      if (validatedState instanceof ValidationError) {
        output = { status: 'error', state, error: validatedState }
        return { value: output, done: true }
      }

      // Check the flow is not aborted
      if (flowSignal?.aborted) {
        output = { status: 'aborted', state, reason: flowSignal.reason }
        return { value: output, done: true }
      }

      if (step?.state != null && step?.action == null) {
        output = { status: 'state', state: step.state }
        return { value: output, done: false }
      }

      const outputAction =
        output?.status === 'action' ? { name: output.action, params: output.params } : null
      const action = step?.action ?? outputAction ?? initialAction
      if (action == null) {
        output = { status: 'end', state }
        return { value: output, done: true }
      }

      const handler = handlers[action.name]
      if (handler == null) {
        output = {
          status: 'error',
          state,
          error: new MissingHandlerError(action.name),
        }
        return { value: output, done: true }
      }

      try {
        const nextOutput = await handler({
          state,
          params: action.params,
          signal: AbortSignal.any([flowSignal, step?.signal].filter((s) => s != null)),
          emit,
        })
        // Don't update the state if the action is aborted
        if (step?.signal?.aborted) {
          return { value: output as HandlerReturnOutput<State>, done: false }
        }

        output = nextOutput
        const validatedOutputState = stateValidator(output.state)
        if (validatedOutputState instanceof ValidationError) {
          output = { status: 'error', state: output.state, error: validatedOutputState }
          return { value: output, done: true }
        }
      } catch (cause) {
        // Don't update the state if the action is aborted
        if (step?.signal?.aborted) {
          return { value: output as HandlerReturnOutput<State>, done: false }
        }

        const error =
          cause instanceof Error ? cause : new Error('Handler execution failed', { cause })
        output = { status: 'error', state, error }
        return { value: output, done: true }
      }

      // Check the flow is not aborted
      if (flowSignal?.aborted) {
        output = { status: 'aborted', state: output.state, reason: flowSignal.reason }
        return { value: output, done: true }
      }

      return output.status === 'action' || output.status === 'state'
        ? { value: output, done: false }
        : { value: output, done: true }
    },
    return: async (
      returnOutput?: HandlerReturnOutput<State> | PromiseLike<HandlerReturnOutput<State>>,
    ) => {
      output = returnOutput ? await returnOutput : { status: 'end', state: output.state }
      return { value: output, done: true }
    },
    throw: async (cause?: unknown) => {
      const error = cause instanceof Error ? cause : new Error('Flow execution failed', { cause })
      output = { status: 'error', state: output.state, error }
      return { value: output, done: true }
    },
  }
}

export function createFlow<State, Handlers extends HandlersRecord<State>>(
  flowParams: CreateFlowParams<State, Handlers>,
) {
  return function generateFlow(params: GenerateFlowParams<State, Handlers>) {
    return createGenerator({ ...flowParams, ...params })
  }
}
