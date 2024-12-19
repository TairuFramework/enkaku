import { ServerTransport } from 'https://esm.sh/@enkaku/http-server-transport@0.8'
import { serve } from 'https://esm.sh/@enkaku/server@0.8'

const transport = new ServerTransport()
serve({
  handlers: {
    'example:request': () => {
      console.log('received request')
      return { test: true }
    },
    'example:stream': (ctx) => {
      console.log('received stream', ctx)
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
  public: true,
  transport,
})

export default transport
