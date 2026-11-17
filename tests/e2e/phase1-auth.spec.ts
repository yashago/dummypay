import { expect, test } from '@playwright/test'
import { deleteUsersByEmail, e2eEmail, TEST_PASSWORD } from './support'

// Sign-up/sign-in are rate-limited per IP, so this flow runs once (desktop only).
test.describe('Phase 1 — registration, profile, sign-out, sign-in', () => {
  const email = e2eEmail()
  test.afterAll(async () => {
    await deleteUsersByEmail([email])
  })

  test('new user gets the ILS welcome credit and can manage their session', async ({ page }) => {
    await page.goto('/register')

    // Client-side validation
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Display name must be at least 2 characters.')).toBeVisible()

    await page.getByLabel('Display name').fill('E2E Tester')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Preferred currency').click()
    await page.getByRole('option', { name: /ILS/ }).click()
    await expect(page.getByText(/welcome credit of ₪13,000\.00/)).toBeVisible()
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    // Dashboard shows the server-granted balance
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Welcome back, E2E Tester.')).toBeVisible()
    await expect(page.getByTestId('wallet-ILS')).toContainText('₪13,000.00')

    // Profile page shows all profile fields
    await page.getByRole('link', { name: 'Profile & Settings' }).click()
    const profile = page.locator('dl')
    await expect(profile).toContainText(email)
    await expect(profile).toContainText('ILS — Israeli Shekel')
    await expect(profile).toContainText('Registered')

    // Edit display name
    await page.getByRole('textbox', { name: 'Display name' }).fill('E2E Renamed')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Display name updated.')).toBeVisible()
    await expect(profile).toContainText('E2E Renamed')

    // Sign out → protected pages redirect to login
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)

    // Wrong password, then correct sign-in
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Incorrect email or password.')).toBeVisible()

    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByTestId('wallet-ILS')).toContainText('₪13,000.00')
  })
})
