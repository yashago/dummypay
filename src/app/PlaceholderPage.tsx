import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'

/** Temporary page for sections not yet built; replaced phase by phase. */
export function PlaceholderPage({ title, phase }: { title: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title="Not built yet"
        description={`This section is scheduled for implementation phase ${phase}.`}
      />
    </>
  )
}
