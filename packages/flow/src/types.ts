import type { EventEmitter } from '@enkaku/event'

export type GenericHandlerContext<Events extends Record<string, unknown> = Record<string, never>> =
  {
    emit: EventEmitter<Events>['emit']
    signal?: AbortSignal
  }

export type HandlerExecutionContext<
  State,
  Params,
  Events extends Record<string, unknown> = Record<string, never>,
> = GenericHandlerContext<Events> & {
  state: State
  params: Params
}

export type HandlerOutput<State, Params = unknown> =
  | { status: 'done'; state: State }
  | { status: 'next'; state: State; task: string; params: Params }
  | { status: 'error'; state: State; error: Error }
  | { status: 'aborted'; state: State; reason: string }

export type Handler<
  State,
  Params,
  Events extends Record<string, unknown> = Record<string, never>,
> = (
  context: HandlerExecutionContext<State, Params, Events>,
) => HandlerOutput<State> | Promise<HandlerOutput<State>>

export type HandlersRecord<
  State,
  Events extends Record<string, unknown> = Record<string, never>,
> = {
  // biome-ignore lint/suspicious/noExplicitAny: needed for type inference
  [K: string]: Handler<State, any, Events>
}

export type HandlerEvents<H> = H extends Handler<unknown, unknown, infer Events> ? Events : never

export type HandlersEvents<State, Handlers extends HandlersRecord<State>> = {
  [K in keyof Handlers]: HandlerEvents<Handlers[K]>
}[keyof Handlers]
