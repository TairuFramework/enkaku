import type { ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'
import { type Server, type ServerParams, serve } from '@enkaku/server'
import { Transport } from '@enkaku/transport'
import { type IpcMainEvent, ipcMain, MessageChannelMain, type MessagePortMain } from 'electron'

import { DEFAULT_BRIDGE_NAME } from './constants.js'

export type PortOrPromise = MessagePortMain | Promise<MessagePortMain>
export type PortInput = PortOrPromise | (() => PortOrPromise)
export type PortHandler = (port: MessagePortMain, event: IpcMainEvent) => void | Promise<void>

export async function createMainTransportStream<R, W>(
  input: PortInput,
): Promise<ReadableWritablePair<R, W>> {
  const port = await Promise.resolve(typeof input === 'function' ? input() : input)

  const readable = new ReadableStream({
    start(controller) {
      port.on('message', (msg) => {
        controller.enqueue(msg.data)
      })
      port.start()
    },
  })

  const writable = new WritableStream({
    write(msg) {
      port.postMessage(msg)
    },
  })

  return { readable, writable }
}

export function handleProcessPort(name: string, handler: PortHandler) {
  ipcMain.on(`enkaku:process/${name}/create`, async (event) => {
    const { port1, port2 } = new MessageChannelMain()
    await handler(port1, event)
    event.sender.postMessage(`enkaku:process/${name}/port`, null, [port2])
  })
}

export type ServeProcessParams<Protocol extends ProtocolDefinition> = Omit<
  ServerParams<Protocol>,
  'transports'
> & {
  name?: string
}

export function serveProcess<Protocol extends ProtocolDefinition>(
  params: ServeProcessParams<Protocol>,
) {
  const { name, ...serverParams } = params

  handleProcessPort(name ?? DEFAULT_BRIDGE_NAME, (port, event) => {
    let server: Server<Protocol> | undefined
    event.sender.once('destroyed', () => {
      port.close()
      server?.dispose()
      server = undefined
    })

    const transport = new Transport({
      stream: createMainTransportStream(port),
    }) as ServerTransportOf<Protocol>
    server = serve<Protocol>({ public: true, transport, ...serverParams })
  })
}
