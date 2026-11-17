import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppLayout } from '@/app/AppLayout'
import { NAV_ITEMS } from '@/app/nav'

// The account menu needs an auth session; it's covered by the E2E tests.
vi.mock('@/app/UserMenu', () => ({ UserMenu: () => null }))
vi.mock('@/app/UnreadBadge', () => ({ UnreadBadge: () => null }))
vi.mock('@/features/notifications/RealtimeListener', () => ({ RealtimeListener: () => null }))

function renderShell() {
  const router = createMemoryRouter([
    { element: <AppLayout />, children: [{ index: true, element: <p>home</p> }] },
  ])
  return render(<RouterProvider router={router} />)
}

describe('App shell', () => {
  it('exposes all eight main sections from the spec', () => {
    renderShell()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const item of NAV_ITEMS) {
      expect(nav).toHaveTextContent(item.label)
    }
    expect(NAV_ITEMS).toHaveLength(8)
  })

  it('clearly identifies the platform as simulated', () => {
    renderShell()
    expect(screen.getByRole('note')).toHaveTextContent(/simulated platform/i)
  })
})
