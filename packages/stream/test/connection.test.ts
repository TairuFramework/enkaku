import { createConnection } from '../src/connection.js'

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
