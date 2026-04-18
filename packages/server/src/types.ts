import type { DisposeInterruption } from '@enkaku/async'
import type { EventEmitter } from '@enkaku/event'
import type { Logger } from '@enkaku/log'
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

import type { HandlerError } from './error.js'

export type RequestController = AbortController

export type ChannelController<Send = unknown> = AbortController & {
  issuer?: string
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
  disposed: { reason?: unknown }
  disposing: { reason?: unknown }
  eventAuthError: {
    error: HandlerError<string>
    payload: Record<string, unknown>
  }
  handlerAbort: {
    rid: string
    reason: 'Close' | 'Timeout' | 'Transport' | DisposeInterruption | string | undefined
  }
  handlerEnd: { rid: string; procedure: string }
  handlerError: {
    error: HandlerError<string>
    payload: Record<string, unknown>
  }
  handlerStart: { rid: string; procedure: string; type: string }
  handlerTimeout: { rid: string }
  invalidMessage: { error: Error; message: unknown }
  transportAdded: { transportID: string }
  transportRemoved: { transportID: string; reason?: unknown }
  writeDropped: { rid?: string; reason: unknown; error: Error }
  writeFailed: { error: Error; rid?: string }
}

export type ServerEmitter = EventEmitter<ServerEvents>

export type HandlerContext<Protocol extends ProtocolDefinition> = {
  controllers: Record<string, HandlerController>
  disposing: { value: boolean }
  events: ServerEmitter
  handlers: ProcedureHandlers<Protocol>
  logger: Logger
  send: (payload: AnyServerPayloadOf<Protocol>, options?: { rid?: string }) => Promise<void>
}
