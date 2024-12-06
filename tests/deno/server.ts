import { ServerTransport } from 'https://esm.sh/@enkaku/http-server-transport@0.6.2'
import { serve } from 'https://esm.sh/@enkaku/server@0.6'

const transport = new ServerTransport()
serve({
  handlers: {
    'example:request': () => {
      console.log('received request')
      return { test: true }
    },
    'example:channel': (ctx) => {
      console.log('received channel', ctx)
      return new Promise((resolve, reject) => {
        const writer = ctx.writable.getWriter()
        let count = 0
        const timer = setInterval(() => {
          if (count === 3) {
            clearInterval(timer)
            resolve('END')
          } else {
            writer.write(ctx.params + count++)
          }
        }, 50)
        ctx.signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('aborted'))
        })
      })
    },
  },
  insecure: true,
  transport,
})

export default { fetch: transport.handleRequest }
