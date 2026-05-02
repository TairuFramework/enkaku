import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import type { FromSchema } from '@enkaku/schema'
import type { ProcedureHandlers } from '@enkaku/server'

export const echoProtocol = {
  'echo/ping': {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        msg: { type: 'string' },
      },
      required: ['msg'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        msg: { type: 'string' },
      },
      required: ['msg'],
      additionalProperties: false,
    },
  },
  'echo/stream': {
    type: 'channel',
    param: {
      type: 'object',
      properties: {
        expected: { type: 'integer' },
      },
      required: ['expected'],
      additionalProperties: false,
    },
    send: {
      type: 'object',
      properties: {
        msg: { type: 'string' },
      },
      required: ['msg'],
      additionalProperties: false,
    },
    receive: {
      type: 'object',
      properties: {
        msg: { type: 'string' },
      },
      required: ['msg'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        count: { type: 'integer' },
      },
      required: ['count'],
      additionalProperties: false,
    },
  },
} as const satisfies ProtocolDefinition

export type EchoProtocol = typeof echoProtocol

export type EchoPingParams = FromSchema<EchoProtocol['echo/ping']['param']>
export type EchoPingResult = FromSchema<EchoProtocol['echo/ping']['result']>
export type EchoStreamSend = FromSchema<EchoProtocol['echo/stream']['send']>
export type EchoStreamReceive = FromSchema<EchoProtocol['echo/stream']['receive']>
export type EchoStreamResult = FromSchema<EchoProtocol['echo/stream']['result']>

export type EchoClientMessage = AnyClientMessageOf<EchoProtocol>
export type EchoServerMessage = AnyServerMessageOf<EchoProtocol>

export const echoHandlers: ProcedureHandlers<EchoProtocol> = {
  'echo/ping': ({ param }) => ({ msg: param.msg }),
  'echo/stream': async (ctx) => {
    const writer = ctx.writable.getWriter()
    const reader = ctx.readable.getReader()
    const expected = ctx.param.expected
    let count = 0
    try {
      while (count < expected) {
        const { done, value } = await reader.read()
        if (done) break
        await writer.write({ msg: value.msg })
        count++
      }
    } finally {
      reader.releaseLock()
      try {
        await writer.close()
      } catch {
        // writer may already be closed if the channel was aborted
      }
      writer.releaseLock()
    }
    return { count }
  },
}
