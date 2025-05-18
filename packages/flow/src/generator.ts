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

  constructor(taskName: string) {
    super(`Handler for task ${taskName} not found`)
  }
}

export type FlowTask<
  State,
  Handlers extends HandlersRecord<State>,
  Task extends keyof Handlers = keyof Handlers,
> = {
  name: Task & string
  params: Handlers[Task] extends Handler<State, infer P, Record<string, unknown>> ? P : never
}

export type CreateFlowParams<State, Handlers extends HandlersRecord<State>> = {
  handlers: Handlers
  stateValidator: Validator<State>
}

export type GenerateFlowParams<State, Handlers extends HandlersRecord<State>> = {
  signal?: AbortSignal
  state: State
  task?: FlowTask<State, Handlers>
}

export type CreateGeneratorParams<State, Handlers extends HandlersRecord<State>> = CreateFlowParams<
  State,
  Handlers
> &
  GenerateFlowParams<State, Handlers>

export type GenerateNext<State, Handlers extends HandlersRecord<State>> = {
  state?: State
  task: FlowTask<State, Handlers>
}

export type FlowGenerator<State, Handlers extends HandlersRecord<State>> = AsyncGenerator<
  HandlerOutput<State>,
  HandlerReturnOutput<State>,
  GenerateNext<State, Handlers>
> & { events: EventEmitter<HandlersEvents<State, Handlers>> }

export function createGenerator<State, Handlers extends HandlersRecord<State>>(
  params: CreateGeneratorParams<State, Handlers>,
): FlowGenerator<State, Handlers> {
  const { handlers, signal, state: initialState, stateValidator, task: initialTask } = params

  const events = new EventEmitter<HandlersEvents<State, Handlers>>()
  const emit = events.emit.bind(events)

  let currentState = initialState
  let output: HandlerOutput<State> | null = null

  return {
    [Symbol.asyncIterator]() {
      return this
    },
    events,
    next: async (step?: GenerateNext<State, Handlers>) => {
      // Check the flow is not already ended
      if (output != null && output.status !== 'next') {
        return { value: output, done: true }
      }

      // Validate the state
      const state = step?.state ?? currentState
      const validatedState = stateValidator(state)
      if (validatedState instanceof ValidationError) {
        output = { status: 'error', state, error: validatedState }
        return { value: output, done: true }
      }

      // Check the flow is not aborted
      if (signal?.aborted) {
        output = { status: 'aborted', state, reason: signal.reason }
        return { value: output, done: true }
      }

      const task =
        step?.task ?? (output ? { name: output.task, params: output.params } : initialTask)
      if (task == null) {
        output = { status: 'ended', state }
        return { value: output, done: true }
      }

      const handler = handlers[task.name]
      if (handler == null) {
        output = {
          status: 'error',
          state,
          error: new MissingHandlerError(task.name),
        }
        return { value: output, done: true }
      }

      try {
        output = await handler({ state, params: task.params, signal, emit })
        const validatedOutputState = stateValidator(output.state)
        if (validatedOutputState instanceof ValidationError) {
          output = { status: 'error', state: output.state, error: validatedOutputState }
          return { value: output, done: true }
        }
        currentState = output.state
      } catch (cause) {
        const error =
          cause instanceof Error ? cause : new Error('Handler execution failed', { cause })
        output = { status: 'error', state, error }
        return { value: output, done: true }
      }

      // Check the flow is not aborted
      if (signal?.aborted) {
        output = { status: 'aborted', state: output.state, reason: signal.reason }
        return { value: output, done: true }
      }

      return output.status === 'next'
        ? { value: output, done: false }
        : { value: output, done: true }
    },
    return: async (
      returnOutput?: HandlerReturnOutput<State> | PromiseLike<HandlerReturnOutput<State>>,
    ) => {
      output = returnOutput ? await returnOutput : { status: 'ended', state: currentState }
      return { value: output, done: true }
    },
    throw: async (cause?: unknown) => {
      const error = cause instanceof Error ? cause : new Error('Flow execution failed', { cause })
      output = { status: 'error', state: currentState, error }
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
