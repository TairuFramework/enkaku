import { NodeStreamsTransport } from '@enkaku/node-streams-transport'
import { serve } from '@enkaku/server'

serve({
  handlers: { test: (ctx) => `Hello ${ctx.param}` },
  public: true,
  transport: new NodeStreamsTransport({
    streams: { readable: process.stdin, writable: process.stdout },
  }),
})
