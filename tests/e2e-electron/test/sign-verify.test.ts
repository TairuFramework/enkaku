import { existsSync } from 'node:fs'
import { napiBindingPath } from '@kokuin/crypto-napi'
import { _electron as electron, test } from '@playwright/test'

import { productName } from '../package.json'

function getAppPath() {
  switch (process.platform) {
    case 'darwin':
      return `out/${productName}-darwin-${process.arch}/${productName}.app/Contents/MacOS/${productName}`
    case 'linux':
      return `out/${productName}-linux-${process.arch}/${productName}`
    case 'win32':
      return `out/${productName}-win32-${process.arch}/${productName}.exe`
    default:
      throw new Error(`Unsupported platform: ${process.platform}`)
  }
}

const executablePath = getAppPath()

test('sign and verify token', async () => {
  const app = await electron.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  // Native whenever the installed package carries a binary for this platform.
  const backend = existsSync(napiBindingPath()) ? 'napi' : 'node'
  await page.getByText(`Crypto backend: ${backend}`).waitFor()
  await page.getByText('Sign token').click()
  await page.getByText('Verify token').click()
  await page.getByText('Verified token: OK').waitFor()
  await app.close()
})
