import { expect, test } from '@playwright/test'
import { createE2EUser, deleteUsersByEmail, signInViaUi } from './support'

// Runs only in the "mobile" project (see playwright.config.ts).
test.describe('Mobile layout', () => {
  let email: string
  test.beforeAll(async () => {
    ;({ email } = await createE2EUser('Mobile Tester', 'EUR'))
  })
  test.afterAll(async () => {
    await deleteUsersByEmail([email])
  })

  test('every section fits the viewport and is reachable from the menu', async ({ page }) => {
    await signInViaUi(page, email)

    const sections = [
      'Dashboard',
      'Wallets',
      'Send Money',
      'Transaction History',
      'Payment Cards',
      'Bank Accounts',
      'Notifications',
      'Profile & Settings',
    ]
    for (const name of sections) {
      await page.getByRole('button', { name: 'Open navigation' }).click()
      await page.getByRole('dialog').getByRole('link', { name }).click()
      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${name} scrolls horizontally`).toBeLessThanOrEqual(0)
    }
  })
})
