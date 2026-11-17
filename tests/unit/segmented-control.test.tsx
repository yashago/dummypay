import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { SegmentedControl } from '@/components/shared/SegmentedControl'

function Harness() {
  const [value, setValue] = useState<'send' | 'receive'>('send')
  return (
    <SegmentedControl
      label="Amount is"
      value={value}
      onChange={setValue}
      options={[
        { value: 'send', label: 'I send' },
        { value: 'receive', label: 'Recipient gets' },
      ]}
    />
  )
}

describe('SegmentedControl', () => {
  it('exposes radio-group semantics with one checked option', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'Amount is' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'I send' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Recipient gets' })).toHaveAttribute('aria-checked', 'false')
  })

  it('supports click and arrow-key selection with roving focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: 'Recipient gets' }))
    expect(screen.getByRole('radio', { name: 'Recipient gets' })).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowLeft}')
    const send = screen.getByRole('radio', { name: 'I send' })
    expect(send).toHaveAttribute('aria-checked', 'true')
    expect(send).toHaveFocus()
    expect(send).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Recipient gets' })).toHaveAttribute('tabindex', '-1')
  })
})
