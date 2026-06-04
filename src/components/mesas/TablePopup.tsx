'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { getTableColor } from '@/types'
import type { Table, OrderStatus } from '@/types'
import { toast } from 'sonner'
import PaymentModal from '@/components/pedidos/PaymentModal'

interface Props {
  table: Table
  onClose: () => void
  onUpdate: (t: Table) => void
}

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'open', label: 'Aberto' },
  { value: 'preparing', label: 'Preparando' },
  { value: 'served', label: 'Servido' },
  { value: 'closed', label: 'Fechado' },
]

export default function TablePopup({ table, onClose, onUpdate }: Props) {
  const colors = getTableColor(table)
  const order = table.current_order
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(order?.status ?? 'open')
  const [showPayment, setShowPayment] = useState(false)
  const supabase = createClient()

  async function updateOrderStatus(status: OrderStatus) {
    if (!order) return
    await supabase.from('orders').update({ status }).eq('id', order.id)
    setOrderStatus(status)
    if (status === 'closed') {
      await supabase.from('tables').update({ status: 'empty' }).eq('id', table.id)
      onUpdate({ ...table, status: 'empty', current_order: null })
      toast.success('Mesa liberada!')
      onClose()
    } else {
      toast.success('Status atualizado')
    }
  }

  async function clearTable() {
    await supabase.from('tables').update({ status: 'empty' }).eq('id', table.id)
    if (order) await supabase.from('orders').update({ status: 'closed' }).eq('id', order.id)
    onUpdate({ ...table, status: 'empty', current_order: null })
    toast.success('Mesa liberada')
    onClose()
  }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${colors.bg} border ${colors.border}`} />
              Mesa {table.number}
              <Badge className={`${colors.bg} ${colors.text} text-xs ml-1`} variant="outline">
                {colors.label}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {!order ? (
            <div className="text-center py-6 text-gray-400">
              <p>Mesa livre — sem pedido ativo</p>
              <Button onClick={clearTable} variant="outline" className="mt-4">
                Liberar mesa
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Itens do pedido</p>
                <ul className="space-y-1">
                  {(order.order_items ?? []).map((item: { id: string; quantity: number; menu_item?: { name: string } }) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}× {item.menu_item?.name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div className="flex items-center justify-between font-bold">
                <span>Total</span>
                <span className="text-orange-600 text-lg">{formatCurrency(order.total ?? 0)}</span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Status do pedido</p>
                <Select value={orderStatus} onValueChange={v => updateOrderStatus(v as OrderStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setShowPayment(true)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  Pagamento
                </Button>
                <Button onClick={clearTable} variant="outline" className="flex-1">
                  Liberar mesa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showPayment && order && (
        <PaymentModal
          orderId={order.id}
          restaurantId={table.restaurant_id}
          total={order.total ?? 0}
          onClose={() => setShowPayment(false)}
          onPaid={() => {
            clearTable()
            setShowPayment(false)
          }}
        />
      )}
    </>
  )
}
