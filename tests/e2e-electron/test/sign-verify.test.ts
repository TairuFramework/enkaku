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
  const app = await electron.launch({ executablePath })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.getByText('Sign token').click()
  await page.getByText('Verify token').click()
  await page.getByText('Verified token: OK').waitFor()
  await app.close()
})
