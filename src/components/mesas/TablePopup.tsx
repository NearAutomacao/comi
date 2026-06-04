'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { getTableColor } from '@/types'
import type { Table, OrderStatus } from '@/types'
import { toast } from 'sonner'
import PaymentModal from '@/components/pedidos/PaymentModal'
import WaiterOrderDialog from './WaiterOrderDialog'
import { PlusCircle } from 'lucide-react'

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
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(table.current_order?.status ?? 'open')
  const [showPayment, setShowPayment] = useState(false)
  const [showWaiterOrder, setShowWaiterOrder] = useState(false)
  const supabase = createClient()

  // Acompanha mudanças no current_order da mesa
  useEffect(() => {
    if (table.current_order) {
      setOrderStatus(table.current_order.status ?? 'open')
    }
  }, [table.current_order?.id, table.current_order?.status, table.current_order?.total])

  async function updateOrderStatus(status: OrderStatus) {
    if (!table.current_order) return
    await supabase.from('orders').update({ status }).eq('id', table.current_order.id)
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
    if (table.current_order) await supabase.from('orders').update({ status: 'closed' }).eq('id', table.current_order.id)
    onUpdate({ ...table, status: 'empty', current_order: null })
    toast.success('Mesa liberada')
    onClose()
  }

  async function handleOrderSent(orderId: string, addedTotal: number) {
    // Re-busca o pedido atualizado com itens
    const { data: freshOrder } = await supabase
      .from('orders')
      .select('id, total, status, order_items(id, quantity, menu_item:menu_items(name))')
      .eq('id', orderId)
      .single()

    if (freshOrder) {
      onUpdate({ ...table, status: 'occupied', current_order: freshOrder as unknown as typeof table.current_order })
    }
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

          {!table.current_order ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-gray-400">Mesa livre</p>
              <Button
                onClick={() => setShowWaiterOrder(true)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                <PlusCircle size={16} className="mr-2" />
                Lançar pedido
              </Button>
              <Button onClick={clearTable} variant="outline" className="w-full">
                Liberar mesa
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Itens do pedido</p>
                <ul className="space-y-1">
                  {(table.current_order.order_items ?? []).map((item: { id: string; quantity: number; menu_item?: { name: string } }) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}× {item.menu_item?.name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div className="flex items-center justify-between font-bold">
                <span>Total</span>
                <span className="text-orange-600 text-lg">{formatCurrency(table.current_order.total ?? 0)}</span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Status do pedido</p>
                <Select value={orderStatus} onValueChange={v => updateOrderStatus(v as OrderStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2 flex-wrap">
                <Button
                  onClick={() => setShowWaiterOrder(true)}
                  variant="outline"
                  className="flex-1 border-orange-300 text-orange-600"
                >
                  <PlusCircle size={15} className="mr-1" /> Adicionar itens
                </Button>
                <Button
                  onClick={() => setShowPayment(true)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  Pagamento
                </Button>
              </div>
              <Button onClick={clearTable} variant="outline" className="w-full">
                Liberar mesa
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showPayment && table.current_order && (
        <PaymentModal
          orderId={table.current_order.id}
          restaurantId={table.restaurant_id}
          total={table.current_order.total ?? 0}
          onClose={() => setShowPayment(false)}
          onPaid={() => { clearTable(); setShowPayment(false) }}
        />
      )}

      {showWaiterOrder && (
        <WaiterOrderDialog
          tableId={table.id}
          restaurantId={table.restaurant_id}
          existingOrderId={table.current_order?.id ?? null}
          onClose={() => setShowWaiterOrder(false)}
          onSent={handleOrderSent}
        />
      )}
    </>
  )
}
