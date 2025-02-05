import { Client } from 'https://esm.sh/@enkaku/client@0.10.0'
import { ClientTransport } from 'https://esm.sh/@enkaku/http-client-transport@0.10.0'
import { createArraySink } from 'https://esm.sh/@enkaku/stream@0.10.0'

const client = new Client({
  transport: new ClientTransport({ url: 'http://localhost:8000' }),
})

const stream = client.createStream('example:stream', { param: 3 })
const [writable, received] = createArraySink<number>()
stream.readable.pipeTo(writable)
console.log('stream ended', await received, await stream)

await client.dispose()
