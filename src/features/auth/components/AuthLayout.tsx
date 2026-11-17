import type { ReactNode } from 'react'
import { SimulatedBanner } from '@/components/shared/SimulatedBanner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { title: string; description: string; children: ReactNode; footer: ReactNode }

export function AuthLayout({ title, description, children, footer }: Props) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <SimulatedBanner />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
              D
            </div>
            <span className="text-xl font-semibold tracking-tight">DummyPay</span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
          <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    </div>
  )
}
