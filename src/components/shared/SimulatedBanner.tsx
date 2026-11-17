import { FlaskConical } from 'lucide-react'

/** Persistent notice that the platform is simulated (spec §1, §10). */
export function SimulatedBanner() {
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      Simulated platform — all balances are fictional. No real money is moved.
    </div>
  )
}
