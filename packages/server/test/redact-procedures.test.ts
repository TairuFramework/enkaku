import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken, randomIdentity } from '@kokuin/token'
import type { Logger } from '@sozai/log'
import type { Span, Tracer } from '@sozai/otel'
import { describe, expect, test } from 'vitest'

import {
  type AllowContext,
  type InvocationHook,
  InvocationRejectedError,
  type ProcedureHandlers,
  type ServerParams,
  serve,
} from '../src/index.js'

const SECRET = 'sk-top-secret-value'

const param = {
  type: 'object',
  properties: { secret: { type: 'string' }, fail: { type: 'boolean' } },
  required: ['secret', 'fail'],
  additionalProperties: false,
} as const

function procedures<Prefix extends string>(prefix: Prefix) {
  return {
    [`${prefix}Event`]: { type: 'event', data: param },
    [`${prefix}Request`]: { type: 'request', param, result: { type: 'string' } },
    [`${prefix}Stream`]: {
      type: 'stream',
      param,
      receive: { type: 'string' },
      result: { type: 'string' },
    },
    [`${prefix}Channel`]: {
      type: 'channel',
      param,
      send: { type: 'string' },
      receive: { type: 'string' },
      result: { type: 'string' },
    },
  } as unknown as Record<
    `${Prefix}${'Event' | 'Request' | 'Stream' | 'Channel'}`,
    ProtocolDefinition[string]
  >
}

