import {
  combineTransformSteps,
  createConnection,
  createPipe,
  createPipeline,
  createTransformSink,
  createTransformSource,
  createTransformStep,
  toStep,
} from '../src/index.js'

describe('createConnection()', () => {
  test('reads and writes', async () => {
    const [client, server] = createConnection<string>()
    const clientReader = client.readable.getReader()
    const clientWriter = client.writable.getWriter()
    const serverReader = server.readable.getReader()
    const serverWriter = server.writable.getWriter()

    await clientWriter.write('hello from client')
    const serverRead1 = await serverReader.read()
    expect(serverRead1.done).toBe(false)
    expect(serverRead1.value).toBe('hello from client')

    await serverWriter.write('hello from server')
    const clientRead1 = await clientReader.read()
    expect(clientRead1.done).toBe(false)
    expect(clientRead1.value).toBe('hello from server')

    await clientWriter.close()
    const serverRead2 = await serverReader.read()
    expect(serverRead2.done).toBe(true)

    await serverWriter.close()
    const clientRead2 = await clientReader.read()
    expect(clientRead2.done).toBe(true)
  })
})

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

describe('transformations pipeline', () => {
  test('using transformation functions directly', async () => {
    const source = createTransformSource<string>((input, controller) => {
      if (input.trim() !== '') {
        controller.enqueue(toStep(input))
      }
    })
    const transforms = combineTransformSteps<string, number>(
      createTransformStep((value) => Number.parseInt(value, 10)),
      createTransformStep((value) => value + 5),
      createTransformStep((value) => value * 2),
    )
    const sink = createTransformSink<number>((result, controller) => {
      if (result.ok) {
        controller.enqueue(result.value)
      } else {
        controller.error(result.reason)
      }
    })

    source.readable.pipeThrough(transforms)
    transforms.readable.pipeThrough(sink)

    const writer = source.writable.getWriter()
    await writer.write('5')
    await writer.write(' ')
    await writer.write('15')

    const reader = sink.readable.getReader()
    const first = await reader.read()
    expect(first.value).toEqual(20)
    const second = await reader.read()
    expect(second.value).toEqual(40)
  })

  test('using createPipeline()', async () => {
    const pipeline = createPipeline<string, number>({
      source: (input, controller) => {
        if (input.trim() !== '') {
          controller.enqueue(toStep(input))
        }
      },
      steps: [
        createTransformStep<string, number>((value) => Number.parseInt(value, 10)),
        (value: number) => value + 5,
        createTransformStep<number>((value) => value * 2),
      ],
      sink: (result, controller) => {
        if (result.ok) {
          controller.enqueue(result.value)
        } else {
          controller.error(result.reason)
        }
      },
    })

    const writer = pipeline.writable.getWriter()
    await writer.write('5')
    await writer.write(' ')
    await writer.write('15')

    const reader = pipeline.readable.getReader()
    const first = await reader.read()
    expect(first.value).toEqual(20)
    const second = await reader.read()
    expect(second.value).toEqual(40)
  })
})
