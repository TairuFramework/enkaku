import { describe, expect, test } from 'vitest'

import { createPipe } from '../src/index.js'

describe('createPipe()', () => {
  test('reads after writes', async () => {
    const { readable, writable } = createPipe<string>()

    const writer = writable.getWriter()
    await writer.write('one')
    await writer.write('two')
    await writer.close()

    const reader = readable.getReader()
    const values: Array<string> = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      values.push(value)
    }
    expect(values).toEqual(['one', 'two'])
  })

  test('write and read loop', async () => {
    const values = ['one', 'two', 'three']
    const { readable, writable } = createPipe()
    const reader = readable.getReader()
    const writer = writable.getWriter()

    let count = 0
    while (true) {
      const nextWrite = values.shift()
      if (nextWrite == null) {
        await writer.close()
      } else {
        await writer.write(nextWrite)
      }

      const nextRead = await reader.read()
      if (nextRead.done) {
        break
      }
      count++
    }

    expect(count).toBe(3)
    expect(values).toHaveLength(0)
  })
})