const protocol = {
  ...procedures('secret'),
  ...procedures('plain'),
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

type Input = { secret: string; fail: boolean }

function fail(input: Input): never {
  throw new Error(`handler failed with ${input.secret}`, { cause: new Error(input.secret) })
}

function createHandlers(): ProcedureHandlers<Protocol> {
  const handlers: Record<string, unknown> = {}
  for (const prefix of ['secret', 'plain']) {
    handlers[`${prefix}Event`] = (ctx: { data: Input }) => {
      if (ctx.data.fail) fail(ctx.data)
    }
    handlers[`${prefix}Request`] = (ctx: { param: Input }) => {
      if (ctx.param.fail) fail(ctx.param)
      return ctx.param.secret
    }
    handlers[`${prefix}Stream`] = async (ctx: {
      param: Input
      writable: WritableStream<string>
    }) => {
      const writer = ctx.writable.getWriter()
      await writer.write(ctx.param.secret)
      writer.releaseLock()
      if (ctx.param.fail) fail(ctx.param)
      return ctx.param.secret
    }
    handlers[`${prefix}Channel`] = async (ctx: {
      param: Input
      readable: ReadableStream<string>
      writable: WritableStream<string>
    }) => {
      const reader = ctx.readable.getReader()
      const received = await reader.read()
      reader.releaseLock()
      const writer = ctx.writable.getWriter()
      await writer.write(received.value as string)
      writer.releaseLock()
      if (ctx.param.fail) fail(ctx.param)
      return ctx.param.secret
    }
  }
  return handlers as unknown as ProcedureHandlers<Protocol>
}

type LogRecord = { level: string; message: string; properties: unknown }

function createRecordingLogger(records: Array<LogRecord>): Logger {
  const logger: Record<string, unknown> = {}
  for (const level of ['trace', 'debug', 'info', 'warn', 'warning', 'error', 'fatal']) {
    logger[level] = (message: string, properties?: unknown) => {
      records.push({ level, message, properties })
    }
  }
  logger.getChild = () => logger
  logger.with = () => logger
  return logger as unknown as Logger
}

// Span calls land in the same records: exporters ship them out of process.
function createRecordingTracer(records: Array<LogRecord>): Tracer {
  return {
    startSpan(name: string, options?: unknown) {
      records.push({ level: 'span', message: `${name}.startSpan`, properties: options })
      const span: Record<string, unknown> = {
        isRecording: () => true,
        spanContext: () => {
          return { traceId: '1'.repeat(32), spanId: '1'.repeat(16), traceFlags: 1 }
        },
      }
      for (const method of [
        'addEvent',
        'addLink',
        'addLinks',
        'end',
        'recordException',
        'setAttribute',
        'setAttributes',
        'setStatus',
        'updateName',
      ]) {
        span[method] = (...args: Array<unknown>) => {
          records.push({ level: 'span', message: `${name}.${method}`, properties: args })
          return span
        }
      }
      return span as unknown as Span
    },
  } as unknown as Tracer
}

// Walks errors deeply, including getters such as ValidationError.value, so any
// reachable payload counts as logged.
function serialise(value: unknown, seen = new WeakSet<object>()): string {
  if (value == null || typeof value !== 'object') {
    return String(value)
  }
  if (seen.has(value)) {
    return '[circular]'
  }
  seen.add(value)
  const parts: Array<string> = []
  if (value instanceof Error) {
    parts.push(value.name, value.message, serialise(value.cause, seen))
    const extra = value as unknown as Record<string, unknown>
    for (const key of ['value', 'errors', 'data']) {
      if (key in extra) {
        parts.push(serialise(extra[key], seen))
      }
    }
  }
  for (const [key, entry] of Object.entries(value)) {
    parts.push(key, serialise(entry, seen))
  }
  return parts.join(' ')
}

function recordsWithSecret(records: Array<LogRecord>): Array<LogRecord> {
  return records.filter((record) => {
    return `${record.message} ${serialise(record.properties)}`.includes(SECRET)
  })
}

type Message = AnyClientMessageOf<Protocol>

function token(payload: Record<string, unknown>): Message {
  return createUnsignedToken({ payload }) as unknown as Message
}

async function run(
  prefix: 'secret' | 'plain',
  options: Pick<ServerParams<Protocol>, 'redactProcedures'>,
): Promise<Array<LogRecord>> {
  const records: Array<LogRecord> = []
  const transports = new DirectTransports<AnyServerMessageOf<Protocol>, Message>()
  const server = serve<Protocol>({
    ...options,
    requireAuth: false,
    handlers: createHandlers(),
    logger: createRecordingLogger(records),
    tracer: createRecordingTracer(records),
    protocol,
    transport: transports.server,
  })

  const ended: Array<string> = []
  server.events.on('handlerEnd', ({ procedure }) => {
    ended.push(procedure)
  })

  const replies: Array<Record<string, unknown>> = []
  const reading = (async () => {
    while (true) {
      const next = await transports.client.read()
      if (next.done) return
      replies.push(next.value.payload as Record<string, unknown>)
    }
  })()

  let expectedEnds = 0
  for (const failing of [false, true]) {
    const prm = { secret: SECRET, fail: failing }
    const suffix = failing ? 'fail' : 'ok'
    await transports.client.write(token({ typ: 'event', prc: `${prefix}Event`, data: prm }))
    await transports.client.write(
      token({ typ: 'request', prc: `${prefix}Request`, rid: `r-${suffix}`, prm }),
    )
    await transports.client.write(
      token({ typ: 'stream', prc: `${prefix}Stream`, rid: `s-${suffix}`, prm }),
    )
    await transports.client.write(
      token({ typ: 'channel', prc: `${prefix}Channel`, rid: `c-${suffix}`, prm }),
    )
    await transports.client.write(
      token({ typ: 'send', prc: `${prefix}Channel`, rid: `c-${suffix}`, val: SECRET }),
    )
    expectedEnds += 4
  }

  // Invalid messages: a bad request param and a bad channel send value.
  await transports.client.write(
    token({
      typ: 'request',
      prc: `${prefix}Request`,
      rid: 'r-invalid',
      prm: { secret: SECRET, fail: false, extra: SECRET },
    }),
  )
  await transports.client.write(
    token({
      typ: 'channel',
      prc: `${prefix}Channel`,
      rid: 'c-invalid',
      prm: { secret: 'x', fail: false },
    }),
  )
  await transports.client.write(
    token({ typ: 'send', prc: `${prefix}Channel`, rid: 'c-invalid', val: { leak: SECRET } }),
  )
  await transports.client.write(
    token({ typ: 'send', prc: `${prefix}Channel`, rid: 'c-invalid', val: 'x' }),
  )
  expectedEnds += 1

  await expect.poll(() => ended.length, { timeout: 2000 }).toBe(expectedEnds)

  await server.dispose()
  await transports.dispose()
  await reading

  // Behaviour on the wire is unchanged: results and errors still reach the client.
  const byRID = (rid: string) => replies.filter((reply) => reply.rid === rid)
  expect(byRID('r-ok')).toEqual([{ typ: 'result', rid: 'r-ok', val: SECRET }])
  expect(byRID('r-fail')).toEqual([
    expect.objectContaining({ typ: 'error', rid: 'r-fail', code: 'EK01' }),
  ])
  expect(byRID('s-ok').map((reply) => reply.typ)).toEqual(['receive', 'result'])
  expect(byRID('c-fail').map((reply) => reply.typ)).toEqual(['receive', 'error'])
  expect(byRID('r-invalid')).toEqual([expect.objectContaining({ typ: 'error', code: 'EK08' })])

  return records
}

describe('redactProcedures', () => {
  test('logs payloads of procedures not redacted', async () => {
    const records = await run('plain', { redactProcedures: ['secretRequest'] })
    const leaked = recordsWithSecret(records).map((record) => record.message)
    expect(leaked).toEqual(
      expect.arrayContaining([
        'handle event {procedure} with data: {data}',
        'handler error for event {procedure} with data {data}: {error}',
        'handle request {procedure} with ID {rid} and param: {param}',
        'send result to {type} {procedure} with ID {rid}: {result}',
        'handler {procedure} (rid={rid}) threw: {message}',
        'send error to {type} {procedure} with ID {rid}: {error}',
        'send value to stream {procedure} with ID {rid}: {val}',
        'send value to channel {procedure} with ID {rid}: {val}',
        'received value from channel {procedure} with ID {rid}: {value}',
        'received invalid message',
      ]),
    )
  })

  test('never logs payloads of procedures in the list', async () => {
    const records = await run('secret', {
      redactProcedures: ['secretEvent', 'secretRequest', 'secretStream', 'secretChannel'],
    })
    expect(recordsWithSecret(records)).toEqual([])
    // Metadata stays for debugging.
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warn',
          properties: expect.objectContaining({
            procedure: 'secretRequest',
            rid: 'r-fail',
            code: 'EK01',
            name: 'Error',
          }),
        }),
        expect.objectContaining({
          properties: expect.objectContaining({ procedure: 'secretChannel', rid: 'c-ok' }),
        }),
        expect.objectContaining({
          level: 'span',
          properties: [
            'enkaku.validation',
            {
              'enkaku.validation.success': false,
              'enkaku.validation.error': 'Error details redacted',
            },
          ],
        }),
      ]),
    )
  })

  test('never logs payloads of procedures matched by a predicate', async () => {
    const records = await run('secret', {
      redactProcedures: (procedure) => procedure.startsWith('secret'),
    })
    expect(recordsWithSecret(records)).toEqual([])
  })
})

