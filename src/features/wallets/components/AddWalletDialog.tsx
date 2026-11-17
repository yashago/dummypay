import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CurrencySelect } from '@/components/shared/CurrencySelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { rpcErrorMessage } from '@/lib/errors'
import { CURRENCY_CODES, type CurrencyCode } from '@/lib/money'
import { useAddWallet } from '../api'

export function AddWalletDialog({ existing }: { existing: CurrencyCode[] }) {
  const available = CURRENCY_CODES.filter((c) => !existing.includes(c))
  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState<CurrencyCode | undefined>()
  const addWallet = useAddWallet()

  const submit = async () => {
    if (!currency) return
    try {
      await addWallet.mutateAsync(currency)
      toast.success(`${currency} wallet added.`)
      setOpen(false)
      setCurrency(undefined)
    } catch (err) {
      toast.error(rpcErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={available.length === 0}>
          <Plus /> Add wallet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a currency wallet</DialogTitle>
          <DialogDescription>
            New wallets start with a balance of 0. Funds arrive through transfers from other users.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="new-wallet-currency">Currency</FieldLabel>
          <CurrencySelect
            id="new-wallet-currency"
            value={currency}
            onChange={setCurrency}
            options={available}
            placeholder="Select a currency"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!currency || addWallet.isPending}>
            {addWallet.isPending && <Spinner />}
            Add wallet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
