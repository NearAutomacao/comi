'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Order, OrderStatus } from '@/types'
import PaymentModal from './PaymentModal'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const statusConfig: Record<OrderStatus, { label: string; class: string }> = {
  open:      { label: 'Novo',       class: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparando', class: 'bg-yellow-100 text-yellow-700' },
  served:    { label: 'Servido',    class: 'bg-green-100 text-green-700' },
  closed:    { label: 'Fechado',    class: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelado',  class: 'bg-red-100 text-red-700' },
}

export default function PedidosAdmin({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [payingOrder, setPayingOrder] = useState<Order | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('orders-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'comi', table: 'orders' }, async payload => {
        const { data } = await supabase
          .from('orders')
          .select('*, table:tables(number), order_items(*, menu_item:menu_items(name, price))')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setOrders(prev => [data as Order, ...prev])
          toast('Novo pedido!', { description: `Mesa ${(data as Order & { table: { number: number } }).table?.number}`, icon: '🍽️' })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'comi', table: 'orders' }, payload => {
        const updated = payload.new as Order
        if (['closed', 'cancelled'].includes(updated.status)) {
          setOrders(prev => prev.filter(o => o.id !== updated.id))
        } else {
          setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function updateStatus(orderId: string, status: OrderStatus) {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    toast.success('Status atualizado')
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-lg">Nenhum pedido em aberto</p>
        <p className="text-sm mt-1">Os pedidos aparecerão aqui em tempo real</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map(order => {
          const tableNum = (order as Order & { table?: { number: number } }).table?.number
          const s = statusConfig[order.status]
          return (
            <Card key={order.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Mesa {tableNum ?? '?'}</CardTitle>
                  <Badge className={s.class} variant="outline">{s.label}</Badge>
                </div>
                <p className="text-xs text-gray-400">
                  {format(new Date(order.created_at), "HH:mm", { locale: ptBR })}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1">
                  {(order.order_items ?? []).map((item: { id: string; quantity: number; menu_item?: { name: string } }) => (
                    <li key={item.id} className="text-sm flex justify-between text-gray-700">
                      <span>{item.quantity}× {item.menu_item?.name}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between font-bold text-sm border-t pt-2">
                  <span>Total</span>
                  <span className="text-orange-600">{formatCurrency(order.total)}</span>
                </div>
                <div className="flex gap-2">
                  <Select value={order.status} onValueChange={v => updateStatus(order.id, v as OrderStatus)}>
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Novo</SelectItem>
                      <SelectItem value="preparing">Preparando</SelectItem>
                      <SelectItem value="served">Servido</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => setPayingOrder(order)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white text-xs"
                  >
                    Pagar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {payingOrder && (
        <PaymentModal
          orderId={payingOrder.id}
          restaurantId={(payingOrder as Order & { restaurant_id?: string }).restaurant_id ?? ''}
          total={payingOrder.total}
          onClose={() => setPayingOrder(null)}
          onPaid={() => {
            setOrders(prev => prev.filter(o => o.id !== payingOrder.id))
            setPayingOrder(null)
            toast.success('Pedido pago e encerrado!')
          }}
        />
      )}
    </>
  )
}
