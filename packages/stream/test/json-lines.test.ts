import { describe, expect, test, vi } from 'vitest'

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

  test('supports primitive values', async () => {
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines()).pipeTo(sink)

    controller.enqueue('null\n')
    controller.enqueue('true\n')
    controller.enqueue('false\n')
    controller.enqueue('"test"\n')
    controller.enqueue('123\n')
    controller.close()

    await expect(result).resolves.toEqual([null, true, false, 'test', 123])
  })

  test('calls onInvalidJSON when JSON is invalid', async () => {
    const onInvalidJSON = vi.fn()
    const [source, controller] = createReadable()
    const [sink, result] = createArraySink()
    source.pipeThrough(fromJSONLines({ onInvalidJSON })).pipeTo(sink)

    controller.enqueue('{"invalid": json}')
    controller.close()

    await expect(result).resolves.toEqual([])
    expect(onInvalidJSON).toHaveBeenCalledWith(
      '{"invalid":json}',
      expect.any(TransformStreamDefaultController),
    )
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
