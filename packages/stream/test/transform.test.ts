import { expect, test, vi } from 'vitest'

import { createReadable } from '../src/readable.js'
import { map, mapAsync, tap, transform } from '../src/transform.js'
import { createArraySink } from '../src/writable.js'

test('transform() applies any transformation', async () => {
  const [source, controller] = createReadable<number>()
  const [sink, result] = createArraySink()
  source
    .pipeThrough(
      transform(
        (n, controller) => {
          if (n % 2 === 0) {
            controller.enqueue(n + 1)
          }
        },
        (controller) => {
          controller.enqueue(9)
        },
      ),
    )
    .pipeTo(sink)

  controller.enqueue(1)
  controller.enqueue(2)
  controller.enqueue(3)
  controller.enqueue(4)
  controller.close()

  await expect(result).resolves.toEqual([3, 5, 9])
})

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
  const handler = vi.fn((n: number) => n + 1)

  const [source, controller] = createReadable<number>()
  const [sink, result] = createArraySink()
  source.pipeThrough(tap(handler)).pipeTo(sink)

  controller.enqueue(1)
  controller.enqueue(2)
  controller.close()

  await expect(result).resolves.toEqual([1, 2])
  expect(handler.mock.calls).toEqual([[1], [2]])
})
