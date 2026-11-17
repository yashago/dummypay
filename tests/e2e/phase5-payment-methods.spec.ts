import { expect, test } from '@playwright/test'
import { admin, createE2EUser, deleteUsersByEmail, signInViaUi } from './support'

test.describe('Phase 5 — simulated cards & bank accounts', () => {
  let email: string
  test.beforeAll(async () => {
    ;({ email } = await createE2EUser('Card Tester', 'GBP'))
  })
  test.afterAll(async () => {
    await deleteUsersByEmail([email])
  })

  test('adds, validates and removes cards and bank accounts', async ({ page }) => {
    await signInViaUi(page, email)

    // ---- Cards
    await page.getByRole('link', { name: 'Payment Cards' }).click()
    await expect(page.getByText('No cards yet')).toBeVisible()
    await expect(page.getByText(/not been verified by a financial institution/)).toBeVisible()

    await page.getByRole('button', { name: 'Add card' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Cardholder name').fill('Card Tester')
    await dialog.getByLabel('Card number').fill('4242424242424241')
    await expect(dialog.getByLabel('Card number')).toHaveValue('4242 4242 4242 4241')
    await dialog.getByLabel('Expiry (MM/YY)').fill('0120')
    await dialog.getByLabel('CVV').fill('12')
    await dialog.getByRole('button', { name: 'Add card' }).click()
    await expect(dialog.getByText('Card number is not valid (checksum failed).')).toBeVisible()
    await expect(dialog.getByText('This card has expired.')).toBeVisible()
    await expect(dialog.getByText('CVV must be 3 digits.')).toBeVisible()

    await dialog.getByLabel('Card number').fill('5555555555554444')
    await dialog.getByLabel('Expiry (MM/YY)').fill('1230')
    await dialog.getByLabel('CVV').fill('123')
    await dialog.getByRole('button', { name: 'Add card' }).click()
    await expect(page.getByText('Simulated card added.')).toBeVisible()

    const card = page.getByTestId('card-item')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('Mastercard')
    await expect(card).toContainText('•••• •••• •••• 4444')
    await expect(card).toContainText('Exp 12/30')
    await expect(card).toContainText('Simulated')

    // Database holds no full number.
    const { data: rows } = await admin.from('payment_cards').select('*').eq('cardholder_name', 'Card Tester')
    expect(JSON.stringify(rows)).not.toContain('5555555555554444')

    await card.getByRole('button', { name: /Remove card ending in 4444/ }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText('No cards yet')).toBeVisible()

    // ---- Bank accounts
    await page.getByRole('link', { name: 'Bank Accounts' }).click()
    await expect(page.getByText('No bank accounts yet')).toBeVisible()
    await page.getByRole('button', { name: 'Add bank account' }).click()
    const bank = page.getByRole('dialog')
    await bank.getByLabel('Account holder name').fill('Card Tester')
    await bank.getByLabel('Bank name').fill('Barclays')
    await bank.getByLabel('Country').click()
    await page.getByRole('option', { name: 'United Kingdom' }).click()
    await bank.getByLabel('Currency').click()
    await page.getByRole('option', { name: 'GBP' }).click()
    await bank.getByLabel('IBAN or account number').fill('GB82 WEST 1234 5698 7654 33')
    await bank.getByRole('button', { name: 'Add bank account' }).click()
    await expect(bank.getByText('IBAN is not valid (checksum failed).')).toBeVisible()

    await bank.getByLabel('IBAN or account number').fill('GB82 WEST 1234 5698 7654 32')
    await bank.getByRole('button', { name: 'Add bank account' }).click()
    await expect(page.getByText('Simulated bank account added.')).toBeVisible()

    const account = page.getByTestId('bank-account-item')
    await expect(account).toContainText('Barclays')
    await expect(account).toContainText('United Kingdom · GBP')
    await expect(account).toContainText('IBAN GB•• •••• 5432')
    await expect(account).toContainText('Simulated')

    await account.getByRole('button', { name: /Remove Barclays account/ }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText('No bank accounts yet')).toBeVisible()
  })
})