describe('redactProcedures with an invocation hook', () => {
  const hooks = {
    'a failing hook': () => {
      throw new Error(`hook failed with ${SECRET}`)
    },
    'a rejecting hook': () => {
      throw new InvocationRejectedError({ code: 'DENIED', message: `denied ${SECRET}` })
    },
  } satisfies Record<string, InvocationHook>

  async function invoke(
    redactProcedures: Array<string>,
    onInvocation: InvocationHook,
  ): Promise<Array<LogRecord>> {
    const records: Array<LogRecord> = []
    const transports = new DirectTransports<AnyServerMessageOf<Protocol>, Message>()
    const server = serve<Protocol>({
      redactProcedures,
      requireAuth: false,
      handlers: createHandlers(),
      logger: createRecordingLogger(records),
      tracer: createRecordingTracer(records),
      protocol,
      transport: transports.server,
      onInvocation,
    })
    await transports.client.write(
      token({
        typ: 'request',
        prc: 'secretRequest',
        rid: 'r1',
        prm: { secret: SECRET, fail: false },
      }),
    )
    const reply = await transports.client.read()
    expect(reply.value?.payload).toEqual(expect.objectContaining({ typ: 'error', rid: 'r1' }))
    await server.dispose()
    await transports.dispose()
    return records
  }

  test('logs the hook failure cause of procedures not redacted', async () => {
    const records = await invoke([], hooks['a failing hook'])
    expect(recordsWithSecret(records).map((record) => record.message)).toEqual(
      expect.arrayContaining(['invocation hook failed', 'enkaku.server.handle.recordException']),
    )
  })

  test('records the rejection message in spans of procedures not redacted', async () => {
    const records = await invoke([], hooks['a rejecting hook'])
    expect(recordsWithSecret(records).map((record) => record.message)).toEqual(
      expect.arrayContaining([
        'enkaku.server.handle.setAttribute',
        'enkaku.server.handle.recordException',
      ]),
    )
  })

  test.each(Object.keys(hooks) as Array<keyof typeof hooks>)(
    'never logs or traces details of %s',
    async (hook) => {
      const records = await invoke(['secretRequest'], hooks[hook])
      expect(recordsWithSecret(records)).toEqual([])
      const code = hook === 'a failing hook' ? 'EK01' : 'DENIED'
      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'enkaku.server.handle.setStatus',
            properties: [{ code: 2, message: 'Error details redacted' }],
          }),
          expect.objectContaining({
            message: 'enkaku.server.handle.setAttribute',
            properties: ['enkaku.error.code', code],
          }),
          expect.objectContaining({
            message: 'enkaku.server.handle.recordException',
            properties: [{ name: 'Error', code }],
          }),
        ]),
      )
    },
  )

  test('keeps logging metadata of a failing hook for redacted procedures', async () => {
    const records = await invoke(['secretRequest'], hooks['a failing hook'])
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warn',
          properties: { procedure: 'secretRequest', rid: 'r1', name: 'Error' },
        }),
      ]),
    )
  })
})

