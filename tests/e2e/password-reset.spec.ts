import { expect, test } from '@playwright/test'
import { admin, createE2EUser, deleteUsersByEmail } from './support'

const NEW_PASSWORD = 'Brand-new-pass-456!'

test.describe('Password reset', () => {
  let email: string
  test.beforeAll(async () => {
    ;({ email } = await createE2EUser('Forgetful User', 'USD'))
  })
  test.afterAll(async () => {
    await deleteUsersByEmail([email])
  })

  test('"Forgot password?" sends a reset email without revealing whether the account exists', async ({ page }) => {
    // Don't send real email (and don't spend the Auth email rate limit).
    let recoverRequested = false
    await page.route('**/auth/v1/recover**', async (route) => {
      recoverRequested = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await page.goto('/login')
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()

    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByTestId('reset-sent')).toContainText(`If an account exists for ${email}`)
    expect(recoverRequested).toBe(true)
  })

  test('the emailed link lets the user set a new password and sign in with it', async ({ page, baseURL }) => {
    // Same link Supabase would email.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${baseURL}/reset-password` },
    })
    expect(error).toBeNull()

    await page.goto(data.properties!.action_link)
    await expect(page).toHaveURL(/\/reset-password/)
    await expect(page.getByText(`Resetting the password for ${email}.`)).toBeVisible()

    await page.getByLabel('New password', { exact: true }).fill('short')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible()

    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByLabel('Confirm new password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    // Sign out and back in with the new password.
    await page.getByRole('button', { name: /Account menu/ }).first().click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('opening /reset-password without a valid link explains what to do', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByText('This link is invalid or has expired.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
  })
})
