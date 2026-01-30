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