const sinkChannel = {
  type: 'channel',
  send: { type: 'string' },
  receive: { type: 'string' },
  result: { type: 'string' },
} as const

const edgeProtocol = {
  secretNoParam: { type: 'request', result: { type: 'string' } },
  secretPing: { type: 'event' },
  secretRequest: { type: 'request', param, result: { type: 'string' } },
  secretSink: sinkChannel,
  plainSink: sinkChannel,
  secretEcho: sinkChannel,
  slowRequest: { type: 'request', result: { type: 'string' } },
  plainEcho: sinkChannel,
} as const satisfies ProtocolDefinition
type EdgeProtocol = typeof edgeProtocol
type EdgeMessage = AnyClientMessageOf<EdgeProtocol>

function createEdgeHandlers(): ProcedureHandlers<EdgeProtocol> {
  const sink = async (ctx: { readable: ReadableStream<string> }) => {
    // Cancelling makes the next channel write fail with this reason.
    await ctx.readable.cancel(new Error(`cancelled with ${SECRET}`))
    await new Promise((resolve) => setTimeout(resolve, 100))
    return 'done'
  }
  const echo = async (ctx: {
    readable: ReadableStream<string>
    writable: WritableStream<string>
  }) => {
    const reader = ctx.readable.getReader()
    const received = await reader.read()
    reader.releaseLock()
    const writer = ctx.writable.getWriter()
    await writer.write(received.value as string)
    writer.releaseLock()
    return 'done'
  }
  return {
    secretNoParam: () => SECRET,
    secretPing: () => {
      throw new Error(SECRET)
    },
    secretRequest: (ctx: { param: Input }) => ctx.param.secret,
    secretSink: sink,
    plainSink: sink,
    secretEcho: echo,
    slowRequest: async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return 'slow'
    },
    plainEcho: echo,
  } as unknown as ProcedureHandlers<EdgeProtocol>
}

