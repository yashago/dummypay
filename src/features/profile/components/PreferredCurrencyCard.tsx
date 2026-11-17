import { useState } from 'react'
import { toast } from 'sonner'
import { CurrencySelect } from '@/components/shared/CurrencySelect'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { useSetPreferredCurrency } from '@/features/wallets/api'
import { rpcErrorMessage } from '@/lib/errors'
import type { CurrencyCode } from '@/lib/money'

export function PreferredCurrencyCard({ current }: { current: CurrencyCode }) {
  const [selected, setSelected] = useState<CurrencyCode>(current)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const mutation = useSetPreferredCurrency()

  const confirm = async () => {
    try {
      await mutation.mutateAsync(selected)
      toast.success(`Preferred currency changed to ${selected}.`)
    } catch (err) {
      toast.error(rpcErrorMessage(err))
      setSelected(current)
    } finally {
      setConfirmOpen(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferred currency</CardTitle>
        <CardDescription>Money sent to you arrives in this currency.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="flex-1">
            <FieldLabel htmlFor="preferred-currency">Currency</FieldLabel>
            <CurrencySelect id="preferred-currency" value={selected} onChange={setSelected} />
          </Field>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={selected === current || mutation.isPending}
          >
            Change
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change preferred currency to {selected}?</AlertDialogTitle>
            <AlertDialogDescription>
              Future incoming transfers will be credited to your {selected} wallet. If you don't have
              one yet, it will be opened with a balance of 0. Existing balances are not converted and
              no funds are added.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirm()
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Spinner />}
              Confirm change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
