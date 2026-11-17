import { FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn('gap-1 border-amber-300 bg-amber-50 text-amber-900', className)}>
      <FlaskConical className="size-3" aria-hidden />
      Simulated
    </Badge>
  )
}
