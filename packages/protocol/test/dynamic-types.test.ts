import type { Schema } from '@sozai/schema'
import { expectTypeOf, test } from 'vitest'

import type {
  AnyClientPayloadOf,
  AnyServerPayloadOf,
  ChannelProcedureDefinition,
  DataOf,
  EventProcedureDefinition,
  ProtocolDefinition,
  RequestProcedureDefinition,
  ReturnOf,
  ServerTransportOf,
} from '../src/index.js'

type Literal = {
  echo: { type: 'request'; param: { type: 'string' }; result: { type: 'number' } }
}

test('runtime schemas widen data while literal schemas retain inference', () => {
  expectTypeOf<DataOf<RequestProcedureDefinition['param']>>().toEqualTypeOf<unknown>()
  expectTypeOf<ReturnOf<RequestProcedureDefinition['result']>>().toEqualTypeOf<unknown>()
  expectTypeOf<DataOf<ChannelProcedureDefinition['send']>>().toEqualTypeOf<unknown>()
  expectTypeOf<DataOf<EventProcedureDefinition['data']>>().toEqualTypeOf<Record<string, unknown>>()
  expectTypeOf<DataOf<Schema>>().toEqualTypeOf<unknown>()
  expectTypeOf<DataOf<{ type: 'string' }>>().toEqualTypeOf<string>()
  expectTypeOf<DataOf<{ type: 'string'; enum: [] }>>().toEqualTypeOf<never>()
  expectTypeOf<DataOf<undefined>>().toEqualTypeOf<never>()
  expectTypeOf<ReturnOf<undefined>>().toEqualTypeOf<void>()
})

test('dynamic messages accept values from concrete protocols', () => {
  const acceptsTransport = (transport: ServerTransportOf<Literal>) => {
    // @ts-expect-error: contravariant writes reject a narrower transport
    const dynamic: ServerTransportOf<ProtocolDefinition> = transport
    return dynamic
  }
  void acceptsTransport
  expectTypeOf<{ typ: 'request'; prc: string; rid: string; prm: string }>().toExtend<
    AnyClientPayloadOf<ProtocolDefinition>
  >()
  expectTypeOf<{ typ: 'result'; rid: string; val: number }>().toExtend<
    AnyServerPayloadOf<ProtocolDefinition>
  >()
  expectTypeOf<
    Extract<AnyClientPayloadOf<Literal>, { typ: 'request' }>['prm']
  >().toEqualTypeOf<string>()
  expectTypeOf<
    Extract<AnyServerPayloadOf<Literal>, { typ: 'result' }>['val']
  >().toEqualTypeOf<number>()
})
