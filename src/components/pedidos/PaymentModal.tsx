'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Banknote, CreditCard, Smartphone, Users } from 'lucide-react'
import type { PaymentMethod } from '@/types'

interface PersonPayment {
  name: string
  amount: number
  method: PaymentMethod
}

interface Props {
  orderId: string
  restaurantId: string
  total: number
  onClose: () => void
  onPaid: () => void
}

export default function PaymentModal({ orderId, restaurantId, total, onClose, onPaid }: Props) {
  const [splitCount, setSplitCount] = useState(1)
  const [persons, setPersons] = useState<PersonPayment[]>([
    { name: '', amount: total, method: 'pix' },
  ])
  const [loading, setLoading] = useState(false)

  function updateSplit(count: number) {
    const n = Math.max(1, count)
    setSplitCount(n)
    const perPerson = Math.floor((total / n) * 100) / 100
    const remainder = Math.round((total - perPerson * n) * 100) / 100
    const newPersons: PersonPayment[] = Array.from({ length: n }, (_, i) => ({
      name: persons[i]?.name ?? '',
      amount: i === 0 ? perPerson + remainder : perPerson,
      method: persons[i]?.method ?? 'pix',
    }))
    setPersons(newPersons)
  }

  function updatePerson(index: number, field: keyof PersonPayment, value: string | number) {
    setPersons(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  async function handlePay() {
    const sumAmounts = persons.reduce((s, p) => s + p.amount, 0)
    if (Math.abs(sumAmounts - total) > 0.01) {
      toast.error('A soma dos valores não bate com o total')
      return
    }

    setLoading(true)
    const supabase = createClient()

    for (const person of persons) {
      await supabase.from('payments').insert({
        restaurant_id: restaurantId,
        order_id: orderId,
        method: person.method,
        amount: person.amount,
        status: 'approved',
        installments: 1,
      })
    }

    await supabase.from('orders').update({ payment_status: 'paid', status: 'closed' }).eq('id', orderId)
    toast.success('Pagamento registrado!')
    setLoading(false)
    onPaid()
  }

  const methodIcons: Record<PaymentMethod, React.ReactNode> = {
    pix: <Smartphone size={14} />,
    credit_card: <CreditCard size={14} />,
    debit_card: <CreditCard size={14} />,
    cash: <Banknote size={14} />,
  }

  const methodLabels: Record<PaymentMethod, string> = {
    pix: 'PIX',
    credit_card: 'Crédito',
    debit_card: 'Débito',
    cash: 'Dinheiro',
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento — {formatCurrency(total)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-gray-500" />
            <Label>Dividir entre</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={splitCount}
              onChange={e => updateSplit(parseInt(e.target.value) || 1)}
              className="w-20"
            />
            <span className="text-sm text-gray-500">pessoa(s)</span>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {persons.map((person, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
                    {i + 1}
                  </div>
                  <Input
                    placeholder="Nome (opcional)"
                    value={person.name}
                    onChange={e => updatePerson(i, 'name', e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={person.amount}
                    onChange={e => updatePerson(i, 'amount', parseFloat(e.target.value) || 0)}
                    className="flex-1 h-8 text-sm"
                    step="0.01"
                  />
                  <Select
                    value={person.method}
                    onValueChange={v => updatePerson(i, 'method', v as PaymentMethod)}
                  >
                    <SelectTrigger className="w-32 h-8 text-sm">
                      <div className="flex items-center gap-1">
                        {methodIcons[person.method]}
                        <span>{methodLabels[person.method]}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(methodLabels) as [PaymentMethod, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm border-t pt-3">
            <span>Total informado</span>
            <span className={Math.abs(persons.reduce((s, p) => s + p.amount, 0) - total) > 0.01 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
              {formatCurrency(persons.reduce((s, p) => s + p.amount, 0))}
            </span>
          </div>

          <Button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-5"
          >
            {loading ? 'Processando...' : `Confirmar pagamento — ${formatCurrency(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
