import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HistoryRow } from '@/features/history/api'
import { signedAmount, transactionTitle } from '@/features/history/format'
import type { Quote } from '@/features/transfers/api'
import { ReviewStep } from '@/features/transfers/components/ReviewStep'
import { rpcErrorMessage } from '@/lib/errors'

const baseQuote: Quote = {
  quote_id: 'q-1',
  recipient_user_id: 'bob',
  recipient_display_name: 'Bob Receiver',
  recipient_email: 'bob@example.com',
  sending_currency: 'ILS',
  receiving_currency: 'USD',
  sending_amount_minor: 37_000,
  receiving_amount_minor: 10_000,
  amount_input_side: 'receive',
  exchange_rate: 0.2702702703,
  rate_provider_updated_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 60_000).toISOString(),
}

function renderReview(quote: Partial<Quote> = {}, props: Partial<Parameters<typeof ReviewStep>[0]> = {}) {
  const onConfirm = vi.fn()
  render(
    <ReviewStep
      quote={{ ...baseQuote, ...quote }}
      sender={{ displayName: 'Alice Sender', email: 'alice@example.com' }}
      executing={false}
      error={null}
      refreshing={false}
      onConfirm={onConfirm}
      onRefresh={vi.fn()}
      onBack={vi.fn()}
      {...props}
    />,
  )
  return { onConfirm }
}

describe('ReviewStep (transfer summary)', () => {
  it('shows sender, recipient, amounts, currencies and the exchange rate', () => {
    renderReview()
    const summary = screen.getByTestId('transfer-summary')
    expect(summary).toHaveTextContent('Alice Sender')
    expect(summary).toHaveTextContent('Bob Receiver')
    expect(screen.getByTestId('summary-send')).toHaveTextContent('₪370.00')
    expect(screen.getByTestId('summary-receive')).toHaveTextContent('$100.00')
    expect(screen.getByTestId('summary-rate')).toHaveTextContent('1 ILS = 0.27027 USD')
    expect(screen.getByText(/Quote valid for \d+s/)).toBeInTheDocument()
  })

  it('requires an explicit confirmation before sending', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderReview()
    await user.click(screen.getByRole('button', { name: 'Confirm & send' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Send ₪370.00 to Bob Receiver?')
    await user.click(screen.getByRole('button', { name: 'Send now' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('labels same-currency transfers as no conversion', () => {
    renderReview({ sending_currency: 'USD', exchange_rate: 1 })
    expect(screen.getByTestId('summary-rate')).toHaveTextContent('No conversion (same currency)')
  })

  it('blocks confirmation once the quote has expired', () => {
    renderReview({ expires_at: new Date(Date.now() - 1000).toISOString() })
    expect(screen.getByRole('button', { name: 'Confirm & send' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Get new quote/ })).toBeEnabled()
  })

  it('treats a server QUOTE_EXPIRED error as expired', () => {
    renderReview({}, { error: { message: 'QUOTE_EXPIRED: the quote has expired' } })
    expect(screen.getByRole('button', { name: 'Confirm & send' })).toBeDisabled()
  })

  it('reassures the user that a network retry is safe', () => {
    renderReview({}, { error: new TypeError('Failed to fetch') })
    expect(screen.getByRole('alert')).toHaveTextContent('you will not be charged twice')
  })
})

describe('history formatting', () => {
  const row = (over: Partial<HistoryRow>): HistoryRow =>
    ({
      type: 'transfer',
      direction: 'sent',
      sender_display_name: 'Alice',
      recipient_display_name: 'Bob',
      sending_amount_minor: 37_000,
      sending_currency: 'ILS',
      receiving_amount_minor: 10_000,
      receiving_currency: 'USD',
      ...over,
    }) as HistoryRow

  it('describes sent, received and welcome-credit rows from the viewer’s side', () => {
    expect(transactionTitle(row({}))).toBe('To Bob')
    expect(signedAmount(row({}))).toEqual({ text: '−₪370.00', positive: false })
    expect(transactionTitle(row({ direction: 'received' }))).toBe('From Alice')
    expect(signedAmount(row({ direction: 'received' }))).toEqual({ text: '+$100.00', positive: true })
    expect(transactionTitle(row({ type: 'initial_grant', direction: 'received' }))).toBe('Welcome credit')
  })
})

describe('error messages', () => {
  it('uses the exact spec wording for unknown recipients', () => {
    expect(rpcErrorMessage({ message: 'RECIPIENT_NOT_FOUND' })).toBe(
      'No registered user found with this email address.',
    )
  })

  it('maps transfer failures to friendly text and hides unknown errors', () => {
    expect(rpcErrorMessage({ message: 'INSUFFICIENT_FUNDS' })).toMatch(/Insufficient funds/)
    expect(rpcErrorMessage({ message: 'QUOTE_EXPIRED: x' })).toMatch(/expired/)
    expect(rpcErrorMessage({ message: 'duplicate key value violates unique constraint' })).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
