'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/pb/client'
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
  const pbRef = useRef(createClient())

  useEffect(() => {
    if (table.current_order) {
      setOrderStatus(table.current_order.status ?? 'open')
    }
  }, [table.current_order?.id, table.current_order?.status, table.current_order?.total])

  // Fallback: mesa ocupada mas sem current_order (ex: popup aberto logo após transferência)
  useEffect(() => {
    if (table.status !== 'occupied' || table.current_order) return
    const pb = pbRef.current
    pb.collection('orders').getList(1, 1, {
      filter: `table_id = "${table.id}" && (status = "open" || status = "preparing" || status = "served")`,
      sort: '-code',
    }).then(async ({ items }) => {
      if (!items.length) return
      const order = items[0]
      const { items: orderItems } = await pb.collection('order_items').getList(1, 100, {
        filter: `order_id = "${order.id}"`,
      })
      const enriched = await Promise.all(
        orderItems.map(async (item: any) => {
          let menuItem: any = null
          try { menuItem = await pb.collection('menu_items').getOne(item.menu_item_id) } catch {}
          return { ...item, menu_item: menuItem ? { name: menuItem.name } : null }
        })
      )
      onUpdate({ ...table, current_order: { ...order, order_items: enriched } as any })
    }).catch(() => {})
  }, [table.id, table.status, table.current_order])

  async function updateOrderStatus(status: OrderStatus) {
    if (!table.current_order) return
    const pb = pbRef.current
    await pb.collection('orders').update(table.current_order.id, { status })
    setOrderStatus(status)
    if (status === 'closed') {
      await pb.collection('tables').update(table.id, { status: 'empty' })
      onUpdate({ ...table, status: 'empty', current_order: null })
      toast.success('Mesa liberada!')
      onClose()
    } else {
      toast.success('Status atualizado')
    }
  }

  async function clearTable() {
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
    const pb = pbRef.current
    const { items } = await pb.collection('tables').getList(1, 100, {
      filter: `restaurant_id = "${table.restaurant_id}" && status = "empty" && id != "${table.id}"`,
      sort: 'number',
    })
    setEmptyTables(items.map((t: any) => ({ id: t.id, number: t.number })))
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

  async function handleOrderSent(orderId: string) {
    const pb = pbRef.current
    try {
      const order = await pb.collection('orders').getOne(orderId)
      const { items: orderItems } = await pb.collection('order_items').getList(1, 100, {
        filter: `order_id = "${orderId}"`,
      })
      const enriched = await Promise.all(
        orderItems.map(async (item: any) => {
          let menuItem: any = null
          try { menuItem = await pb.collection('menu_items').getOne(item.menu_item_id) } catch {}
          return { ...item, menu_item: menuItem ? { name: menuItem.name } : null }
        })
      )
      onUpdate({ ...table, status: 'occupied', current_order: { ...order, order_items: enriched } as any })
    } catch {}
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

          {table.guest_name && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm flex items-center gap-3 mb-1">
              <span className="font-semibold text-orange-700">{table.guest_name}</span>
              <span className="text-orange-400">{table.guest_phone}</span>
            </div>
          )}

          {!table.current_order ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-gray-400">Mesa livre</p>
              <Button onClick={() => setShowWaiterOrder(true)} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
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
                <Button onClick={() => setShowWaiterOrder(true)} variant="outline" className="flex-1 border-orange-300 text-orange-600">
                  <PlusCircle size={15} className="mr-1" /> Adicionar itens
                </Button>
                <Button onClick={() => setShowPayment(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  Pagamento
                </Button>
              </div>
              <Button onClick={openTransfer} variant="outline" className="w-full border-blue-300 text-blue-600 hover:bg-blue-50">
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

      <Dialog open={showTransfer} onOpenChange={v => { if (!transferring) setShowTransfer(v) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-blue-500" />
              Trocar Mesa {table.number} para…
            </DialogTitle>
          </DialogHeader>
          {emptyTables.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhuma mesa livre disponível.</p>
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
          <p className="text-xs text-gray-400 text-center">Pedidos e comandas serão transferidos automaticamente</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
