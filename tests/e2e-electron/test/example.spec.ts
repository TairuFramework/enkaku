import { _electron as electron, test } from '@playwright/test'

test('launch app', async () => {
  const electronApp = await electron.launch({ args: ['.vite/build/main.js'] })
  await electronApp.close()
})
