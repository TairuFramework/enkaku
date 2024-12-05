import type {
  AnyRequestCommandDefinition,
  AnyServerPayloadOf,
  ChannelCommandDefinition,
  DataOf,
  EventCallPayload,
  EventCommandDefinition,
  Message,
  ProtocolDefinition,
  RequestCallPayload,
  RequestCommandDefinition,
  StreamCommandDefinition,
} from '@enkaku/protocol'

import type { RejectionType } from './rejections.js'

export type RequestController = AbortController

export type ChannelController<Send = unknown> = AbortController & {
  writer: WritableStreamDefaultWriter<Send>
}

export type HandlerController<Send = unknown> = RequestController | ChannelController<Send>

export type EventHandlerContext<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends EventCommandDefinition
  ? {
      message: Message<EventCallPayload<Command, DataOf<Protocol[Command]['data']>>>
      data: DataOf<Protocol[Command]['data']>
    }
  : never

export type EventHandler<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = (context: EventHandlerContext<Protocol, Command>) => void | Promise<void>

export type RequestHandlerContext<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends AnyRequestCommandDefinition
  ? {
      message: Message<
        RequestCallPayload<Protocol[Command]['type'], Command, DataOf<Protocol[Command]['params']>>
      >
      params: DataOf<Protocol[Command]['params']>
      signal: AbortSignal
    }
  : never

export type HandlerReturn<ResultSchema, Data = DataOf<ResultSchema>> = Data | Promise<Data>

export type RequestHandler<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends AnyRequestCommandDefinition
  ? (
      context: RequestHandlerContext<Protocol, Command>,
    ) => HandlerReturn<Protocol[Command]['result']>
  : never

export type StreamHandlerContext<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends StreamCommandDefinition | ChannelCommandDefinition
  ? RequestHandlerContext<Protocol, Command> & {
      writable: WritableStream<DataOf<Protocol[Command]['receive']>>
    }
  : never

export type StreamHandler<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends StreamCommandDefinition | ChannelCommandDefinition
  ? (context: StreamHandlerContext<Protocol, Command>) => HandlerReturn<Protocol[Command]['result']>
  : never

export type ChannelHandlerContext<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends ChannelCommandDefinition
  ? StreamHandlerContext<Protocol, Command> & {
      readable: ReadableStream<DataOf<Protocol[Command]['send']>>
    }
  : never

export type ChannelHandler<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends ChannelCommandDefinition
  ? (
      context: ChannelHandlerContext<Protocol, Command>,
    ) => HandlerReturn<Protocol[Command]['result']>
  : never

export type CommandHandlers<Protocol extends ProtocolDefinition> = {
  [Command in keyof Protocol & string]: Protocol[Command] extends EventCommandDefinition
    ? (context: EventHandlerContext<Protocol, Command>) => void
    : Protocol[Command] extends RequestCommandDefinition
      ? (
          context: RequestHandlerContext<Protocol, Command>,
        ) => HandlerReturn<Protocol[Command]['result']>
      : Protocol[Command] extends StreamCommandDefinition
        ? (
            context: StreamHandlerContext<Protocol, Command>,
          ) => HandlerReturn<Protocol[Command]['result']>
        : Protocol[Command] extends ChannelCommandDefinition
          ? (
              context: ChannelHandlerContext<Protocol, Command>,
            ) => HandlerReturn<Protocol[Command]['result']>
          : never
}

export type EventDataType<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends EventCommandDefinition ? DataOf<Protocol[Command]['data']> : never

export type ParamsType<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends AnyRequestCommandDefinition
  ? DataOf<Protocol[Command]['params']>
  : never

export type ReceiveType<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends StreamCommandDefinition
  ? DataOf<Protocol[Command]['receive']>
  : Protocol[Command] extends ChannelCommandDefinition
    ? DataOf<Protocol[Command]['receive']>
    : never

export type ResultType<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends AnyRequestCommandDefinition
  ? DataOf<Protocol[Command]['result']>
  : never

export type SendType<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
> = Protocol[Command] extends ChannelCommandDefinition ? DataOf<Protocol[Command]['send']> : never

export type HandlerContext<Protocol extends ProtocolDefinition> = {
  controllers: Record<string, HandlerController>
  handlers: CommandHandlers<Protocol>
  reject: (rejection: RejectionType) => void
  send: (payload: AnyServerPayloadOf<Protocol>) => Promise<void>
}
