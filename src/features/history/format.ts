import { formatMoney } from '@/lib/money'
import type { HistoryRow } from './api'

export function transactionTitle(t: HistoryRow): string {
  if (t.type === 'initial_grant') return 'Welcome credit'
  return t.direction === 'sent' ? `To ${t.recipient_display_name}` : `From ${t.sender_display_name}`
}

/** Amount from the viewer's side: what left their wallet, or what arrived in it. */
export function signedAmount(t: HistoryRow): { text: string; positive: boolean } {
  if (t.direction === 'sent') {
    return { text: `−${formatMoney(t.sending_amount_minor!, t.sending_currency!)}`, positive: false }
  }
  return { text: `+${formatMoney(t.receiving_amount_minor!, t.receiving_currency!)}`, positive: true }
}
