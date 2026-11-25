import type { ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'
import { expectTypeOf, test } from 'vitest'

import type {
  ChannelHandlerContext,
  EventHandlerContext,
  ProcedureHandlers,
  RequestHandlerContext,
  ServeParams,
  StreamHandlerContext,
} from '../src/index.js'

type Literal = {
  echo: { type: 'request'; param: { type: 'string' }; result: { type: 'number' } }
}

// Compiled with the package's test:types command; never invokes a server.
function dynamicHost(
  transport: ServerTransportOf<ProtocolDefinition>,
  protocol: ProtocolDefinition,
) {
  const handlers: ProcedureHandlers<ProtocolDefinition> = {
    echo: () => 42,
    asyncEcho: async () => 'value',
    forward: (context: unknown) => context,
  }
  return {
    protocol,
    transport,
    handlers,
    requireAuth: false,
  } satisfies ServeParams<ProtocolDefinition>
}
void dynamicHost

test('literal handlers retain parameter and return checking', () => {
  const handlers: ProcedureHandlers<Literal> = {
    echo: ({ param }) => {
      expectTypeOf(param).toEqualTypeOf<string>()
      return param.length
    },
  }
  const invalid: ProcedureHandlers<Literal> = {
    // @ts-expect-error: literal result schema still requires a number
    echo: () => 'wrong',
  }
  void [handlers, invalid]
  expectTypeOf<ProcedureHandlers<ProtocolDefinition>['dynamic']>().not.toBeNever()
})

test('wide contexts and inferred handlers expose runtime data', () => {
  expectTypeOf<EventHandlerContext<ProtocolDefinition, string>['data']>().toEqualTypeOf<
    Record<string, unknown>
  >()
  expectTypeOf<
    RequestHandlerContext<ProtocolDefinition, string>['param']
  >().toEqualTypeOf<unknown>()
  expectTypeOf<StreamHandlerContext<ProtocolDefinition, string>['writable']>().toEqualTypeOf<
    WritableStream<unknown>
  >()
  expectTypeOf<ChannelHandlerContext<ProtocolDefinition, string>['readable']>().toEqualTypeOf<
    ReadableStream<unknown>
  >()
  const handlers: ProcedureHandlers<ProtocolDefinition> = {
    dynamic: (context) => {
      expectTypeOf(context.message.payload.prc).toEqualTypeOf<string>()
      if ('param' in context) {
        expectTypeOf(context.param).toEqualTypeOf<unknown>()
      }
      return 'runtime result'
    },
  }
  void handlers
})

test('all literal procedure kinds retain context and result inference', () => {
  type Protocol = {
    event: {
      type: 'event'
      data: { type: 'object'; properties: { name: { type: 'string' } }; required: ['name'] }
    }
    stream: {
      type: 'stream'
      param: { type: 'string' }
      receive: { type: 'number' }
      result: { type: 'boolean' }
    }
    channel: {
      type: 'channel'
      param: { type: 'string' }
      receive: { type: 'number' }
      send: { type: 'boolean' }
      result: { type: 'number' }
    }
  }
  const handlers: ProcedureHandlers<Protocol> = {
    event: ({ data }) => {
      expectTypeOf(data.name).toEqualTypeOf<string>()
    },
    stream: ({ param, writable }) => {
      expectTypeOf(param).toEqualTypeOf<string>()
      expectTypeOf(writable).toEqualTypeOf<WritableStream<number>>()
      return true
    },
    channel: ({ readable, writable }) => {
      expectTypeOf(readable).toEqualTypeOf<ReadableStream<boolean>>()
      expectTypeOf(writable).toEqualTypeOf<WritableStream<number>>()
      return 42
    },
  }
  const invalid: ProcedureHandlers<Protocol> = {
    event: handlers.event,
    // @ts-expect-error: literal stream result requires a boolean
    stream: () => 'wrong',
    // @ts-expect-error: literal channel result requires a number
    channel: () => 'wrong',
  }
  void invalid
})

test('wide handlers reject assumptions about runtime parameter types', () => {
  const invalid: ProcedureHandlers<ProtocolDefinition> = {
    // @ts-expect-error: runtime contexts do not guarantee a string parameter
    narrow: ({ param }: { param: string }) => param.length,
  }
  void invalid
})
