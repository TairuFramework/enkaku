import { Client } from '@enkaku/client'
import { ClientTransport } from '@enkaku/http-fetch'
import { createArraySink } from '@sozai/stream'
import type { Protocol } from './stateful-protocol.ts'

const client = new Client<Protocol>({
  transport: new ClientTransport<Protocol>({ url: 'http://localhost:8000' }),
})

const stream = client.createStream('example:stream', { param: 3 })
const [writable, received] = createArraySink<number>()
stream.readable.pipeTo(writable)
console.log('stream ended', await received, await stream)

await client.dispose()
