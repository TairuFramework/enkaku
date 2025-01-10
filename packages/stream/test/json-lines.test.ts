import { defer } from '@enkaku/util'

import { fromJSONLines, toJSONLines } from '../src/json-lines.js'
import { createReadable } from '../src/readable.js'

test('fromJSONLines()', async () => {
  const done = defer<void>()
  const [source, controller] = createReadable()
  const sink: Array<unknown> = []
  source.pipeThrough(fromJSONLines()).pipeTo(
    new WritableStream({
      write(value) {
        sink.push(value)
      },
      close() {
        done.resolve()
      },
    }),
  )

  controller.enqueue(JSON.stringify({ foo: 'bar' }))
  controller.enqueue(new TextEncoder().encode('\n{"test":'))
  controller.enqueue('"other"}\n')
  controller.close()

  await done.promise
  expect(sink).toEqual([{ foo: 'bar' }, { test: 'other' }])
})

test('toJSONLines()', async () => {
  const done = defer<void>()
  const [source, controller] = createReadable()
  const sink: Array<string> = []

  const writable = new WritableStream({
    write(value) {
      sink.push(value)
    },
    close() {
      done.resolve()
    },
  })
  source.pipeThrough(toJSONLines()).pipeTo(writable)

  controller.enqueue({ foo: 'foo' })
  controller.enqueue({ bar: 'bar' })
  controller.close()

  await done.promise
  expect(sink).toEqual(['{"foo":"foo"}\n', '{"bar":"bar"}\n'])
})
