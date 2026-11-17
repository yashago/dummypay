import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CURRENCY_CODES, CURRENCY_NAMES, type CurrencyCode } from '@/lib/money'

type Props = {
  id?: string
  value: CurrencyCode | undefined
  onChange: (value: CurrencyCode) => void
  options?: readonly CurrencyCode[]
  placeholder?: string
  showName?: boolean
  className?: string
  'aria-label'?: string
}

export function CurrencySelect({
  id,
  value,
  onChange,
  options = CURRENCY_CODES,
  placeholder = 'Currency',
  showName = true,
  className = 'w-full',
  ...rest
}: Props) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CurrencyCode)}>
      <SelectTrigger id={id} className={className} aria-label={rest['aria-label']}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((code) => (
          <SelectItem key={code} value={code}>
            {showName ? `${code} — ${CURRENCY_NAMES[code]}` : code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