function startEdge(options: Partial<ServerParams<EdgeProtocol>>) {
  const records: Array<LogRecord> = []
  const transports = new DirectTransports<AnyServerMessageOf<EdgeProtocol>, EdgeMessage>()
  const server = serve<EdgeProtocol>({
    requireAuth: false,
    handlers: createEdgeHandlers(),
    logger: createRecordingLogger(records),
    tracer: createRecordingTracer(records),
    protocol: edgeProtocol,
    transport: transports.server,
    ...options,
  } as ServerParams<EdgeProtocol> & { transport: typeof transports.server })
  const write = (payload: Record<string, unknown>) => {
    return transports.client.write(createUnsignedToken({ payload }) as unknown as EdgeMessage)
  }
  const stop = async () => {
    await server.dispose()
    await transports.dispose()
  }
  return { records, server, transports, write, stop }
}

describe('redactProcedures edge cases', () => {
  async function sendToSink(redactProcedures?: Array<string>): Promise<Array<LogRecord>> {
    const edge = startEdge({ redactProcedures })
    const writeFailed = edge.server.events.once('writeFailed')
    await edge.write({ typ: 'channel', prc: 'secretSink', rid: 'k1' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    // Invalid sends for the live channel, naming another procedure or none.
    await edge.write({ typ: 'send', prc: 'plainSink', rid: 'k1', val: { leak: SECRET } })
    await edge.write({ typ: 'send', rid: 'k1', val: { leak: SECRET } })
    // Valid send into the cancelled channel.
    await edge.write({ typ: 'send', prc: 'secretSink', rid: 'k1', val: SECRET })
    await writeFailed
    await edge.stop()
    return edge.records
  }

  test('logs channel send failures of channels not redacted', async () => {
    const records = await sendToSink()
    expect(recordsWithSecret(records).map((record) => record.message)).toEqual(
      expect.arrayContaining([
        'received invalid message',
        'failed to write send value to channel {rid}',
      ]),
    )
  })

  test('keys channel sends on the live channel, not the client procedure', async () => {
    const records = await sendToSink(['secretSink'])
    expect(recordsWithSecret(records)).toEqual([])
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'failed to write send value to channel {rid}: {name}',
          properties: { rid: 'k1', name: 'Error' },
        }),
      ]),
    )
  })

  test('fails closed on invalid messages naming no known procedure', async () => {
    const edge = startEdge({ redactProcedures: ['secretRequest'] })
    await edge.write({ typ: 'request', prc: 'secretRequst', rid: 'm1', prm: { secret: SECRET } })
    await edge.write({ typ: 'request', prc: 42, rid: 'm2', prm: { secret: SECRET } })
    await edge.write({ typ: 'request', rid: 'm3', prm: { secret: SECRET } })
    for (let i = 0; i < 3; i++) {
      await edge.transports.client.read()
    }
    await edge.stop()
    expect(recordsWithSecret(edge.records)).toEqual([])
    expect(edge.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'received invalid {type} message with ID {rid}',
          properties: { type: 'request', rid: 'm1' },
        }),
      ]),
    )
  })

  test('logs invalid messages naming no known procedure without the option', async () => {
    const edge = startEdge({})
    await edge.write({ typ: 'request', prc: 'secretRequst', rid: 'm1', prm: { secret: SECRET } })
    await edge.transports.client.read()
    await edge.stop()
    expect(recordsWithSecret(edge.records).map((record) => record.message)).toEqual([
      'received invalid message',
    ])
  })

  test('treats a throwing predicate as redacted', async () => {
    const edge = startEdge({
      redactProcedures: () => {
        throw new Error('predicate failed')
      },
    })
    await edge.write({
      typ: 'request',
      prc: 'secretRequest',
      rid: 'p1',
      prm: { secret: SECRET, fail: false },
    })
    const reply = await edge.transports.client.read()
    expect(reply.value?.payload).toEqual({ typ: 'result', rid: 'p1', val: SECRET })
    await edge.stop()
    expect(recordsWithSecret(edge.records)).toEqual([])
  })

  test('redacts procedures without param or event data', async () => {
    const edge = startEdge({ redactProcedures: ['secretNoParam', 'secretPing'] })
    const ended: Array<string> = []
    edge.server.events.on('handlerEnd', ({ procedure }) => {
      ended.push(procedure)
    })
    await edge.write({ typ: 'request', prc: 'secretNoParam', rid: 'n1' })
    await edge.write({ typ: 'event', prc: 'secretPing' })
    const reply = await edge.transports.client.read()
    expect(reply.value?.payload).toEqual({ typ: 'result', rid: 'n1', val: SECRET })
    await expect.poll(() => ended.length).toBe(2)
    await edge.stop()
    expect(recordsWithSecret(edge.records)).toEqual([])
    expect(edge.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'handler error for event {procedure}: {name} with code {code}',
        }),
      ]),
    )
  })

  async function authenticated(redactProcedures?: Array<string>): Promise<Array<LogRecord>> {
    const serverIdentity = randomIdentity()
    const allowed = randomIdentity()
    const denied = randomIdentity()
    const edge = startEdge({
      redactProcedures,
      requireAuth: undefined,
      identity: serverIdentity,
      accessRules: {
        secretRequest: {
          allow: (ctx: AllowContext) => {
            // A predicate error may quote the payload.
            if (ctx.payload.iss !== allowed.id) {
              throw new Error(`denied ${JSON.stringify(ctx.payload)}`)
            }
            return true
          },
        },
      },
    } as unknown as Partial<ServerParams<EdgeProtocol>>)
    const exp = Math.floor(Date.now() / 1000) + 60
    const payload = (rid: string) => {
      return {
        typ: 'request',
        aud: serverIdentity.id,
        prc: 'secretRequest',
        rid,
        prm: { secret: SECRET, fail: false },
        exp,
      } as const
    }
    const deniedMessage = await denied.signToken({ payload: payload('a1') })
    await edge.transports.client.write(deniedMessage as unknown as EdgeMessage)
    const replayed = await allowed.signToken({ payload: payload('a2') })
    await edge.transports.client.write(replayed as unknown as EdgeMessage)
    await edge.transports.client.write(replayed as unknown as EdgeMessage)
    const codes: Array<unknown> = []
    for (let i = 0; i < 3; i++) {
      const reply = await edge.transports.client.read()
      const replyPayload = reply.value?.payload as Record<string, unknown>
      codes.push(replyPayload.typ === 'error' ? replyPayload.code : replyPayload.typ)
    }
    expect(codes.sort()).toEqual(['EK02', 'EK09', 'result'].sort())
    await edge.stop()
    return edge.records
  }

  test('records auth failure reasons in spans of procedures not redacted', async () => {
    const records = await authenticated()
    expect(recordsWithSecret(records).map((record) => record.message)).toEqual(
      expect.arrayContaining(['enkaku.server.handle.setAttribute']),
    )
  })

  test('never traces auth or replay failure details of redacted procedures', async () => {
    const records = await authenticated(['secretRequest'])
    expect(recordsWithSecret(records)).toEqual([])
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'enkaku.server.handle.setAttribute',
          properties: ['enkaku.error.code', 'EK02'],
        }),
        expect.objectContaining({
          message: 'enkaku.server.handle.setAttribute',
          properties: ['enkaku.error.code', 'EK09'],
        }),
        expect.objectContaining({
          message: 'enkaku.server.handle.setStatus',
          properties: [{ code: 2, message: 'Error details redacted' }],
        }),
      ]),
    )
  })
})

