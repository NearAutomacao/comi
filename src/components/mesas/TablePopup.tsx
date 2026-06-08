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
import { ArrowRightLeft, Loader2, PlusCircle } from 'lucide-react'

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
  const [showTransfer, setShowTransfer] = useState(false)
  const [emptyTables, setEmptyTables] = useState<{ id: string; number: number }[]>([])
  const [transferring, setTransferring] = useState(false)
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
    // Usa a API para fechar TODOS os pedidos abertos da mesa e liberar corretamente
    await fetch('/api/conta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: table.id, skipPayment: true }),
    })
    onUpdate({ ...table, status: 'empty', current_order: null, guest_name: null, guest_phone: null })
    toast.success('Mesa liberada')
    onClose()
  }

  async function openTransfer() {
    const { data } = await supabase
      .from('tables')
      .select('id, number')
      .eq('restaurant_id', table.restaurant_id)
      .eq('status', 'empty')
      .neq('id', table.id)
      .order('number')
    setEmptyTables(data ?? [])
    setShowTransfer(true)
  }

  async function handleTransfer(toTableId: string) {
    setTransferring(true)
    try {
      const res = await fetch('/api/mesa/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromTableId: table.id, toTableId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Mesa transferida para Mesa ${data.toTableNumber}`)
      onUpdate({ ...table, status: 'empty', current_order: null, guest_name: null, guest_phone: null })
      onClose()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setTransferring(false)
      setShowTransfer(false)
    }
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

          {/* Convidado atual */}
          {table.guest_name && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm flex items-center gap-3 mb-1">
              <span className="font-semibold text-orange-700">{table.guest_name}</span>
              <span className="text-orange-400">{table.guest_phone}</span>
            </div>
          )}

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
              <Button
                onClick={openTransfer}
                variant="outline"
                className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <ArrowRightLeft size={15} className="mr-2" /> Trocar de mesa
              </Button>
              <Button onClick={clearTable} variant="outline" className="w-full">
                Liberar mesa
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showPayment && table.current_order && (
        <PaymentModal
          tableId={table.id}
          tableNum={table.number}
          orders={[table.current_order as Parameters<typeof PaymentModal>[0]['orders'][0]]}
          total={table.current_order.total ?? 0}
          restaurantId={table.restaurant_id}
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

      {/* Dialog de troca de mesa */}
      <Dialog open={showTransfer} onOpenChange={v => { if (!transferring) setShowTransfer(v) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-blue-500" />
              Trocar Mesa {table.number} para…
            </DialogTitle>
          </DialogHeader>
          {emptyTables.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Nenhuma mesa livre disponível no momento.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 py-2">
              {emptyTables.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTransfer(t.id)}
                  disabled={transferring}
                  className="h-14 rounded-xl border-2 border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 text-gray-700 font-bold text-lg transition-colors disabled:opacity-50"
                >
                  {transferring ? <Loader2 size={16} className="animate-spin mx-auto" /> : t.number}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 text-center">
            Pedidos e comandas serão transferidos automaticamente
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
