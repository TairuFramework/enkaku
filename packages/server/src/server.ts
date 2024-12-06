import type { AnyServerPayloadOf, ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'
import { type SignedToken, type Token, createUnsignedToken, isSignedToken } from '@enkaku/token'
import { type Disposer, createDisposer } from '@enkaku/util'

import { type CommandAccessRecord, checkClientToken } from './access-control.js'
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

type ProcessMessageOf<Protocol extends ProtocolDefinition> =
  | EventMessageOf<Protocol>
  | RequestMessageOf<Protocol>
  | StreamMessageOf<Protocol>
  | ChannelMessageOf<Protocol>

export type HandleMessagesParams<Protocol extends ProtocolDefinition> = {
  controllers: Record<string, HandlerController>
  handlers: CommandHandlers<Protocol>
  reject: (rejection: RejectionType) => void
  signal: AbortSignal
  transport: ServerTransportOf<Protocol>
} & ({ public: true } | { public: false; serverID: string; access: CommandAccessRecord })

async function handleMessages<Protocol extends ProtocolDefinition>(
  params: HandleMessagesParams<Protocol>,
): Promise<void> {
  const { controllers, handlers, reject, signal, transport } = params
  const context: HandlerContext<Protocol> = {
    controllers,
    handlers,
    reject,
    send: (payload) => transport.write(createUnsignedToken(payload)),
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

  function processHandler(
    message: ProcessMessageOf<Protocol>,
    handle: () => ErrorRejection | Promise<void>,
  ) {
    const returned = handle()
    if (returned instanceof ErrorRejection) {
      reject(returned)
    } else {
      const id =
        message.payload.typ === 'event' ? Math.random().toString(36).slice(2) : message.payload.rid
      running[id] = returned
      returned.then(() => {
        delete running[id]
      })
    }
  }

  const process = params.public
    ? processHandler
    : async (message: ProcessMessageOf<Protocol>, handle: () => ErrorRejection | Promise<void>) => {
        try {
          if (!params.public) {
            if (!isSignedToken(message as Token)) {
              throw new Error('Message is not signed')
            }
            await checkClientToken(
              params.serverID,
              params.access,
              message as unknown as SignedToken,
            )
          }
        } catch (err) {
          const errorMessage = (err as Error).message ?? 'Access denied'
          if (message.payload.typ === 'event') {
            reject(new ErrorRejection(errorMessage, { cause: err, info: message }))
          } else {
            context.send({
              typ: 'error',
              rid: message.payload.rid,
              code: 'EK02',
              msg: errorMessage,
            } as AnyServerPayloadOf<Protocol>)
          }
          return
        }
        processHandler(message, handle)
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
      case 'channel': {
        const message = msg as unknown as ChannelMessageOf<Protocol>
        process(message, () => handleChannel(context, message))
        break
      }
      case 'event': {
        const message = msg as unknown as EventMessageOf<Protocol>
        process(message, () => handleEvent(context, message))
        break
      }
      case 'request': {
        const message = msg as unknown as RequestMessageOf<Protocol>
        process(message, () => handleRequest(context, message))
        break
      }
      case 'send': {
        const controller = controllers[msg.payload.rid] as ChannelController | undefined
        controller?.writer.write(msg.payload.val)
        break
      }
      case 'stream': {
        const message = msg as unknown as StreamMessageOf<Protocol>
        process(message, () => handleStream(context, message))
        break
      }
    }

    handleNext()
  }
  handleNext()

  return disposer.disposed
}

export type ServeParams<Protocol extends ProtocolDefinition> = {
  handlers: CommandHandlers<Protocol>
  signal?: AbortSignal
  transport: ServerTransportOf<Protocol>
} & ({ public: true } | { public?: false; id: string; access?: CommandAccessRecord })

export type Server = Disposer & {
  rejections: ReadableStream<RejectionType>
}

export function serve<Protocol extends ProtocolDefinition>(params: ServeParams<Protocol>): Server {
  const abortController = new AbortController()
  const controllers: Record<string, HandlerController> = Object.create(null)

  const rejections = createPipe<RejectionType>()
  const rejectionsWriter = rejections.writable.getWriter()
  function reject(rejection: RejectionType) {
    void rejectionsWriter.write(rejection)
  }

  const handlersDone = handleMessages({
    controllers,
    handlers: params.handlers as CommandHandlers<Protocol>,
    reject,
    signal: abortController.signal,
    transport: params.transport as ServerTransportOf<Protocol>,
    ...(params.public
      ? { public: true }
      : { public: false, serverID: params.id, access: params.access ?? {} }),
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
