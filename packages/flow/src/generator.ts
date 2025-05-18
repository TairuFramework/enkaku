import type { EventEmitter } from '@enkaku/event'
import { ValidationError, type Validator } from '@enkaku/schema'

import type { Handler, HandlerOutput, HandlersEvents, HandlersRecord } from './types.js'

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
  stateValidator: Validator<State>
  handlers: Handlers
}

export type GenerateFlowParams<State, Handlers extends HandlersRecord<State>> = {
  events: EventEmitter<HandlersEvents<State, Handlers>>
  state: State
  task: FlowTask<State, Handlers>
  signal?: AbortSignal
}

export type FlowGeneratorParams<State, Handlers extends HandlersRecord<State>> = CreateFlowParams<
  State,
  Handlers
> &
  GenerateFlowParams<State, Handlers>

export async function* createFlowGenerator<State, Handlers extends HandlersRecord<State>>(
  params: FlowGeneratorParams<State, Handlers>,
): AsyncGenerator<HandlerOutput<State>> {
  const { events, handlers, signal, state, stateValidator, task } = params

  // Sanity check that the provided state is valid
  const validatedInitialState = stateValidator(state)
  if (validatedInitialState instanceof ValidationError) {
    yield { status: 'error', state, error: validatedInitialState }
    return
  }

  // Early return if the flow is aborted
  if (signal?.aborted) {
    yield { status: 'aborted', state, reason: signal.reason }
    return
  }

  const initialHandler = handlers[task.name]
  if (initialHandler == null) {
    yield { status: 'error', state, error: new MissingHandlerError(task.name) }
    return
  }

  const emit = events.emit.bind(events)

  let output = await initialHandler({ state, params: task.params, signal, emit })
  while (true) {
    const validatedState = stateValidator(output.state)
    if (validatedState instanceof ValidationError) {
      yield { status: 'error', state: output.state, error: validatedState }
      return
    }

    if (signal?.aborted) {
      yield { status: 'aborted', state: output.state, reason: signal.reason }
      return
    }

    if (output.status === 'next') {
      yield output
      const handler = handlers[output.task]
      if (handler == null) {
        yield { status: 'error', state: output.state, error: new MissingHandlerError(output.task) }
        return
      }
      output = await handler({ state: output.state, params: output.params, signal, emit })
    } else {
      yield output
      return
    }
  }
}

export function createFlow<State, Handlers extends HandlersRecord<State>>(
  flowParams: CreateFlowParams<State, Handlers>,
) {
  return function generateFlow(params: GenerateFlowParams<State, Handlers>) {
    return createFlowGenerator({ ...flowParams, ...params })
  }
}
