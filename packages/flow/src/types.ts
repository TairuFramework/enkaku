import type { EventEmitter } from '@enkaku/event'

export type GeneratorDoneValue<State extends Record<string, unknown>> =
  | { status: 'aborted'; state: State; reason: string }
  | { status: 'end'; state: State }
  | { status: 'error'; state: State; error: Error }

export type GeneratorValue<State extends Record<string, unknown>, Params = unknown> =
  | GeneratorDoneValue<State>
  | { status: 'action'; state: State; action: string; params: Params }
  | { status: 'state'; state: State }

/** @internal */
export function isDoneValue<State extends Record<string, unknown>>(
  value: GeneratorValue<State>,
): value is GeneratorDoneValue<State> {
  return value.status === 'aborted' || value.status === 'end' || value.status === 'error'
}

export type GenericHandlerContext<Events extends Record<string, unknown> = Record<string, never>> =
  {
    emit: EventEmitter<Events>['emit']
    signal?: AbortSignal
  }

export type HandlerExecutionContext<
  State extends Record<string, unknown>,
  Params extends Record<string, unknown>,
  Events extends Record<string, unknown> = Record<string, never>,
> = GenericHandlerContext<Events> & {
  state: State
  params: Params
}

export type Handler<
  State extends Record<string, unknown>,
  Params extends Record<string, unknown>,
  Events extends Record<string, unknown> = Record<string, never>,
> = (
  context: HandlerExecutionContext<State, Params, Events>,
) => GeneratorValue<State> | Promise<GeneratorValue<State>>

export type HandlersRecord<
  State extends Record<string, unknown>,
  Events extends Record<string, unknown> = Record<string, never>,
> = {
  // biome-ignore lint/suspicious/noExplicitAny: needed for type inference
  [K: string]: Handler<State, any, Events>
}

export type HandlerEvents<H> = H extends Handler<
  Record<string, unknown>,
  Record<string, unknown>,
  infer Events
>
  ? Events
  : never

export type HandlersEvents<
  State extends Record<string, unknown>,
  Handlers extends HandlersRecord<State>,
> = {
  [K in keyof Handlers]: HandlerEvents<Handlers[K]>
}[keyof Handlers]
