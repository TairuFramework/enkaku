import type {
  AnyActionDefinitions,
  AnyServerMessageOf,
  ChannelActionPayloadOf,
  ClientMessage,
  OptionalRecord,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'

import { ErrorRejection } from '../rejections.js'
import type {
  ActionParamsType,
  ActionReceiveType,
  ActionResultType,
  ActionSendType,
  ChannelController,
  ChannelHandler,
  HandlerContext,
} from '../types.js'
import { consumeReader, executeHandler } from '../utils.js'

export type ChannelMessageOf<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
  Name extends keyof Definitions & string = keyof Definitions & string,
> = ClientMessage<ChannelActionPayloadOf<Name, Definitions[Name]>, Meta>

export function handleChannel<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
  Name extends keyof Definitions & string,
>(
  context: HandlerContext<Definitions, Meta>,
  message: ChannelMessageOf<Definitions, Meta, Name>,
): ErrorRejection | Promise<void> {
  const { action, meta } = message
  const handler = context.handlers[action.name] as ChannelHandler<
    ActionParamsType<Definitions, Name>,
    ActionSendType<Definitions, Name>,
    ActionReceiveType<Definitions, Name>,
    ActionResultType<Definitions, Name>,
    Meta
  >
  if (handler == null) {
    return new ErrorRejection(`No handler for action: ${action.name}`, { info: action })
  }

  const sendStream = createPipe<ActionSendType<Definitions, Name>>()
  const controller: ChannelController<ActionSendType<Definitions, Name>> = Object.assign(
    new AbortController(),
    { writer: sendStream.writable.getWriter() },
  )
  controller.signal.addEventListener('abort', () => {
    controller.writer.close()
  })
  context.controllers[action.id] = controller

  const receiveStream = createPipe<ActionReceiveType<Definitions, Name>>()
  consumeReader({
    onValue: async (value) => {
      await context.send({
        action: { type: 'receive', id: message.action.id, value },
      } as AnyServerMessageOf<Definitions>)
    },
    reader: receiveStream.readable.getReader(),
    signal: controller.signal,
  })

  const handlerContext = {
    params: action.params,
    meta,
    readable: sendStream.readable,
    signal: controller.signal,
    writable: receiveStream.writable,
  }
  return executeHandler(context, action, () => handler(handlerContext))
}
