import type { EventEmitter } from '@enkaku/event'
import type {
  AnyRequestProcedureDefinition,
  AnyServerPayloadOf,
  ChannelProcedureDefinition,
  DataOf,
  EventCallPayload,
  EventProcedureDefinition,
  Message,
  ProtocolDefinition,
  RequestCallPayload,
  RequestProcedureDefinition,
  ReturnOf,
  StreamProcedureDefinition,
} from '@enkaku/protocol'

export type RequestController = AbortController

export type ChannelController<Send = unknown> = AbortController & {
  writer: WritableStreamDefaultWriter<Send>
}

export type HandlerController<Send = unknown> = RequestController | ChannelController<Send>

export type EventHandlerContext<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends EventProcedureDefinition
  ? {
      message: Message<EventCallPayload<Procedure, DataOf<Protocol[Procedure]['data']>>>
      data: DataOf<Protocol[Procedure]['data']>
    }
  : never

export type EventHandler<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = (context: EventHandlerContext<Protocol, Procedure>) => void | Promise<void>

export type RequestHandlerContext<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends AnyRequestProcedureDefinition
  ? {
      message: Message<
        RequestCallPayload<
          Protocol[Procedure]['type'],
          Procedure,
          DataOf<Protocol[Procedure]['param']>
        >
      >
      param: DataOf<Protocol[Procedure]['param']>
      signal: AbortSignal
    }
  : never

export type HandlerReturn<ResultSchema, Result = ReturnOf<ResultSchema>> = Result | Promise<Result>

export type RequestHandler<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends AnyRequestProcedureDefinition
  ? (
      context: RequestHandlerContext<Protocol, Procedure>,
    ) => HandlerReturn<Protocol[Procedure]['result']>
  : never

export type StreamHandlerContext<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends StreamProcedureDefinition | ChannelProcedureDefinition
  ? RequestHandlerContext<Protocol, Procedure> & {
      writable: WritableStream<DataOf<Protocol[Procedure]['receive']>>
    }
  : never

export type StreamHandler<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends StreamProcedureDefinition | ChannelProcedureDefinition
  ? (
      context: StreamHandlerContext<Protocol, Procedure>,
    ) => HandlerReturn<Protocol[Procedure]['result']>
  : never

export type ChannelHandlerContext<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends ChannelProcedureDefinition
  ? StreamHandlerContext<Protocol, Procedure> & {
      readable: ReadableStream<DataOf<Protocol[Procedure]['send']>>
    }
  : never

export type ChannelHandler<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends ChannelProcedureDefinition
  ? (
      context: ChannelHandlerContext<Protocol, Procedure>,
    ) => HandlerReturn<Protocol[Procedure]['result']>
  : never

export type ProcedureHandlers<Protocol extends ProtocolDefinition> = {
  [Procedure in keyof Protocol & string]: Protocol[Procedure] extends EventProcedureDefinition
    ? (context: EventHandlerContext<Protocol, Procedure>) => void
    : Protocol[Procedure] extends RequestProcedureDefinition
      ? (
          context: RequestHandlerContext<Protocol, Procedure>,
        ) => HandlerReturn<Protocol[Procedure]['result']>
      : Protocol[Procedure] extends StreamProcedureDefinition
        ? (
            context: StreamHandlerContext<Protocol, Procedure>,
          ) => HandlerReturn<Protocol[Procedure]['result']>
        : Protocol[Procedure] extends ChannelProcedureDefinition
          ? (
              context: ChannelHandlerContext<Protocol, Procedure>,
            ) => HandlerReturn<Protocol[Procedure]['result']>
          : never
}

export type EventDataType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends EventProcedureDefinition
  ? DataOf<Protocol[Procedure]['data']>
  : never

export type ParamType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends AnyRequestProcedureDefinition
  ? DataOf<Protocol[Procedure]['param']>
  : never

export type ReceiveType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends StreamProcedureDefinition
  ? DataOf<Protocol[Procedure]['receive']>
  : Protocol[Procedure] extends ChannelProcedureDefinition
    ? DataOf<Protocol[Procedure]['receive']>
    : never

export type ResultType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends AnyRequestProcedureDefinition
  ? DataOf<Protocol[Procedure]['result']>
  : never

export type SendType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> = Protocol[Procedure] extends ChannelProcedureDefinition
  ? DataOf<Protocol[Procedure]['send']>
  : never

export type ServerEvents = {
  handlerAbort: { rid: string }
  handlerError: { error: Error; payload: Record<string, unknown>; rid?: string }
  handlerTimeout: { rid: string }
  invalidMessage: { error: Error; message: unknown }
}

export type ServerEmitter = EventEmitter<ServerEvents>

export type HandlerContext<Protocol extends ProtocolDefinition> = {
  controllers: Record<string, HandlerController>
  events: ServerEmitter
  handlers: ProcedureHandlers<Protocol>
  send: (payload: AnyServerPayloadOf<Protocol>) => Promise<void>
}
