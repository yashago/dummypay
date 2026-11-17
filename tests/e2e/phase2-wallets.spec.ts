import { expect, test } from '@playwright/test'
import { restoreFx, seedFixtureRates, snapshotFx } from '../fixtures/fx'
import { admin, createE2EUser, deleteUsersByEmail, signInViaUi } from './support'

test.describe('Phase 2 — wallets, rates, conversion preview, preferred currency', () => {
  test.skip(({ isMobile }) => isMobile, 'runs on desktop only to respect auth rate limits')

  let snapshot: Awaited<ReturnType<typeof snapshotFx>>
  let email: string

  test.beforeAll(async () => {
    snapshot = await snapshotFx(admin)
    await seedFixtureRates(admin)
    ;({ email } = await createE2EUser('Wallet Tester', 'ILS'))
  })

  test.afterAll(async () => {
    await restoreFx(admin, snapshot)
    await deleteUsersByEmail([email])
  })

  test('manages wallets and previews conversions with server-side rates', async ({ page }) => {
    await signInViaUi(page, email)

    // Dashboard: total balance + rates with last-updated timestamp
    await expect(page.getByTestId('total-balance')).toContainText('₪13,000.00')
    const rates = page.getByTestId('rates-card')
    await expect(rates).toContainText('Last updated')
    await expect(page.getByTestId('rate-ILS-USD')).toHaveText('0.27027')

    // Wallets: add a EUR wallet (starts at 0)
    await page.getByRole('link', { name: 'Wallets' }).click()
    await page.getByRole('button', { name: 'Add wallet' }).click()
    await page.getByRole('dialog').getByLabel('Currency').click()
    await page.getByRole('option', { name: /EUR/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Add wallet' }).click()
    await expect(page.getByText('EUR wallet added.')).toBeVisible()
    await expect(page.getByTestId('wallet-EUR')).toContainText('€0.00')
    await expect(page.getByTestId('wallet-ILS')).toContainText('₪13,000.00')
    await expect(page.getByTestId('total-balance')).toContainText('≈ ₪13,000.00')

    // Conversion preview (computed by the server): ₪100 → $27.03
    const preview = page.getByTestId('conversion-preview')
    await expect(preview.getByTestId('conversion-result')).toHaveText('$27.03')
    await preview.getByLabel('Amount').fill('1.234')
    await expect(preview.getByText('Use at most 2 decimal places.')).toBeVisible()
    await preview.getByLabel('Amount').fill('250')
    await expect(preview.getByTestId('conversion-result')).toHaveText('$67.57')

    // Settings: change preferred currency (confirmation required; no funds granted)
    await page.getByRole('link', { name: 'Profile & Settings' }).click()
    await page.getByLabel('Currency', { exact: true }).click()
    await page.getByRole('option', { name: /GBP/ }).click()
    await page.getByRole('button', { name: 'Change' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('no funds are added')
    await page.getByRole('button', { name: 'Confirm change' }).click()
    await expect(page.getByText('Preferred currency changed to GBP.')).toBeVisible()
    await expect(page.locator('dl')).toContainText('GBP — British Pound')

    await page.getByRole('link', { name: 'Wallets' }).click()
    await expect(page.getByTestId('wallet-GBP')).toContainText('£0.00')
    // ₪13,000 × 0.8 / 3.7 = £2,810.81
    await expect(page.getByTestId('total-balance')).toContainText('≈ £2,810.81')
  })
})
