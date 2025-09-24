import { test } from '@playwright/test'

test('sign and verify token', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Sign token').click()
  await page.getByText('Verify token').click()
  await page.getByText('Verified token: OK').waitFor()
})
