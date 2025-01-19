import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@enkaku/client'
import { NodeStreamsTransport } from '@enkaku/node-streams-transport'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'

const protocol = {
  test: {
    type: 'request',
    param: { type: 'string' },
    result: { type: 'string' },
  },
} satisfies ProtocolDefinition
type Protocol = typeof protocol

const serverPath = resolve(dirname(fileURLToPath(import.meta.url)), './node-streams-server.js')

describe('Node streams transport', () => {
  test('supports a child process server', async () => {
    const process = spawn('node', [serverPath], { stdio: ['pipe', 'pipe'] })
    const transport = new NodeStreamsTransport<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >({ streams: { readable: process.stdout, writable: process.stdin } })

    const client = new Client<Protocol>({ transport })
    await expect(client.request('test', { param: 'stranger' })).resolves.toBe('Hello stranger')

    await transport.dispose()
    process.kill()
  })
})
