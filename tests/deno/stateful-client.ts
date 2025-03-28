import { Client } from 'https://esm.sh/@enkaku/client'
import { ClientTransport } from 'https://esm.sh/@enkaku/http-client-transport'
import { createArraySink } from 'https://esm.sh/@enkaku/stream'

const client = new Client({
  transport: new ClientTransport({ url: 'http://localhost:8000' }),
})

const stream = client.createStream('example:stream', { param: 3 })
const [writable, received] = createArraySink<number>()
stream.readable.pipeTo(writable)
console.log('stream ended', await received, await stream)

await client.dispose()
