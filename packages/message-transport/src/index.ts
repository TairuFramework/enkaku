import { Transport } from '@enkaku/transport'

export type PortOrPromise = MessagePort | Promise<MessagePort>
export type PortInput = PortOrPromise | (() => PortOrPromise)

export async function createTransportStream<R, W>(
  input: PortInput,
): Promise<ReadableWritablePair<R, W>> {
  const port = await Promise.resolve(typeof input === 'function' ? input() : input)

  const readable = new ReadableStream({
    start(controller) {
      port.onmessage = (msg) => {
        controller.enqueue(msg.data)
      }
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

export type MessageTransportParams = {
  port: PortInput
  signal?: AbortSignal
}

export class MessageTransport<R, W> extends Transport<R, W> {
  constructor(params: MessageTransportParams) {
    super({ stream: () => createTransportStream(params.port), signal: params.signal })
  }
}
