'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import type { Order, OrderStatus } from '@/types'
import PaymentModal from './PaymentModal'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Hash, UtensilsCrossed, User } from 'lucide-react'

const statusConfig: Record<OrderStatus, { label: string; class: string }> = {
  open:      { label: 'Novo',       class: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparando', class: 'bg-yellow-100 text-yellow-700' },
  served:    { label: 'Servido',    class: 'bg-green-100 text-green-700' },
  closed:    { label: 'Fechado',    class: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelado',  class: 'bg-red-100 text-red-700' },
}

const statusPriority: Record<OrderStatus, number> = {
  open: 0, preparing: 1, served: 2, closed: 3, cancelled: 4,
}

type RichOrder = Order & {
  table?: { number: number }
  restaurant_id?: string
  session?: { guest_name: string } | null
}

export default function PedidosAdmin({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<RichOrder[]>(initialOrders as RichOrder[])
  const [payingTableId, setPayingTableId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('orders-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'comi', table: 'orders' }, async payload => {
        const { data } = await supabase
          .from('orders')
          .select('*, table:tables(number), order_items(*, menu_item:menu_items(name, price)), session:table_sessions(guest_name)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setOrders(prev => [...prev, data as RichOrder])
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

  // Agrupa por mesa, ordenado por número
  const groups = useMemo(() => {
    const map = new Map<string, { tableNum: number; tableId: string; restaurantId: string; orders: RichOrder[] }>()
    for (const order of orders) {
      const key = order.table_id ?? 'sem-mesa'
      if (!map.has(key)) map.set(key, { tableNum: order.table?.number ?? 0, tableId: key, restaurantId: order.restaurant_id ?? '', orders: [] })
      map.get(key)!.orders.push(order)
    }
    return [...map.values()]
      .sort((a, b) => a.tableNum - b.tableNum)
      .map(g => ({
        ...g,
        orders: g.orders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        total: g.orders.reduce((s, o) => s + (o.total ?? 0), 0),
        worstStatus: g.orders.reduce<OrderStatus>((worst, o) =>
          statusPriority[o.status] < statusPriority[worst] ? o.status : worst,
          'closed' as OrderStatus
        ),
      }))
  }, [orders])

  const payingGroup = payingTableId ? groups.find(g => g.tableId === payingTableId) : null

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <UtensilsCrossed size={48} className="mx-auto mb-3 opacity-30" />
        <p className="text-lg">Nenhum pedido em aberto</p>
        <p className="text-sm mt-1">Os pedidos aparecerão aqui em tempo real</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {groups.map(group => {
          const ws = statusConfig[group.worstStatus]
          return (
            <div key={group.tableId} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Cabeçalho da mesa */}
              <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b">
                <span className="font-bold text-orange-700 text-lg">
                  Mesa {group.tableNum || '—'}
                </span>
                <div className="flex items-center gap-2">
                  <Badge className={ws.class} variant="outline">{ws.label}</Badge>
                  <span className="font-bold text-orange-600 text-sm">
                    {formatCurrency(group.total)}
                  </span>
                </div>
              </div>

              {/* Lista de pedidos */}
              <div className="divide-y">
                {group.orders.map(order => {
                  const s = statusConfig[order.status]
                  const codeStr = order.code != null ? `#${String(order.code).padStart(3, '0')}` : null
                  return (
                    <div key={order.id} className="px-4 py-3 space-y-2">
                      {/* Linha de meta: código, nome, horário, status */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          {codeStr && (
                            <span className="flex items-center gap-0.5 font-mono font-semibold text-orange-600">
                              <Hash size={10} />{codeStr.slice(1)}
                            </span>
                          )}
                          {order.session?.guest_name && (
                            <span className="flex items-center gap-0.5 text-gray-600">
                              <User size={10} />{order.session.guest_name}
                            </span>
                          )}
                          <span className="text-gray-400">
                            {format(new Date(order.created_at), 'HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                        <Badge className={`${s.class} text-xs`} variant="outline">{s.label}</Badge>
                      </div>

                      {/* Itens */}
                      <ul className="space-y-0.5">
                        {(order.order_items ?? []).map((item: { id: string; quantity: number; menu_item?: { name: string } }) => (
                          <li key={item.id} className="text-sm text-gray-700">
                            {item.quantity}× {item.menu_item?.name}
                          </li>
                        ))}
                      </ul>

                      {/* Total e status select */}
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                        <span className="font-semibold text-gray-700">{formatCurrency(order.total)}</span>
                        <Select value={order.status} onValueChange={v => updateStatus(order.id, v as OrderStatus)}>
                          <SelectTrigger className="h-7 text-xs w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Novo</SelectItem>
                            <SelectItem value="preparing">Preparando</SelectItem>
                            <SelectItem value="served">Servido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Separator />

              {/* Rodapé da mesa */}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-bold text-gray-700">
                  Total: {formatCurrency(group.total)}
                </span>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white text-xs"
                  onClick={() => setPayingTableId(group.tableId)}
                >
                  Pagar mesa
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {payingGroup && (
        <PaymentModal
          tableId={payingGroup.tableId}
          tableNum={payingGroup.tableNum}
          orders={payingGroup.orders}
          total={payingGroup.total}
          restaurantId={payingGroup.restaurantId}
          onClose={() => setPayingTableId(null)}
          onPaid={() => {
            setOrders(prev => prev.filter(o => o.table_id !== payingGroup.tableId))
            setPayingTableId(null)
          }}
        />
      )}
    </>
  )
}
