'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Banknote, CreditCard, Loader2, Smartphone, CheckCircle2 } from 'lucide-react'
import type { PaymentMethod } from '@/types'

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  menu_item?: { name: string }
}

interface Order {
  id: string
  total: number
  restaurant_id?: string
}

interface Props {
  tableId: string
  tableNum: number
  orders: Order[]
  total: number
  restaurantId: string
  onClose: () => void
  onPaid: () => void
}

const methodLabels: Record<PaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  cash: 'Dinheiro',
}

const methodIcon = (m: PaymentMethod) => {
  if (m === 'pix') return <Smartphone size={14} />
  if (m === 'cash') return <Banknote size={14} />
  return <CreditCard size={14} />
}

export default function PaymentModal({ tableId, tableNum, orders, total, restaurantId, onClose, onPaid }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [loading, setLoading] = useState(false)

  // Agrega itens de todos os pedidos da mesa
  const allItems = orders
    .flatMap(o => (o as Order & { order_items?: OrderItem[] }).order_items ?? [])
    .reduce<Record<string, { name: string; qty: number; price: number }>>((acc, item) => {
      const name = item.menu_item?.name ?? 'Item'
      if (!acc[name]) acc[name] = { name, qty: 0, price: item.unit_price }
      acc[name].qty += item.quantity
      return acc
    }, {})

  async function handleClose() {
    setLoading(true)

    const payments = orders.map(o => ({
      order_id: o.id,
      restaurant_id: restaurantId,
      method,
      amount: o.total,
    }))

    const res = await fetch('/api/conta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, payments }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Erro' }))
      toast.error('Erro ao fechar conta: ' + data.error)
      return
    }

    toast.success(`Mesa ${tableNum} liberada!`)
    onPaid()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-500" />
            Fechar conta — Mesa {tableNum}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Itens consumidos */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 max-h-52 overflow-y-auto">
            {Object.values(allItems).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">Sem itens</p>
            ) : (
              Object.values(allItems).map(item => (
                <div key={item.name} className="flex justify-between text-sm text-gray-700">
                  <span>{item.qty}× {item.name}</span>
                  <span className="font-medium">{formatCurrency(item.price * item.qty)}</span>
                </div>
              ))
            )}
          </div>

          <Separator />

          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-orange-600">{formatCurrency(total)}</span>
          </div>

          {/* Forma de pagamento */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 whitespace-nowrap">Pagamento</span>
            <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="flex-1 h-9">
                <div className="flex items-center gap-2">
                  {methodIcon(method)}
                  <span className="text-sm">{methodLabels[method]}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(methodLabels) as [PaymentMethod, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleClose}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-5 text-base"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin mr-2" /> Fechando...</>
              : `Fechar conta — ${formatCurrency(total)}`
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
