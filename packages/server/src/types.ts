import type {
  AnyActionDefinition,
  AnyActionDefinitions,
  AnyServerMessageOf,
  ChannelActionDefinition,
  ChannelActionPayload,
  EventActionDefinition,
  OptionalRecord,
  RequestActionDefinition,
  RequestActionPayload,
  StreamActionDefinition,
  StreamActionPayload,
} from '@enkaku/protocol'

import type { RejectionType } from './rejections.js'

export type RequestController = AbortController

export type ChannelController<Send = unknown> = AbortController & {
  writer: WritableStreamDefaultWriter<Send>
}

export type ActionController<Send = unknown> = RequestController | ChannelController<Send>

export type EventHandlerContext<Data, Meta extends OptionalRecord> = {
  data: Data
  meta: Meta
}

export type EventHandler<Data, Meta extends OptionalRecord> = (
  context: EventHandlerContext<Data, Meta>,
) => void | Promise<void>

export type RequestHandlerContext<Params, Meta extends OptionalRecord> = {
  params: Params
  meta: Meta
  signal: AbortSignal
}

export type HandlerReturn<Result> = Result | Promise<Result>

export type RequestHandler<Params, Result, Meta extends OptionalRecord> = (
  context: RequestHandlerContext<Params, Meta>,
) => HandlerReturn<Result>

export type StreamHandlerContext<
  Params,
  Receive,
  Meta extends OptionalRecord,
> = RequestHandlerContext<Params, Meta> & {
  writable: WritableStream<Receive>
}

export type StreamHandler<Params, Receive, Result, Meta extends OptionalRecord> = (
  context: StreamHandlerContext<Params, Receive, Meta>,
) => HandlerReturn<Result>

export type ChannelHandlerContext<
  Params,
  Sent,
  Receive,
  Meta extends OptionalRecord,
> = StreamHandlerContext<Params, Receive, Meta> & {
  readable: ReadableStream<Sent>
}

export type ChannelHandler<
  Params,
  Sent,
  Receive,
  Result,
  Meta extends OptionalRecord = OptionalRecord,
> = (context: ChannelHandlerContext<Params, Sent, Receive, Meta>) => HandlerReturn<Result>

export type ActionHandlers<Definitions, Meta extends OptionalRecord> = Definitions extends Record<
  infer Names extends string,
  AnyActionDefinition
>
  ? {
      [Name in Names & string]: Definitions[Name] extends EventActionDefinition<infer Data>
        ? (context: EventHandlerContext<Data, Meta>) => void
        : Definitions[Name] extends RequestActionDefinition<infer Params, infer Result>
          ? (context: RequestHandlerContext<Params, Meta>) => HandlerReturn<Result>
          : Definitions[Name] extends StreamActionDefinition<
                infer Params,
                infer Receive,
                infer Result
              >
            ? (context: StreamHandlerContext<Params, Receive, Meta>) => HandlerReturn<Result>
            : Definitions[Name] extends ChannelActionDefinition<
                  infer Params,
                  infer Send,
                  infer Receive,
                  infer Result
                >
              ? (
                  context: ChannelHandlerContext<Params, Send, Receive, Meta>,
                ) => HandlerReturn<Result>
              : never
    }
  : Record<string, never>

export type EventDataType<
  Definitions extends AnyActionDefinitions,
  Name extends keyof Definitions & string,
> = Definitions[Name] extends EventActionDefinition<infer Data> ? Data : never

export type ActionParamsType<
  Definitions extends AnyActionDefinitions,
  Name extends keyof Definitions & string,
> = Definitions[Name] extends RequestActionDefinition<infer Params>
  ? Params
  : Definitions[Name] extends StreamActionDefinition<infer Params>
    ? Params
    : Definitions[Name] extends ChannelActionDefinition<infer Params>
      ? Params
      : never

export type ActionReceiveType<
  Definitions extends Record<string, unknown>,
  Name extends keyof Definitions & string,
> = Definitions[Name] extends StreamActionDefinition<infer Params, infer Receive>
  ? Receive
  : Definitions[Name] extends ChannelActionDefinition<infer Params, infer Send, infer Receive>
    ? Receive
    : never

export type ActionResultType<
  Definitions extends Record<string, unknown>,
  Name extends keyof Definitions & string,
> = Definitions[Name] extends RequestActionDefinition<infer Params, infer Result>
  ? Result
  : Definitions[Name] extends StreamActionDefinition<infer Params, infer Receive, infer Result>
    ? Result
    : Definitions[Name] extends ChannelActionDefinition<
          infer Params,
          infer Send,
          infer Receive,
          infer Result
        >
      ? Result
      : never

export type ActionSendType<
  Definitions extends Record<string, unknown>,
  Name extends keyof Definitions & string,
> = Definitions[Name] extends ChannelActionDefinition<infer Params, infer Send> ? Send : never

export type ExecuteHandlerActionPayload<Name extends string = string> =
  // biome-ignore lint/suspicious/noExplicitAny: any params
  RequestActionPayload<Name, any> | StreamActionPayload<Name, any> | ChannelActionPayload<Name, any>

export type HandlerContext<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
> = {
  controllers: Record<string, ActionController>
  handlers: ActionHandlers<Definitions, Meta>
  reject: (rejection: RejectionType) => void
  send: (message: AnyServerMessageOf<Definitions>) => Promise<void>
}
