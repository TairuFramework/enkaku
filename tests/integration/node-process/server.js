import { NodeProcessTransport } from '@enkaku/node-process-transport'
import { serve } from '@enkaku/server'

serve({
  handlers: { test: (ctx) => `Hello ${ctx.params}` },
  insecure: true,
  transport: new NodeProcessTransport({
    streams: { readable: process.stdin, writable: process.stdout },
  }),
})
