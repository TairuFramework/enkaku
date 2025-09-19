import path from 'node:path'
import { provideTokenSignerAsync } from '@enkaku/electron-keystore'
import { serveProcess } from '@enkaku/electron-rpc'
import { stringifyToken } from '@enkaku/token'
import { app, BrowserWindow } from 'electron'

import type { Protocol } from './protocol'

serveProcess<Protocol>({
  handlers: {
    sign: async ({ param }) => {
      const signer = await provideTokenSignerAsync('EnkakuKeystore', param.keyID ?? 'test')
      const token = await signer.createToken(param.payload)
      return stringifyToken(token)
    },
  },
})

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
