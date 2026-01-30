import { MessageChannel } from 'node:worker_threads'
import { describe, expect, test } from 'vitest'

import { createTransportStream, MessageTransport } from '../src/index.js'

describe('createTransportStream()', () => {
  test('receives messages from a MessagePort', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<{ value: string }, unknown>(port1)

    const reader = stream.readable.getReader()
    port2.postMessage({ value: 'hello' })

    const result = await reader.read()
    expect(result.value).toEqual({ value: 'hello' })

    port1.close()
    port2.close()
  })

  test('sends messages through a MessagePort', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<unknown, { value: string }>(port1)

    const received = new Promise<{ value: string }>((resolve) => {
      port2.on('message', resolve)
    })

    const writer = stream.writable.getWriter()
    await writer.write({ value: 'hello' })

    const msg = await received
    expect(msg).toEqual({ value: 'hello' })

    await writer.close()
    port1.close()
    port2.close()
  })

  test('handles multiple messages in sequence', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<number, number>(port1)

    const reader = stream.readable.getReader()

    port2.postMessage(1)
    port2.postMessage(2)
    port2.postMessage(3)

    const first = await reader.read()
    const second = await reader.read()
    const third = await reader.read()
    expect(first.value).toBe(1)
    expect(second.value).toBe(2)
    expect(third.value).toBe(3)

    port1.close()
    port2.close()
  })
})

describe('createTransportStream() source resolution', () => {
  test('accepts a Promise<MessagePort>', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<{ n: number }, unknown>(Promise.resolve(port1))

    const reader = stream.readable.getReader()
    port2.postMessage({ n: 42 })

    const result = await reader.read()
    expect(result.value).toEqual({ n: 42 })

    port1.close()
    port2.close()
  })

  test('accepts a factory function returning MessagePort', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<{ n: number }, unknown>(() => port1)

    const reader = stream.readable.getReader()
    port2.postMessage({ n: 99 })

    const result = await reader.read()
    expect(result.value).toEqual({ n: 99 })

    port1.close()
    port2.close()
  })

  test('accepts a factory function returning Promise<MessagePort>', async () => {
    const { port1, port2 } = new MessageChannel()
    const stream = await createTransportStream<{ n: number }, unknown>(
      () => Promise.resolve(port1),
    )

    const reader = stream.readable.getReader()
    port2.postMessage({ n: 7 })

    const result = await reader.read()
    expect(result.value).toEqual({ n: 7 })

    port1.close()
    port2.close()
  })
})

describe('MessageTransport', () => {
  test('reads and writes messages via Transport interface', async () => {
    const { port1, port2 } = new MessageChannel()
    const transport = new MessageTransport<string, string>({ port: port1 })

    // Write a message via the transport
    const received = new Promise<string>((resolve) => {
      port2.on('message', resolve)
    })
    await transport.write('outgoing')
    expect(await received).toBe('outgoing')

    // Read a message via the transport
    port2.postMessage('incoming')
    const result = await transport.read()
    expect(result.value).toBe('incoming')

    await transport.dispose()
    port1.close()
    port2.close()
  })

  test('supports async iteration', async () => {
    const { port1, port2 } = new MessageChannel()
    const transport = new MessageTransport<number, unknown>({ port: port1 })

    port2.postMessage(10)
    port2.postMessage(20)

    const values: Array<number> = []
    for await (const value of transport) {
      values.push(value)
      if (values.length === 2) {
        break
      }
    }
    expect(values).toEqual([10, 20])

    await transport.dispose()
    port1.close()
    port2.close()
  })
})
