import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, type RequestHandler, serve } from '@enkaku/server'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

const protocol = {
  'test.greet': {
    type: 'request',
    param: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
      additionalProperties: false,
    },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('end-to-end tracing', () => {
  let exporter: InMemorySpanExporter
  let provider: NodeTracerProvider

  beforeAll(() => {
    exporter = new InMemorySpanExporter()
    provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    })
    provider.register()
  })

  beforeEach(() => {
    exporter.reset()
  })

  afterAll(async () => {
    await provider.shutdown()
  })

  test('traces a request from client through server', async () => {
    const serverIdentity = randomIdentity()
    const clientIdentity = randomIdentity()

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const handler: RequestHandler<Protocol, 'test.greet'> = (ctx) => {
      return `Hello, ${ctx.param.name}!`
    }
    const handlers = { 'test.greet': handler } as ProcedureHandlers<Protocol>

    const server = serve<Protocol>({
      identity: serverIdentity,
      handlers,
      transport: transports.server,
      accessControl: { '*': [clientIdentity.id] },
    })

    const client = new Client<Protocol>({
      transport: transports.client,
      identity: clientIdentity,
      serverID: serverIdentity.id,
    })

    const result = await client.request('test.greet', { param: { name: 'World' } })
    expect(result).toBe('Hello, World!')

    await client.dispose()
    await server.dispose()
    await transports.dispose()

    // Flush to ensure all spans are exported
    await provider.forceFlush()

    const spans = exporter.getFinishedSpans()
    const spanNames = spans.map((s) => s.name)

    // Should have client call span
    expect(spanNames).toContain('enkaku.client.call')
    // Should have token sign span (client signs the message)
    expect(spanNames).toContain('enkaku.token.sign')
    // Should have server handle span
    expect(spanNames).toContain('enkaku.server.handle')

    // Verify trace context propagation: client and server spans share the same trace ID
    const clientSpan = spans.find((s) => s.name === 'enkaku.client.call')
    const serverSpan = spans.find((s) => s.name === 'enkaku.server.handle')
    expect(clientSpan).toBeDefined()
    expect(serverSpan).toBeDefined()
    expect(serverSpan?.spanContext().traceId).toBe(clientSpan?.spanContext().traceId)
  })

  test('traces auth failure with DID correlation', async () => {
    const serverIdentity = randomIdentity()
    const unknownClientIdentity = randomIdentity()

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const handler: RequestHandler<Protocol, 'test.greet'> = (ctx) => {
      return `Hello, ${ctx.param.name}!`
    }
    const handlers = { 'test.greet': handler } as ProcedureHandlers<Protocol>

    const server = serve<Protocol>({
      identity: serverIdentity,
      handlers,
      transport: transports.server,
      accessControl: { '*': [] }, // Empty access list - no one allowed
    })

    const client = new Client<Protocol>({
      transport: transports.client,
      identity: unknownClientIdentity,
      serverID: serverIdentity.id,
    })

    await expect(client.request('test.greet', { param: { name: 'World' } })).rejects.toThrow()

    await client.dispose()
    await server.dispose()
    await transports.dispose()

    // Flush to ensure all spans are exported
    await provider.forceFlush()

    const spans = exporter.getFinishedSpans()

    // Find the server handle span
    const serverSpan = spans.find((s) => s.name === 'enkaku.server.handle')
    expect(serverSpan).toBeDefined()

    // Verify it has the DID and error attributes
    const attrs = serverSpan?.attributes
    expect(attrs?.['enkaku.auth.did']).toBe(unknownClientIdentity.id)
    expect(attrs?.['enkaku.auth.allowed']).toBe(false)
  })
})
