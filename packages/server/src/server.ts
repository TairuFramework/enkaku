import type {
  AnyActionDefinitions,
  AnyClientPayloadOf,
  OptionalRecord,
  ServerTransportOf,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'
import { type Disposer, createDisposer } from '@enkaku/util'

import { type EventMessageOf, handleEvent } from './handlers/event.js'
import { type RequestMessageOf, handleRequest } from './handlers/request.js'
import { ErrorRejection, type RejectionType } from './rejections.js'
import type { ActionController, ActionHandlers, HandlerContext } from './types.js'

export type HandleMessagesParams<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
> = {
  controllers: Record<string, ActionController>
  handlers: ActionHandlers<Definitions, Meta>
  reject: (rejection: RejectionType) => void
  signal: AbortSignal
  transport: ServerTransportOf<Definitions, Meta>
}

async function handleMessages<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
>(params: HandleMessagesParams<Definitions, Meta>): Promise<void> {
  const { controllers, handlers, reject, signal, transport } = params
  const context: HandlerContext<Definitions, Meta> = {
    controllers,
    handlers,
    reject,
    send: (message) => transport.write(message),
  }
  const running: Record<string, Promise<unknown>> = Object.create(null)

  const disposer = createDisposer(async () => {
    // Abort all currently running handlers
    for (const controller of Object.values(controllers)) {
      controller.abort()
    }
    // Wait until all running handlers are done
    await Promise.all(Object.values(running))
  }, signal)

  function process(
    action: AnyClientPayloadOf<Definitions>,
    returned: ErrorRejection | Promise<void>,
  ) {
    if (returned instanceof ErrorRejection) {
      reject(returned)
    } else {
      const id = action.type === 'event' ? Math.random().toString(36).slice(2) : action.id
      running[id] = returned
      returned.then(() => {
        delete running[id]
      })
    }
  }

  async function handleNext() {
    // Read next message
    const next = await transport.read()
    if (next.done) {
      await disposer.dispose()
      return
    }

    const msg = next.value
    switch (msg.action.type) {
      case 'abort':
        controllers[msg.action.id]?.abort()
        break
      case 'channel':
        throw new Error('Not implemented')
      case 'event':
        process(
          msg.action,
          handleEvent(context, msg as unknown as EventMessageOf<Definitions, Meta>),
        )
        break
      case 'request':
        process(
          msg.action,
          handleRequest(context, msg as unknown as RequestMessageOf<Definitions, Meta>),
        )
        break
      case 'send':
        // TODO: send to tracked channel
        throw new Error('Not implemented')
      case 'stream':
        throw new Error('Not implemented')
    }
  }
  handleNext()

  return disposer.disposed
}

export type ServeParams<Definitions extends AnyActionDefinitions, Meta extends OptionalRecord> = {
  handlers: ActionHandlers<Definitions, Meta>
  signal?: AbortSignal
  transport: ServerTransportOf<Definitions, Meta>
}

export type Server = Disposer & {
  rejections: ReadableStream<RejectionType>
}

export function serve<Definitions extends AnyActionDefinitions, Meta extends OptionalRecord>(
  params: ServeParams<Definitions, Meta>,
): Server {
  const abortController = new AbortController()
  const controllers: Record<string, ActionController> = Object.create(null)

  const rejections = createPipe<RejectionType>()
  const rejectionsWriter = rejections.writable.getWriter()
  function reject(rejection: RejectionType) {
    console.warn('Handler rejection', rejection)
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
