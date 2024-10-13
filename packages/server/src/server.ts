import { unsignedToken } from '@enkaku/jwt'
import type { AnyClientPayloadOf, AnyDefinitions, ServerTransportOf } from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'
import { type Disposer, createDisposer } from '@enkaku/util'

import { type ChannelMessageOf, handleChannel } from './handlers/channel.js'
import { type EventMessageOf, handleEvent } from './handlers/event.js'
import { type RequestMessageOf, handleRequest } from './handlers/request.js'
import { type StreamMessageOf, handleStream } from './handlers/stream.js'
import { ErrorRejection, type RejectionType } from './rejections.js'
import type {
  ChannelController,
  CommandHandlers,
  HandlerContext,
  HandlerController,
} from './types.js'

export type HandleMessagesParams<Definitions extends AnyDefinitions> = {
  controllers: Record<string, HandlerController>
  handlers: CommandHandlers<Definitions>
  reject: (rejection: RejectionType) => void
  signal: AbortSignal
  transport: ServerTransportOf<Definitions>
}

async function handleMessages<Definitions extends AnyDefinitions>(
  params: HandleMessagesParams<Definitions>,
): Promise<void> {
  const { controllers, handlers, reject, signal, transport } = params
  const context: HandlerContext<Definitions> = {
    controllers,
    handlers,
    reject,
    send: (payload) => transport.write(unsignedToken(payload)),
  }
  const running: Record<string, Promise<void>> = Object.create(null)

  const disposer = createDisposer(async () => {
    // Abort all currently running handlers
    for (const controller of Object.values(controllers)) {
      controller.abort()
    }
    // Wait until all running handlers are done
    await Promise.all(Object.values(running))
  }, signal)

  function process(
    payload: AnyClientPayloadOf<Definitions>,
    returned: ErrorRejection | Promise<void>,
  ) {
    if (returned instanceof ErrorRejection) {
      reject(returned)
    } else {
      const id = payload.typ === 'event' ? Math.random().toString(36).slice(2) : payload.rid
      running[id] = returned
      returned.then(() => {
        delete running[id]
      })
    }
  }

  async function handleNext() {
    const next = await transport.read()
    if (next.done) {
      await disposer.dispose()
      return
    }

    const msg = next.value
    switch (msg.payload.typ) {
      case 'abort':
        controllers[msg.payload.rid]?.abort()
        break
      case 'channel':
        process(
          msg.payload,
          handleChannel(context, msg as unknown as ChannelMessageOf<Definitions>),
        )
        break
      case 'event':
        process(msg.payload, handleEvent(context, msg as unknown as EventMessageOf<Definitions>))
        break
      case 'request':
        process(
          msg.payload,
          handleRequest(context, msg as unknown as RequestMessageOf<Definitions>),
        )
        break
      case 'send': {
        const controller = controllers[msg.payload.rid] as ChannelController | undefined
        controller?.writer.write(msg.payload.val)
        break
      }
      case 'stream':
        process(msg.payload, handleStream(context, msg as unknown as StreamMessageOf<Definitions>))
        break
    }

    handleNext()
  }
  handleNext()

  return disposer.disposed
}

export type ServeParams<Definitions extends AnyDefinitions> = {
  handlers: CommandHandlers<Definitions>
  signal?: AbortSignal
  transport: ServerTransportOf<Definitions>
}

export type Server = Disposer & {
  rejections: ReadableStream<RejectionType>
}

export function serve<Definitions extends AnyDefinitions>(
  params: ServeParams<Definitions>,
): Server {
  const abortController = new AbortController()
  const controllers: Record<string, HandlerController> = Object.create(null)

  const rejections = createPipe<RejectionType>()
  const rejectionsWriter = rejections.writable.getWriter()
  function reject(rejection: RejectionType) {
    void rejectionsWriter.write(rejection)
  }

  const handlersDone = handleMessages({
    controllers,
    handlers: params.handlers,
    reject,
    transport: params.transport,
    signal: abortController.signal,
  })

  const disposer = createDisposer(async () => {
    // Signal messages handler to stop execution and run cleanup logic
    abortController.abort()
    // Wait until all handlers are done - they might still need to flush messages to the transport
    await handlersDone
    // Dispose transport
    await params.transport.dispose()
    // Cleanup rejections writer
    await rejectionsWriter.close()
  }, params.signal)

  return { ...disposer, rejections: rejections.readable }
}
