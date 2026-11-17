import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { restoreFx, seedFixtureRates, snapshotFx } from '../fixtures/fx'
import { admin, createE2EUser, deleteUsersByEmail, signInViaUi } from './support'

/** Fails on serious/critical WCAG 2.1 A/AA violations; lists them for debugging. */
async function expectAccessible(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(summary, `${name} accessibility violations`).toEqual([])
}

test.describe('Accessibility (axe, WCAG 2.1 AA)', () => {
  let snapshot: Awaited<ReturnType<typeof snapshotFx>>
  let email: string

  test.beforeAll(async () => {
    snapshot = await snapshotFx(admin)
    await seedFixtureRates(admin)
    ;({ email } = await createE2EUser('Access Tester', 'USD'))
  })
  test.afterAll(async () => {
    await restoreFx(admin, snapshot)
    await deleteUsersByEmail([email])
  })

  test('public pages', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expectAccessible(page, 'Login')
    await page.goto('/register')
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    await expectAccessible(page, 'Register')
  })

  test('every signed-in section', async ({ page }) => {
    await signInViaUi(page, email)
    const sections: [string, string][] = [
      ['/', 'Dashboard'],
      ['/wallets', 'Wallets'],
      ['/send', 'Send Money'],
      ['/history', 'Transaction History'],
      ['/cards', 'Payment Cards'],
      ['/bank-accounts', 'Bank Accounts'],
      ['/notifications', 'Notifications'],
      ['/settings', 'Profile & Settings'],
    ]
    for (const [path, heading] of sections) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await expectAccessible(page, heading)
    }
  })
})
