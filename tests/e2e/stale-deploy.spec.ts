import { expect, test } from '@playwright/test'
import { createE2EUser, deleteUsersByEmail, signInViaUi } from './support'

/**
 * Reproduces a tab that was opened before a new deployment: the page's code
 * chunk it asks for no longer exists (404). Matches both the hashed production
 * file (NotificationsPage-<hash>.js) and the dev-server module.
 */
const NOTIFICATIONS_CHUNK = /NotificationsPage[^/]*\.(js|tsx)(\?.*)?$/

test.describe('Stale deployment recovery', () => {
  let email: string
  test.beforeAll(async () => {
    ;({ email } = await createE2EUser('Stale Tab', 'USD'))
  })
  test.afterAll(async () => {
    await deleteUsersByEmail([email])
  })

  test('a missing page chunk triggers one reload, then the page works', async ({ page }) => {
    await signInViaUi(page, email)

    let blocked = 0
    await page.route(NOTIFICATIONS_CHUNK, async (route) => {
      if (blocked++ === 0) return route.fulfill({ status: 404, body: 'Not found' })
      return route.continue()
    })
    let reloads = 0
    page.on('load', () => reloads++)

    await page.getByRole('link', { name: 'Notifications' }).first().click()
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Unexpected Application Error')).toHaveCount(0)
    expect(blocked).toBeGreaterThanOrEqual(2) // failed once, loaded after the reload
    expect(reloads).toBe(1)
  })

  test('if the chunk keeps failing, a friendly error page offers a reload instead of crashing', async ({ page }) => {
    await signInViaUi(page, email)
    await page.route(NOTIFICATIONS_CHUNK, (route) => route.fulfill({ status: 404, body: 'Not found' }))

    await page.getByRole('link', { name: 'Notifications' }).first().click()
    const error = page.getByTestId('route-error')
    await expect(error).toBeVisible({ timeout: 15_000 })
    await expect(error).toContainText('DummyPay has been updated')
    await expect(error.getByRole('button', { name: 'Reload' })).toBeVisible()
    await expect(error.getByRole('button', { name: 'Go to dashboard' })).toBeVisible()
    await expect(page.getByText('Unexpected Application Error')).toHaveCount(0)
  })
})
