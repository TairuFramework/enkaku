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
import type { EventEmitter } from '@sozai/event'
import type { Logger } from '@sozai/log'

import type { HandlerError } from './error.js'

export type InvocationCaller = {
  iss: string
  /** Caller-asserted until verifyDelegation() returns true. */
  sub?: string
}

export type InvocationContext = {
  signal: AbortSignal
  type: 'request' | 'stream' | 'channel' | 'event'
  procedure: string
  rid?: string
  caller?: InvocationCaller
  verifyDelegation: () => Promise<boolean>
  transport?: unknown
  message: Message<Record<string, unknown>>
}

export type InvocationHook = (ctx: InvocationContext) => void | Promise<void>

export type RequestController = AbortController & {
  issuer?: string
  procedure?: string
}

export type ChannelController<Send = unknown> = AbortController & {
  issuer?: string
  procedure?: string
  writer: WritableStreamDefaultWriter<Send>
}

export type HandlerController<Send = unknown> = RequestController | ChannelController<Send>

export type EventHandlerContext<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends EventProcedureDefinition
  ? {
      message: Message<EventCallPayload<Procedure, DataOf<Definition['data']>>>
      data: DataOf<Definition['data']>
    }
  : never

export type EventHandler<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = (context: EventHandlerContext<Protocol, Procedure, Definition>) => void | Promise<void>

export type RequestHandlerContext<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends AnyRequestProcedureDefinition
  ? {
      message: Message<
        RequestCallPayload<Definition['type'], Procedure, DataOf<Definition['param']>>
      >
      param: DataOf<Definition['param']>
      signal: AbortSignal
    }
  : never

export type HandlerReturn<ResultSchema, Result = ReturnOf<ResultSchema>> = Result | Promise<Result>

export type RequestHandler<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends AnyRequestProcedureDefinition
  ? (
      context: RequestHandlerContext<Protocol, Procedure, Definition>,
    ) => HandlerReturn<Definition['result']>
  : never

export type StreamHandlerContext<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends StreamProcedureDefinition | ChannelProcedureDefinition
  ? RequestHandlerContext<Protocol, Procedure, Definition> & {
      writable: WritableStream<DataOf<Definition['receive']>>
    }
  : never

export type StreamHandler<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends StreamProcedureDefinition | ChannelProcedureDefinition
  ? (
      context: StreamHandlerContext<Protocol, Procedure, Definition>,
    ) => HandlerReturn<Definition['result']>
  : never

export type ChannelHandlerContext<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends ChannelProcedureDefinition
  ? StreamHandlerContext<Protocol, Procedure, Definition> & {
      readable: ReadableStream<DataOf<Definition['send']>>
    }
  : never

export type ChannelHandler<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends ChannelProcedureDefinition
  ? (
      context: ChannelHandlerContext<Protocol, Procedure, Definition>,
    ) => HandlerReturn<Definition['result']>
  : never

type ProcedureContext<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
> =
  | EventHandlerContext<Protocol, Procedure>
  | RequestHandlerContext<
      Protocol,
      Procedure,
      Extract<Protocol[Procedure], RequestProcedureDefinition>
    >
  | StreamHandlerContext<
      Protocol,
      Procedure,
      Extract<Protocol[Procedure], StreamProcedureDefinition>
    >
  | ChannelHandlerContext<Protocol, Procedure>

type ProcedureReturn<Definition> = Definition extends EventProcedureDefinition
  ? ReturnType<() => void>
  : Definition extends AnyRequestProcedureDefinition
    ? HandlerReturn<Definition['result']>
    : never

export type ProcedureHandlers<Protocol extends ProtocolDefinition> = {
  [Procedure in keyof Protocol & string]: (
    context: ProcedureContext<Protocol, Procedure>,
  ) => ProcedureReturn<Protocol[Procedure]>
}

export type EventDataType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends EventProcedureDefinition ? DataOf<Definition['data']> : never

export type ParamType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends AnyRequestProcedureDefinition ? DataOf<Definition['param']> : never

export type ReceiveType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends StreamProcedureDefinition
  ? DataOf<Definition['receive']>
  : Definition extends ChannelProcedureDefinition
    ? DataOf<Definition['receive']>
    : never

export type ResultType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends AnyRequestProcedureDefinition ? DataOf<Definition['result']> : never

export type SendType<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Definition = Protocol[Procedure],
> = Definition extends ChannelProcedureDefinition ? DataOf<Definition['send']> : never

export type HandlerErrorCategory = 'auth' | 'limit' | 'encryption' | 'handler' | 'invocation'

export type HandlerErrorMessageType = 'event' | 'request' | 'channel' | 'stream' | 'send'

export type ServerEvents = {
  disposed: { reason?: unknown }
  disposing: { reason?: unknown }
  handlerAbort: {
    rid: string
    // Widened to `unknown`: this now also carries reasons from `requestAborted`,
    // a transport-defined event whose `reason` is opaque to the server.
    reason: unknown
  }
  handlerEnd: { rid: string; procedure: string }
  handlerError: {
    error: HandlerError<string>
    payload: Record<string, unknown>
    category: HandlerErrorCategory
    messageType: HandlerErrorMessageType
  }
  handlerStart: { rid: string; procedure: string; type: string }
  handlerTimeout: { rid: string }
  invalidMessage: { error: Error; message: unknown }
  transportAdded: { transportID: string }
  transportError: { error: Error }
  transportRemoved: { transportID: string; reason?: unknown }
  writeDropped: { rid?: string; reason: unknown; error: Error }
  writeFailed: { error: Error; rid?: string }
}

export type ServerEmitter = EventEmitter<ServerEvents>

export type HandlerContext<Protocol extends ProtocolDefinition> = {
  controllers: Record<string, HandlerController>
  events: ServerEmitter
  handlers: ProcedureHandlers<Protocol>
  logger: Logger
  /** True when the procedure's payloads must never be logged. */
  redact?: (procedure: string) => boolean
  send: (payload: AnyServerPayloadOf<Protocol>, options?: { rid?: string }) => Promise<void>
  signal: AbortSignal
  streamHighWaterMark?: number
}
