import { ServerTransport } from '@enkaku/http-serve'
import { serve } from '@enkaku/server'
import type { Protocol } from './stateful-protocol.ts'

const transport = new ServerTransport<Protocol>()
serve<Protocol>({
  requireAuth: false,
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
            writer.write(ctx.param + count++)
          }
        }, 50)
        ctx.signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('aborted'))
        })
      })
    },
  },
  transport,
})

export default transport
