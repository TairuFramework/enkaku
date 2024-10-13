import type {} from '@enkaku/jwt'
import type {
  AnyDefinition,
  AnyDefinitions,
  AnyServerPayloadOf,
  ChannelDefinition,
  EventDefinition,
  RequestDefinition,
  StreamDefinition,
} from '@enkaku/protocol'

import type { RejectionType } from './rejections.js'

export type RequestController = AbortController

export type ChannelController<Send = unknown> = AbortController & {
  writer: WritableStreamDefaultWriter<Send>
}

export type HandlerController<Send = unknown> = RequestController | ChannelController<Send>

export type EventHandlerContext<Data> = {
  data: Data
}

export type EventHandler<Data> = (context: EventHandlerContext<Data>) => void | Promise<void>

export type RequestHandlerContext<Params> = {
  params: Params
  signal: AbortSignal
}

export type HandlerReturn<Result> = Result | Promise<Result>

export type RequestHandler<Params, Result> = (
  context: RequestHandlerContext<Params>,
) => HandlerReturn<Result>

export type StreamHandlerContext<Params, Receive> = RequestHandlerContext<Params> & {
  writable: WritableStream<Receive>
}

export type StreamHandler<Params, Receive, Result> = (
  context: StreamHandlerContext<Params, Receive>,
) => HandlerReturn<Result>

export type ChannelHandlerContext<Params, Sent, Receive> = StreamHandlerContext<Params, Receive> & {
  readable: ReadableStream<Sent>
}

export type ChannelHandler<Params, Sent, Receive, Result> = (
  context: ChannelHandlerContext<Params, Sent, Receive>,
) => HandlerReturn<Result>

export type CommandHandlers<Definitions> = Definitions extends Record<
  infer Commands extends string,
  AnyDefinition
>
  ? {
      [Command in Commands & string]: Definitions[Command] extends EventDefinition<infer Data>
        ? (context: EventHandlerContext<Data>) => void
        : Definitions[Command] extends RequestDefinition<infer Params, infer Result>
          ? (context: RequestHandlerContext<Params>) => HandlerReturn<Result>
          : Definitions[Command] extends StreamDefinition<infer Params, infer Receive, infer Result>
            ? (context: StreamHandlerContext<Params, Receive>) => HandlerReturn<Result>
            : Definitions[Command] extends ChannelDefinition<
                  infer Params,
                  infer Send,
                  infer Receive,
                  infer Result
                >
              ? (context: ChannelHandlerContext<Params, Send, Receive>) => HandlerReturn<Result>
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
