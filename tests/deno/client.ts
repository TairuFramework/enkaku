import { Client } from 'https://esm.sh/@enkaku/client@0.6'
import { ClientTransport } from 'https://esm.sh/@enkaku/http-client-transport@0.6'

const client = new Client({
  transport: new ClientTransport({ url: 'http://localhost:8000' }),
})

const stream = await client.createChannel('example:channel', 3)
const reader = stream.receive.getReader()
const received: Array<number> = []
while (true) {
  const { done, value } = await reader.read()
  if (done) {
    break
  }
  received.push(value)
}

const result = await stream.result
console.log('stream ended', received, result)
