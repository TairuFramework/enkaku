import { Readable, Writable } from 'node:stream'

import { createTransportStream } from '../src/index.js'

describe('createTransportStream()', () => {
  test('converts from Node streams to transport streams', async () => {
    const written: Array<string> = []
    const source = new Readable()
    const sink = new Writable({
      write(chunk, encoding, cb) {
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
    writer.write({ foo: 'foo' })
    writer.write({ bar: 'bar' })
    await writer.close()
    expect(written).toEqual(['{"foo":"foo"}\n', '{"bar":"bar"}\n'])
  })
})
