import type {
  AnyActionDefinitions,
  AnyServerMessageOf,
  ClientMessage,
  OptionalRecord,
  StreamActionPayloadOf,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'

import { ErrorRejection } from '../rejections.js'
import type {
  ActionParamsType,
  ActionReceiveType,
  ActionResultType,
  HandlerContext,
  StreamHandler,
  StreamHandlerContext,
} from '../types.js'
import { consumeReader, executeHandler } from '../utils.js'

export type StreamMessageOf<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
  Name extends keyof Definitions & string = keyof Definitions & string,
> = ClientMessage<StreamActionPayloadOf<Name, Definitions[Name]>, Meta>

export function handleStream<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
  Name extends keyof Definitions & string,
>(
  context: HandlerContext<Definitions, Meta>,
  message: StreamMessageOf<Definitions, Meta, Name>,
): ErrorRejection | Promise<void> {
  const { action, meta } = message
  const handler = context.handlers[action.name] as StreamHandler<
    ActionParamsType<Definitions, Name>,
    ActionReceiveType<Definitions, Name>,
    ActionResultType<Definitions, Name>,
    Meta
  >
  if (handler == null) {
    return new ErrorRejection(`No handler for action: ${action.name}`, { info: action })
  }

  const controller = new AbortController()
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
    signal: controller.signal,
    writable: receiveStream.writable,
  }
  return executeHandler(context, action, () => handler(handlerContext))
}
