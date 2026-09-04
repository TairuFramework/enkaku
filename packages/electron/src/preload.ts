import { contextBridge, ipcRenderer } from 'electron'

import type { MessageFunc } from './types.js'

async function createProcess<R, W>(
  name: string,
  onMessage: MessageFunc<R>,
): Promise<MessageFunc<W>> {
  const port = await new Promise<MessagePort>((resolve, reject) => {
    ipcRenderer.once(`enkaku:process/${name}/port`, (event) => {
      const port = event.ports[0]
      if (port == null) {
        reject(new Error(`No port received for process: ${name}`))
      } else {
        resolve(port)
      }
    })
    ipcRenderer.send(`enkaku:process/${name}/create`)
  })

  port.addEventListener('message', (msg) => {
    onMessage(msg.data)
  })
  port.start()

  return (message: W) => {
    port.postMessage(message)
  }
}

contextBridge.exposeInMainWorld('Enkaku', { createProcess })
