import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { AuthContext } from '@/features/auth/context'
import type { Notification } from '@/features/notifications/api'
import { IncomingPaymentDialog } from '@/features/notifications/components/IncomingPaymentDialog'
import { NotificationItem } from '@/features/notifications/components/NotificationItem'

const n: Notification = {
  id: 'n1',
  user_id: 'bob',
  transaction_id: 't1',
  kind: 'payment_received',
  title: 'Payment received',
  message: 'Alice Sender (alice@example.com) sent you $27.03.',
  sender_display_name: 'Alice Sender',
  sender_email: 'alice@example.com',
  amount_minor: 2_703,
  currency: 'USD',
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
}

function Providers({ children }: { children: ReactNode }) {
  const session = { user: { id: 'bob' } } as never
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={{ session, loading: false }}>
        <MemoryRouter>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

describe('IncomingPaymentDialog', () => {
  it("shows the sender's name and email and the amount with currency", () => {
    render(<IncomingPaymentDialog notification={n} remaining={0} onClose={vi.fn()} />, { wrapper: Providers })
    const dialog = screen.getByTestId('incoming-payment')
    expect(dialog).toHaveTextContent('Payment received')
    expect(dialog).toHaveTextContent('Alice Sender (alice@example.com) sent you')
    expect(screen.getByTestId('incoming-amount')).toHaveTextContent('$27.03')
    expect(dialog).toHaveTextContent('Credited to your USD wallet')
  })

  it('mentions queued payments and closes on demand', async () => {
    const onClose = vi.fn()
    render(<IncomingPaymentDialog notification={n} remaining={2} onClose={onClose} />, { wrapper: Providers })
    expect(screen.getByText('+2 more payments')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'View transaction' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing without a notification', () => {
    render(<IncomingPaymentDialog notification={null} remaining={0} onClose={vi.fn()} />, { wrapper: Providers })
    expect(screen.queryByTestId('incoming-payment')).not.toBeInTheDocument()
  })
})

describe('NotificationItem', () => {
  it('marks unread items and offers "Mark read"', async () => {
    const onMarkRead = vi.fn()
    render(
      <ul>
        <NotificationItem n={n} onMarkRead={onMarkRead} />
      </ul>,
    )
    expect(screen.getByText('Unread')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /Mark read/ }))
    expect(onMarkRead).toHaveBeenCalledWith('n1')
  })

  it('hides the action once read', () => {
    render(
      <ul>
        <NotificationItem n={{ ...n, is_read: true }} onMarkRead={vi.fn()} />
      </ul>,
    )
    expect(screen.queryByRole('button', { name: /Mark read/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Unread')).not.toBeInTheDocument()
  })
})
