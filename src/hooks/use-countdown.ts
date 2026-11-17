import { useEffect, useState } from 'react'

function secondsUntil(deadline: string | null | undefined): number {
  return deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 1000)) : 0
}

/** Seconds remaining until `deadline` (ISO string), updated every second. */
export function useCountdown(deadline: string | null | undefined): number {
  const [state, setState] = useState(() => ({ deadline, remaining: secondsUntil(deadline) }))

  // Reset immediately when the deadline changes (e.g. a refreshed quote).
  if (state.deadline !== deadline) setState({ deadline, remaining: secondsUntil(deadline) })

  useEffect(() => {
    if (!deadline) return
    const id = setInterval(() => setState({ deadline, remaining: secondsUntil(deadline) }), 1000)
    return () => clearInterval(id)
  }, [deadline])

  return state.deadline === deadline ? state.remaining : secondsUntil(deadline)
}
