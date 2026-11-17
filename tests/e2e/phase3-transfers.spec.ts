import { expect, test } from '@playwright/test'
import { restoreFx, seedFixtureRates, snapshotFx } from '../fixtures/fx'
import { admin, createE2EUser, deleteUsersByEmail, e2eEmail, signInViaUi } from './support'

test.describe('Phase 3 — send money & transaction history', () => {
  let snapshot: Awaited<ReturnType<typeof snapshotFx>>
  let alice: { email: string }
  let bob: { email: string }

  test.beforeAll(async () => {
    snapshot = await snapshotFx(admin)
    await seedFixtureRates(admin)
    ;[alice, bob] = await Promise.all([
      createE2EUser('Alice Sender', 'ILS'),
      createE2EUser('Bob Receiver', 'USD'),
    ])
  })

  test.afterAll(async () => {
    await restoreFx(admin, snapshot)
    await deleteUsersByEmail([alice.email, bob.email])
  })

  test('sender pays ₪370.00 so the recipient gets exactly $100.00, and both histories show it', async ({
    page,
    browser,
  }) => {
    await signInViaUi(page, alice.email)
    await page.getByRole('link', { name: 'Send Money' }).first().click()

    // Recipient validation
    const email = page.getByLabel("Recipient's email")
    await email.fill(e2eEmail())
    await page.getByRole('button', { name: 'Find recipient' }).click()
    await expect(page.getByText('No registered user found with this email address.')).toBeVisible()

    await email.fill(alice.email)
    await page.getByRole('button', { name: 'Find recipient' }).click()
    await expect(page.getByText('You cannot send money to yourself.')).toBeVisible()

    await email.fill(bob.email.toUpperCase())
    await page.getByRole('button', { name: 'Find recipient' }).click()
    const card = page.getByTestId('recipient-card')
    await expect(card).toContainText('Bob Receiver')
    await expect(card).toContainText(bob.email)
    await expect(card).toContainText('USD')
    await card.getByRole('button', { name: 'Continue' }).click()

    // Amount: "Recipient gets $100"
    await page.getByRole('tab', { name: 'Recipient gets' }).click()
    await page.getByLabel(/Amount they receive \(USD\)/).fill('100')
    await page.getByRole('button', { name: 'Review transfer' }).click()

    // Summary
    await expect(page.getByTestId('summary-send')).toHaveText('₪370.00')
    await expect(page.getByTestId('summary-receive')).toHaveText('$100.00')
    await expect(page.getByTestId('summary-rate')).toHaveText('1 ILS = 0.27027 USD')
    await expect(page.getByTestId('transfer-summary')).toContainText('Alice Sender')

    // Explicit confirmation
    await page.getByRole('button', { name: 'Confirm & send' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Send ₪370.00 to Bob Receiver?')
    await page.getByRole('button', { name: 'Send now' }).click()
    await expect(page.getByTestId('transfer-success')).toContainText('Transfer complete')

    // Sender's balance + history
    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByTestId('wallet-ILS')).toContainText('₪12,630.00')
    await expect(page.getByTestId('recent-transactions')).toContainText('To Bob Receiver')

    await page.getByRole('link', { name: 'Transaction History' }).click()
    const rows = page.getByTestId('transaction-row')
    await expect(rows).toHaveCount(2) // transfer + welcome credit
    await rows.first().click()
    const detail = page.getByTestId('transaction-detail')
    await expect(detail).toContainText('Sent')
    await expect(detail).toContainText('1 ILS = 0.27027 USD')
    await expect(detail).toContainText('$100.00 (USD)')
    await expect(detail).toContainText('completed')
    await page.keyboard.press('Escape')

    // Filters
    await page.getByLabel('Type').click()
    await page.getByRole('option', { name: 'Received' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Welcome credit')
    await page.getByRole('button', { name: 'Clear' }).click()
    await page.getByLabel('Currency').click()
    await page.getByRole('option', { name: 'USD' }).click()
    await expect(page.getByText('No matching transactions')).toBeVisible()

    // Recipient sees the credit
    const bobContext = await browser.newContext()
    const bobPage = await bobContext.newPage()
    await signInViaUi(bobPage, bob.email)
    await expect(bobPage.getByTestId('wallet-USD')).toContainText('$5,100.00')
    await expect(bobPage.getByTestId('recent-transactions')).toContainText('From Alice Sender')
    await bobContext.close()
  })
})
