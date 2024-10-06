import { createPipe } from '@enkaku/stream'

import { Transport, createDirectTransports } from '../src/index.js'

describe('Transport', () => {
  test('reads and writes', async () => {
    const transport = new Transport({ stream: createPipe<number>() })

    await transport.write(1)
    await transport.write(2)
    await transport.write(3)

    const results: Array<number> = []
    for await (const value of transport) {
      results.push(value)
      if (results.length === 3) {
        await transport.dispose()
      }
    }

    await transport.disposed
    expect(results).toEqual([1, 2, 3])
  })
})

describe('createDirectTransports()', () => {
  test('sends messages between client and server', async () => {
    const transports = createDirectTransports<string, string>()

    await transports.client.write('c1')
    await transports.client.write('c2')
    await transports.server.write('s1')
    await transports.server.write('s2')

    const clientReceived: Array<string> = []
    for await (const value of transports.client) {
      clientReceived.push(value)
      if (clientReceived.length === 2) {
        break
      }
    }
    expect(clientReceived).toEqual(['s1', 's2'])

    const serverReceived: Array<string> = []
    for await (const value of transports.server) {
      serverReceived.push(value)
      if (serverReceived.length === 2) {
        break
      }
    }
    expect(serverReceived).toEqual(['c1', 'c2'])

    await transports.dispose()
  })
})
