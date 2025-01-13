import { jest } from '@jest/globals'

import { map, mapAsync, tap } from '../src/map.js'
import { createReadable } from '../src/readable.js'
import { createArraySink } from '../src/writable.js'

test('map() applies a synchronous transformation', async () => {
  const [source, controller] = createReadable<number>()
  const [sink, result] = createArraySink()
  source.pipeThrough(map((n) => n + 1)).pipeTo(sink)

  controller.enqueue(1)
  controller.enqueue(2)
  controller.close()

  await expect(result).resolves.toEqual([2, 3])
})

test('mapAsync() applies an asynchronous transformation', async () => {
  const [source, controller] = createReadable<number>()
  const [sink, result] = createArraySink()
  source.pipeThrough(mapAsync(async (n) => n + 1)).pipeTo(sink)

  controller.enqueue(1)
  controller.enqueue(2)
  controller.close()

  await expect(result).resolves.toEqual([2, 3])
})

test('tap() calls the handler without transforming the input', async () => {
  const handler = jest.fn((n: number) => n + 1)

  const [source, controller] = createReadable<number>()
  const [sink, result] = createArraySink()
  source.pipeThrough(tap(handler)).pipeTo(sink)

  controller.enqueue(1)
  controller.enqueue(2)
  controller.close()

  await expect(result).resolves.toEqual([1, 2])
  expect(handler.mock.calls).toEqual([[1], [2]])
})
