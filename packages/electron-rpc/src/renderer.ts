import { Client, type ClientParams } from '@enkaku/client'
import type { ClientTransportOf, ProtocolDefinition } from '@enkaku/protocol'
import { Transport } from '@enkaku/transport'

import { DEFAULT_BRIDGE_NAME } from './constants.js'
import type { CreateProcess } from './types.js'

declare global {
  interface Window {
    Enkaku: {
      createProcess: CreateProcess
    }
  }
}

export async function createRendererTransportStream<R, W>(
  name: string,
): Promise<ReadableWritablePair<R, W>> {
  let controller: ReadableStreamDefaultController
  const readable = new ReadableStream<R>({
    start(ctrl) {
      controller = ctrl
    },
  })
  function onMessage(msg: R) {
    controller.enqueue(msg)
  }

  const sendMessage = await window.Enkaku.createProcess(name, onMessage)
  const writable = new WritableStream<W>({
    write(msg) {
      sendMessage(msg)
    },
  })

  return { readable, writable }
}

export type RendererClientOptions<Protocol extends ProtocolDefinition> = Omit<
  ClientParams<Protocol>,
  'transport'
> & {
  name?: string
}

export function createRendererClient<Protocol extends ProtocolDefinition>(
  options: RendererClientOptions<Protocol> = {},
) {
  const { name = DEFAULT_BRIDGE_NAME, ...clientOptions } = options
  const transport = new Transport({
    stream: createRendererTransportStream(name),
  }) as ClientTransportOf<Protocol>
  return new Client<Protocol>({ transport, ...clientOptions })
}
