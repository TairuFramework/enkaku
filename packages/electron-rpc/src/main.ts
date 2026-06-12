import type { ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'
import {
  type ServeParams,
  type Server,
  type ServerAccessOptions,
  type ServerBaseParams,
  serve,
} from '@enkaku/server'
import { Transport } from '@enkaku/transport'
import { type IpcMainEvent, ipcMain, MessageChannelMain, type MessagePortMain } from 'electron'

import { isAllowedSenderURL, type SenderURLAllowlist } from './allowlist.js'
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

export type HandleProcessPortOptions = {
  /**
   * Allowlist of sender frame URLs permitted to request a port. When set,
   * requests from frames whose URL does not match (or with no sender frame)
   * are silently ignored. When omitted, ALL frames are accepted — only safe
   * if no untrusted/remote content can ever load in any window.
   */
  allowedSenderURLs?: SenderURLAllowlist
}

/**
 * Listen for `enkaku:process/<name>/create` IPC messages and hand a
 * MessagePort back to the requesting renderer frame.
 *
 * Security: any frame in any window can send this IPC message. Pass
 * `allowedSenderURLs` to restrict which frames get a port, and prefer
 * `identity`/`accessRules` on the served protocol for privileged handlers —
 * frame-URL checks alone are not an authentication mechanism.
 */
export function handleProcessPort(
  name: string,
  handler: PortHandler,
  options: HandleProcessPortOptions = {},
) {
  const { allowedSenderURLs } = options
  ipcMain.on(`enkaku:process/${name}/create`, async (event) => {
    if (allowedSenderURLs != null) {
      const senderURL = event.senderFrame?.url
      if (senderURL == null || !isAllowedSenderURL(senderURL, allowedSenderURLs)) {
        return
      }
    }
    const { port1, port2 } = new MessageChannelMain()
    await handler(port1, event)
    event.sender.postMessage(`enkaku:process/${name}/port`, null, [port2])
  })
}

// Composed from ServerBaseParams + ServerAccessOptions rather than
// Omit<ServeParams, 'transport'>: Omit over the ServerAccessOptions union
// collapses it to its common keys, which loses the `requireAuth: false` arm.
export type ServeProcessParams<Protocol extends ProtocolDefinition> = Omit<
  ServerBaseParams<Protocol>,
  'transports'
> &
  ServerAccessOptions & {
    name?: string
    /** See {@link HandleProcessPortOptions.allowedSenderURLs}. */
    allowedSenderURLs?: SenderURLAllowlist
  }

/**
 * Serve an Enkaku protocol to renderer processes over Electron IPC ports.
 *
 * One live server is kept per (sender, name): a repeated create request from
 * the same WebContents (e.g. after a reload) disposes the previous server and
 * port before creating new ones, so renderers cannot grow servers without
 * bound. Servers are also disposed when the sender is destroyed.
 *
 * Security: handlers run in the main process. For privileged procedures,
 * configure the server's `identity`/`accessRules` (token auth) in addition to
 * `allowedSenderURLs` — the frame URL restricts which frames get a transport,
 * while access rules authorize individual calls.
 */
export function serveProcess<Protocol extends ProtocolDefinition>(
  params: ServeProcessParams<Protocol>,
) {
  const { name, allowedSenderURLs, ...serverParams } = params
  const active = new Map<
    number,
    { port: MessagePortMain; server: Server<Protocol>; onDestroyed: () => void }
  >()

  handleProcessPort(
    name ?? DEFAULT_BRIDGE_NAME,
    (port, event) => {
      const senderID = event.sender.id

      // Reuse cap: one live server per (sender, name) — replace any previous one
      const previous = active.get(senderID)
      if (previous != null) {
        active.delete(senderID)
        event.sender.removeListener('destroyed', previous.onDestroyed)
        previous.port.close()
        void previous.server.dispose()
      }

      const transport = new Transport({
        stream: createMainTransportStream(port),
      }) as ServerTransportOf<Protocol>
      const server = serve<Protocol>({ transport, ...serverParams } as ServeParams<Protocol>)
      const onDestroyed = () => {
        if (active.get(senderID)?.server === server) {
          active.delete(senderID)
        }
        port.close()
        void server.dispose()
      }
      active.set(senderID, { port, server, onDestroyed })

      event.sender.once('destroyed', onDestroyed)
    },
    { allowedSenderURLs },
  )
}
