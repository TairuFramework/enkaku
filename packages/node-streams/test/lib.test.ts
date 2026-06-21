import { Readable, Writable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createTransportStream, NodeStreamsTransport } from '../src/index.js'

describe('write pipeline failures', () => {
  const rejections: Array<unknown> = []
  const onRejection = (reason: unknown) => {
    rejections.push(reason)
  }

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })

  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  test('destination write error emits writeFailed instead of an unhandled rejection', async () => {
    const readable = new Readable({ read() {} })
    const writable = new Writable({
      write(_chunk, _encoding, callback) {
        callback(new Error('write boom'))
      },
    })
    const transport = new NodeStreamsTransport<unknown, { n: number }>({
      streams: { readable, writable },
    })
    const writeFailed = vi.fn()
    transport.events.on('writeFailed', writeFailed)

    await transport.write({ n: 1 }).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)
    expect(writeFailed).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'write boom' }) }),
    )

    await transport.dispose()
  })
})

describe('createTransportStream()', () => {
  test('converts from Node streams to transport streams', async () => {
    const written: Array<string> = []
    const source = new Readable()
    const sink = new Writable({
      write(chunk, _encoding, cb) {
        written.push(chunk.toString('utf8'))
        cb()
      },
    })
    const stream = await createTransportStream({ readable: source, writable: sink })

    source.push(JSON.stringify({ foo: 'bar' }))
    source.push(new TextEncoder().encode('\n{"test":'))
    source.push('"other"}\n')
    source.push(null)

    const reader = stream.readable.getReader()
    const first = await reader.read()
    expect(first.value).toEqual({ foo: 'bar' })
    const second = await reader.read()
    expect(second.value).toEqual({ test: 'other' })

    const writer = stream.writable.getWriter()
    await writer.write({ foo: 'foo' })
    await writer.write({ bar: 'bar' })
    await writer.close()
    expect(written).toEqual(['{"foo":"foo"}\n', '{"bar":"bar"}\n'])
  })

  test('threads maxMessageSize into the inbound framer', async () => {
    const source = new Readable({ read() {} })
    const sink = new Writable({
      write(_chunk, _encoding, cb) {
        cb()
      },
    })
    const stream = await createTransportStream<unknown, unknown>(
      { readable: source, writable: sink },
      { maxMessageSize: 50 },
    )

    const reader = stream.readable.getReader()
    const read = reader.read()
    // One oversized line — the framer must error the readable rather than emit it.
    source.push(`${JSON.stringify({ data: 'x'.repeat(100) })}\n`)

    await expect(read).rejects.toThrow('exceeds maximum message size')
  })
})
