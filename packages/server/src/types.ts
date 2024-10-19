import type { Token } from '@enkaku/jwt'
import type {
  AnyDefinition,
  AnyDefinitions,
  AnyServerPayloadOf,
  ChannelDefinition,
  EventCallPayload,
  EventDefinition,
  RequestCallPayload,
  RequestDefinition,
  RequestType,
  StreamDefinition,
} from '@enkaku/protocol'

import type { RejectionType } from './rejections.js'

export type RequestController = AbortController

export type ChannelController<Send = unknown> = AbortController & {
  writer: WritableStreamDefaultWriter<Send>
}

export type HandlerController<Send = unknown> = RequestController | ChannelController<Send>

export type EventHandlerContext<
  Command extends string,
  Data extends Record<string, unknown> | undefined,
> = {
  message: Token<EventCallPayload<Command, Data>>
  data: Data
}

export type EventHandler<
  Command extends string,
  Data extends Record<string, unknown> | undefined,
> = (context: EventHandlerContext<Command, Data>) => void | Promise<void>

export type RequestHandlerContext<Type extends RequestType, Command extends string, Params> = {
  message: Token<RequestCallPayload<Type, Command, Params>>
  params: Params
  signal: AbortSignal
}

export type HandlerReturn<Result> = Result | Promise<Result>

export type RequestHandler<Command extends string, Params, Result> = (
  context: RequestHandlerContext<'request', Command, Params>,
) => HandlerReturn<Result>

export type StreamHandlerContext<
  Type extends Exclude<RequestType, 'request'>,
  Command extends string,
  Params,
  Receive,
> = RequestHandlerContext<Type, Command, Params> & {
  writable: WritableStream<Receive>
}

export type StreamHandler<Command extends string, Params, Receive, Result> = (
  context: StreamHandlerContext<'stream', Command, Params, Receive>,
) => HandlerReturn<Result>

export type ChannelHandlerContext<
  Command extends string,
  Params,
  Sent,
  Receive,
> = StreamHandlerContext<'channel', Command, Params, Receive> & {
  readable: ReadableStream<Sent>
}

export type ChannelHandler<Command extends string, Params, Sent, Receive, Result> = (
  context: ChannelHandlerContext<Command, Params, Sent, Receive>,
) => HandlerReturn<Result>

export type CommandHandlers<Definitions> = Definitions extends Record<
  infer Commands extends string,
  AnyDefinition
>
  ? {
      [Command in Commands & string]: Definitions[Command] extends EventDefinition<infer Data>
        ? (context: EventHandlerContext<Command, Data>) => void
        : Definitions[Command] extends RequestDefinition<infer Params, infer Result>
          ? (context: RequestHandlerContext<'request', Command, Params>) => HandlerReturn<Result>
          : Definitions[Command] extends StreamDefinition<infer Params, infer Receive, infer Result>
            ? (
                context: StreamHandlerContext<'stream', Command, Params, Receive>,
              ) => HandlerReturn<Result>
            : Definitions[Command] extends ChannelDefinition<
                  infer Params,
                  infer Send,
                  infer Receive,
                  infer Result
                >
              ? (
                  context: ChannelHandlerContext<Command, Params, Send, Receive>,
                ) => HandlerReturn<Result>
              : never
    }
  : Record<string, never>

export type EventDataType<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string,
> = Definitions[Command] extends EventDefinition<infer Data> ? Data : never

export type ParamsType<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string,
> = Definitions[Command] extends RequestDefinition<infer Params>
  ? Params
  : Definitions[Command] extends StreamDefinition<infer Params>
    ? Params
    : Definitions[Command] extends ChannelDefinition<infer Params>
      ? Params
      : never

export type ReceiveType<
  Definitions extends Record<string, unknown>,
  Command extends keyof Definitions & string,
> = Definitions[Command] extends StreamDefinition<infer Params, infer Receive>
  ? Receive
  : Definitions[Command] extends ChannelDefinition<infer Params, infer Send, infer Receive>
    ? Receive
    : never

export type ResultType<
  Definitions extends Record<string, unknown>,
  Command extends keyof Definitions & string,
> = Definitions[Command] extends RequestDefinition<infer Params, infer Result>
  ? Result
  : Definitions[Command] extends StreamDefinition<infer Params, infer Receive, infer Result>
    ? Result
    : Definitions[Command] extends ChannelDefinition<
          infer Params,
          infer Send,
          infer Receive,
          infer Result
        >
      ? Result
      : never

export type SendType<
  Definitions extends Record<string, unknown>,
  Command extends keyof Definitions & string,
> = Definitions[Command] extends ChannelDefinition<infer Params, infer Send> ? Send : never

export type HandlerContext<Definitions extends AnyDefinitions> = {
  controllers: Record<string, HandlerController>
  handlers: CommandHandlers<Definitions>
  reject: (rejection: RejectionType) => void
  send: (payload: AnyServerPayloadOf<Definitions>) => Promise<void>
}
