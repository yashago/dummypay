import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

type Option<T extends string> = { value: T; label: string }
type Props<T extends string> = {
  label: string
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  className?: string
}

/**
 * Single-choice switch (radio group semantics) styled like tabs. Use it for
 * filters/modes where there are no separate tab panels. Arrow keys move the
 * selection, as with native radio buttons.
 */
export function SegmentedControl<T extends string>({ label, value, onChange, options, className }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-lg bg-muted p-[3px] text-muted-foreground', className)}
    >
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'flex-1 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              selected ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
