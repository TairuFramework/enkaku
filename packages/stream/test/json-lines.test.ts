import { fromJSONLines, toJSONLines } from '../src/json-lines.js'
import { createReadable } from '../src/readable.js'
import { createArraySink } from '../src/writable.js'

describe('fromJSONLines()', () => {
  test('parses JSON lines to individual values', async () => {
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines()).pipeTo(sink)

    controller.enqueue(JSON.stringify({ foo: 'bar' }))
    controller.enqueue(new TextEncoder().encode('\n{"test":'))
    controller.enqueue('"other"}\n')
    controller.close()

    await expect(result).resolves.toEqual([{ foo: 'bar' }, { test: 'other' }])
  })

  test('allows newlines in strings', async () => {
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines()).pipeTo(sink)

    controller.enqueue('{"foo": "bar\nbaz"}')
    controller.close()

    await expect(result).resolves.toEqual([{ foo: 'bar\nbaz' }])
  })

  test('parses formatted JSON', async () => {
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines()).pipeTo(sink)

    controller.enqueue(`
      {
        "foo": "bar"
    `)
    controller.enqueue(`,
        "baz": "qux"`)
    controller.enqueue('}')
    controller.close()

    await expect(result).resolves.toEqual([{ foo: 'bar', baz: 'qux' }])
  })

  test('flushes buffered value when source is closed', async () => {
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines()).pipeTo(sink)

    controller.enqueue('{"partial": "json"}')
    controller.close()

    await expect(result).resolves.toEqual([{ partial: 'json' }])
  })
})

test('toJSONLines() encodes values to JSON lines', async () => {
  const [source, controller] = createReadable()
  const [sink, result] = createArraySink()
  source.pipeThrough(toJSONLines()).pipeTo(sink)

  controller.enqueue({ foo: 'foo' })
  controller.enqueue({ bar: 'bar' })
  controller.close()

  await expect(result).resolves.toEqual(['{"foo":"foo"}\n', '{"bar":"bar"}\n'])
})
