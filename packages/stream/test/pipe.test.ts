import { createPipe } from '../src/index.js'

describe('createPipe()', () => {
  test('reads after writes', async () => {
    const { readable, writable } = createPipe()

    const writer = writable.getWriter()
    await writer.write('one')
    await writer.write('two')
    await writer.close()

    const reader = readable.getReader()
    const readOne = await reader.read()
    expect(readOne.done).toBe(false)
    expect(readOne.value).toBe('one')
    const readTwo = await reader.read()
    expect(readTwo.done).toBe(false)
    expect(readTwo.value).toBe('two')
    const readEnd = await reader.read()
    expect(readEnd.done).toBe(true)
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
