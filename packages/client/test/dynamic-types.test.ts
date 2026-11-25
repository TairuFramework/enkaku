import type { ProtocolDefinition } from '@enkaku/protocol'
import { expectTypeOf, test } from 'vitest'

import {
  type AnyRequestArguments,
  type ChannelDefinitionsType,
  Client,
  type EventDefinitionsType,
  type RequestCall,
  type RequestDefinitionsType,
  type StreamDefinitionsType,
} from '../src/index.js'

type Literal = {
  notify: {
    type: 'event'
    data: {
      type: 'object'
      properties: { n: { type: 'number' } }
      required: ['n']
      additionalProperties: false
    }
  }
  echo: { type: 'request'; param: { type: 'string' }; result: { type: 'number' } }
  watch: {
    type: 'stream'
    param: { type: 'string' }
    receive: { type: 'number' }
    result: { type: 'boolean' }
  }
  chat: {
    type: 'channel'
    param: { type: 'string' }
    send: { type: 'string' }
    receive: { type: 'number' }
    result: { type: 'boolean' }
  }
}

// Compiled with the package's test:types command; never invokes a client.
function dynamicCalls(client: Client<ProtocolDefinition>) {
  void client.sendEvent('runtime/event', { data: { any: 'value' } })
  const request = client.request('runtime/request', { param: { id: 1 } })
  const stream = client.createStream('runtime/stream', { param: 'value' })
  const channel = client.createChannel('runtime/channel', { param: 'value' })
  void channel.send('value')
  return [request, stream, channel] as const
}
void dynamicCalls

function literalCalls(client: Client<Literal>) {
  void client.sendEvent('notify', { data: { n: 1 } })
  const request = client.request('echo', { param: 'value' })
  expectTypeOf(request).resolves.toEqualTypeOf<number>()
  // @ts-expect-error: literal request param is still checked
  void client.request('echo', { param: 1 })
  // @ts-expect-error: literal procedure names are still checked
  void client.request('missing', { param: 'value' })
  // @ts-expect-error: an event name is not a request
  void client.request('notify')
  const stream = client.createStream('watch', { param: 'value' })
  expectTypeOf(stream.readable).toEqualTypeOf<ReadableStream<number>>()
  const channel = client.createChannel('chat', { param: 'value' })
  // @ts-expect-error: literal channel send data is still checked
  void channel.send(1)
}
void literalCalls

// A wrapper installed over every client forwards any request without casts.
const request = Client.prototype.request
const wrapped: typeof request = function (
  this: Client<ProtocolDefinition>,
  procedure: string,
  ...args: AnyRequestArguments
): RequestCall<unknown> {
  return request.call(this, procedure, ...args)
}
void wrapped

test('literal protocols keep one definition kind per procedure', () => {
  expectTypeOf<keyof EventDefinitionsType<Literal>>().toEqualTypeOf<'notify'>()
  expectTypeOf<keyof RequestDefinitionsType<Literal>>().toEqualTypeOf<'echo'>()
  expectTypeOf<keyof StreamDefinitionsType<Literal>>().toEqualTypeOf<'watch'>()
  expectTypeOf<keyof ChannelDefinitionsType<Literal>>().toEqualTypeOf<'chat'>()
  expectTypeOf<RequestDefinitionsType<Literal>['echo']>().toEqualTypeOf<{
    Param: string
    Result: number
  }>()
})

test('open runtime protocols expose every definition kind', () => {
  expectTypeOf<EventDefinitionsType<ProtocolDefinition>[string]>().not.toBeNever()
  expectTypeOf<RequestDefinitionsType<ProtocolDefinition>[string]>().not.toBeNever()
  expectTypeOf<StreamDefinitionsType<ProtocolDefinition>[string]>().not.toBeNever()
  expectTypeOf<ChannelDefinitionsType<ProtocolDefinition>[string]>().not.toBeNever()
})
