import { expect, test } from '@playwright/test'

test('unauthenticated visitors are sent to sign-in, with the simulated notice visible', async ({
  page,
}) => {
  await page.goto('/wallets')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('note')).toContainText('Simulated platform')
  await expect(page.getByText('Sign in', { exact: true }).first()).toBeVisible()
})
