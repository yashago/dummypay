import { expect, test } from '@playwright/test'
import { restoreFx, seedFixtureRates, snapshotFx } from '../fixtures/fx'
import { admin, createE2EUser, deleteUsersByEmail, signInViaUi } from './support'

test.describe('Phase 4 — real-time incoming payment notifications', () => {
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

  test('recipient sees the popup, new balance and history without reloading', async ({ browser }) => {
    // Bob is already looking at his dashboard.
    const bobContext = await browser.newContext()
    const bobPage = await bobContext.newPage()
    await signInViaUi(bobPage, bob.email)
    await expect(bobPage.getByTestId('wallet-USD')).toContainText('$5,000.00')
    await expect(bobPage.getByTestId('unread-badge')).toHaveCount(0)

    // Alice sends ₪100 from another browser.
    const aliceContext = await browser.newContext()
    const page = await aliceContext.newPage()
    await signInViaUi(page, alice.email)
    await page.getByRole('link', { name: 'Send Money' }).first().click()
    await page.getByLabel("Recipient's email").fill(bob.email)
    await page.getByRole('button', { name: 'Find recipient' }).click()
    await page.getByTestId('recipient-card').getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel(/Amount to send \(ILS\)/).fill('100')
    await page.getByRole('button', { name: 'Review transfer' }).click()
    await page.getByRole('button', { name: 'Confirm & send' }).click()
    await page.getByRole('button', { name: 'Send now' }).click()
    await expect(page.getByTestId('transfer-success')).toBeVisible()

    // Bob: modal with sender name + email + amount, live balance, history, badge.
    const popup = bobPage.getByTestId('incoming-payment')
    await expect(popup).toBeVisible({ timeout: 15_000 })
    await expect(popup).toContainText(`Alice Sender (${alice.email}) sent you`)
    await expect(popup.getByTestId('incoming-amount')).toHaveText('$27.03')
    await expect(bobPage.getByTestId('wallet-USD')).toContainText('$5,027.03')
    await expect(bobPage.getByTestId('recent-transactions')).toContainText('From Alice Sender')
    await expect(bobPage.getByTestId('unread-badge').first()).toContainText('1')

    await popup.getByRole('button', { name: 'Mark as read' }).click()
    await expect(popup).toBeHidden()
    await expect(bobPage.getByTestId('unread-badge')).toHaveCount(0)

    // Notification centre keeps the history.
    await bobPage.getByRole('link', { name: 'Notifications' }).click()
    const item = bobPage.getByTestId('notification-item')
    await expect(item).toHaveCount(1)
    await expect(item).toContainText(`Alice Sender (${alice.email}) sent you $27.03.`)
    await expect(item).toHaveAttribute('data-read', 'true')

    // The sender got no notification.
    await page.getByRole('link', { name: 'Notifications' }).click()
    await expect(page.getByText('No notifications yet')).toBeVisible()

    await Promise.all([bobContext.close(), aliceContext.close()])
  })
})
