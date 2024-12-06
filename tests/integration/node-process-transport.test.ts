import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@enkaku/client'
import { NodeProcessTransport } from '@enkaku/node-process-transport'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'

const protocol = {
  test: {
    type: 'request',
    params: { type: 'string' },
    result: { type: 'string' },
  },
} satisfies ProtocolDefinition
type Protocol = typeof protocol

const serverPath = resolve(dirname(fileURLToPath(import.meta.url)), './node-process/server.js')

describe('Node process transport', () => {
  test('supports a child process server', async () => {
    const process = spawn('node', [serverPath], { stdio: ['pipe', 'pipe'] })
    const transport = new NodeProcessTransport<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >({ streams: { readable: process.stdout, writable: process.stdin } })

    const client = new Client<Protocol>({ transport })
    const result = await client.request('test', 'stranger').toValue()
    expect(result).toBe('Hello stranger')

    await transport.dispose()
    process.kill()
  })
})