describe('channel send routing', () => {
  test.each([
    ['a channel not redacted', 'plainEcho', 'secretEcho', undefined],
    ['a redacted channel', 'secretEcho', 'plainEcho', ['secretEcho']],
  ])('delivers only sends naming the procedure of %s', async (_, channel, other, redact) => {
    const edge = startEdge({ redactProcedures: redact })
    const invalid: Array<unknown> = []
    edge.server.events.on('invalidMessage', (event) => {
      invalid.push(event)
    })
    await edge.write({ typ: 'channel', prc: channel, rid: 'e1' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    // Valid for the other procedure, so only the procedure check rejects it.
    await edge.write({ typ: 'send', prc: other, rid: 'e1', val: SECRET })
    await edge.write({ typ: 'send', prc: channel, rid: 'e1', val: 'right' })
    const replies: Array<Record<string, unknown>> = []
    while (replies.at(-1)?.typ !== 'result') {
      const next = await edge.transports.client.read()
      replies.push(next.value?.payload as Record<string, unknown>)
    }
    await edge.stop()
    expect(replies).toEqual([
      expect.objectContaining({ typ: 'error', rid: 'e1', code: 'EK08' }),
      { typ: 'receive', rid: 'e1', val: 'right' },
      { typ: 'result', rid: 'e1', val: 'done' },
    ])
    expect(invalid).toHaveLength(1)
    if (redact != null) {
      expect(recordsWithSecret(edge.records)).toEqual([])
    }
  })

  test('rejects a send to a request rid without a protocol', async () => {
    const edge = startEdge({ protocol: undefined })
    const invalid: Array<unknown> = []
    edge.server.events.on('invalidMessage', (event) => {
      invalid.push(event)
    })
    await edge.write({ typ: 'request', prc: 'slowRequest', rid: 'q1' })
    await edge.write({ typ: 'send', prc: 'slowRequest', rid: 'q1', val: 'x' })
    const replies: Array<Record<string, unknown>> = []
    while (replies.at(-1)?.typ !== 'result') {
      const next = await edge.transports.client.read()
      replies.push(next.value?.payload as Record<string, unknown>)
    }
    await edge.stop()
    expect(replies).toEqual([
      expect.objectContaining({ typ: 'error', rid: 'q1', code: 'EK08' }),
      { typ: 'result', rid: 'q1', val: 'slow' },
    ])
    expect(invalid).toHaveLength(1)
  })

  test('redacts invalid sends while channel auth is pending', async () => {
    const serverIdentity = randomIdentity()
    const client = randomIdentity()
    let release = () => {}
    const allowed = new Promise<void>((resolve) => {
      release = resolve
    })
    const edge = startEdge({
      redactProcedures: ['secretEcho'],
      requireAuth: undefined,
      identity: serverIdentity,
      accessRules: {
        '*': {
          allow: async () => {
            await allowed
            return true
          },
        },
      },
    } as unknown as Partial<ServerParams<EdgeProtocol>>)
    const exp = Math.floor(Date.now() / 1000) + 60
    const open = await client.signToken({
      payload: { typ: 'channel', aud: serverIdentity.id, prc: 'secretEcho', rid: 'w1', exp },
    })
    await edge.transports.client.write(open as unknown as EdgeMessage)
    // Invalid: the value breaks the schema of the named procedure.
    await edge.write({ typ: 'send', prc: 'plainEcho', rid: 'w1', val: { leak: SECRET } })
    const reply = await edge.transports.client.read()
    expect(reply.value?.payload).toEqual(expect.objectContaining({ typ: 'error', code: 'EK08' }))
    release()
    await edge.stop()
    expect(recordsWithSecret(edge.records)).toEqual([])
  })
})
