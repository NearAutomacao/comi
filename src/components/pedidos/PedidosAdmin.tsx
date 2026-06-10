'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/pb/client'
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

async function fetchRichOrder(pb: ReturnType<typeof createClient>, orderId: string): Promise<RichOrder | null> {
  try {
    const order = await pb.collection('orders').getOne(orderId) as any
    const [tableResult, sessionResult, orderItemsResult] = await Promise.allSettled([
      order.table_id ? pb.collection('tables').getOne(order.table_id) : Promise.resolve(null),
      order.session_id ? pb.collection('table_sessions').getOne(order.session_id) : Promise.resolve(null),
      pb.collection('order_items').getList(1, 100, { filter: `order_id = "${orderId}"` }),
    ])

    const table = tableResult.status === 'fulfilled' ? tableResult.value : null
    const session = sessionResult.status === 'fulfilled' ? sessionResult.value : null
    const orderItemsList = orderItemsResult.status === 'fulfilled' ? (orderItemsResult.value as any).items : []

    const enrichedItems = await Promise.all(
      orderItemsList.map(async (item: any) => {
        let menuItem: any = null
        try { menuItem = await pb.collection('menu_items').getOne(item.menu_item_id) } catch {}
        return { ...item, menu_item: menuItem ? { name: menuItem.name, price: menuItem.price } : null }
      })
    )

    return {
      ...order,
      table: table ? { number: (table as any).number } : undefined,
      session: session ? { guest_name: (session as any).guest_name } : null,
      order_items: enrichedItems,
    } as RichOrder
  } catch {
    return null
  }
}

export default function PedidosAdmin({ initialOrders, restaurantId }: { initialOrders: Order[]; restaurantId: string }) {
  const [orders, setOrders] = useState<RichOrder[]>(initialOrders as RichOrder[])
  const [loading, setLoading] = useState(initialOrders.length === 0)
  const [payingTableId, setPayingTableId] = useState<string | null>(null)
  const pbRef = useRef(createClient())

  // Carga inicial se o servidor não retornou dados
  useEffect(() => {
    if (!restaurantId || initialOrders.length > 0) return
    const pb = pbRef.current
    const loadOrders = async () => {
      try {
        const { items } = await pb.collection('orders').getList(1, 200, {
          filter: `restaurant_id = "${restaurantId}" && delivery_name = null && (status = "open" || status = "preparing" || status = "served")`,
          sort: '-code',
        })
        const rich = await Promise.all(items.map(o => fetchRichOrder(pb, o.id)))
        setOrders(rich.filter(Boolean) as RichOrder[])
      } catch {}
      setLoading(false)
    }
    loadOrders()
  }, [restaurantId])

  useEffect(() => {
    const pb = pbRef.current
    let unsubscribe: (() => void) | null = null

    pb.collection('orders').subscribe('*', async event => {
      if (event.action === 'create') {
        const order = event.record as any
        if (order.restaurant_id !== restaurantId) return
        const rich = await fetchRichOrder(pb, order.id)
        if (rich) setOrders(prev => [...prev, rich])
      }
      if (event.action === 'update') {
        const updated = event.record as unknown as Order
        if (['closed', 'cancelled'].includes(updated.status)) {
          setOrders(prev => prev.filter(o => o.id !== updated.id))
        } else {
          setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))
        }
      }
    }, { filter: `restaurant_id = "${restaurantId}"` })
      .then(unsub => { unsubscribe = unsub })
      .catch(() => {})

    return () => { unsubscribe?.() }
  }, [restaurantId])

  async function updateStatus(orderId: string, status: OrderStatus) {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(`Erro ao atualizar: ${data.error ?? res.statusText}`)
        return
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
      toast.success('Status atualizado')
    } catch (err: any) {
      toast.error('Erro ao atualizar status')
      console.error('[updateStatus]', err)
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, { tableNum: number; tableId: string; restaurantId: string; orders: RichOrder[] }>()
    for (const order of orders) {
      const key = order.table_id ?? 'sem-mesa'
      if (!map.has(key)) map.set(key, { tableNum: order.table?.number ?? 0, tableId: key, restaurantId: order.restaurant_id ?? restaurantId, orders: [] })
      map.get(key)!.orders.push(order)
    }
    return [...map.values()]
      .sort((a, b) => a.tableNum - b.tableNum)
      .map(g => ({
        ...g,
        orders: g.orders.sort((a, b) => new Date(a.created ?? 0).getTime() - new Date(b.created ?? 0).getTime()),
        total: g.orders.reduce((s, o) => s + (o.total ?? 0), 0),
        worstStatus: g.orders.reduce<OrderStatus>((worst, o) =>
          statusPriority[o.status] < statusPriority[worst] ? o.status : worst,
          'closed' as OrderStatus
        ),
      }))
  }, [orders])

  const payingGroup = payingTableId ? groups.find(g => g.tableId === payingTableId) : null

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Carregando pedidos...</p>
      </div>
    )
  }

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

              <div className="divide-y">
                {group.orders.map(order => {
                  const s = statusConfig[order.status]
                  const codeStr = order.code != null ? `#${String(order.code).padStart(3, '0')}` : null
                  return (
                    <div key={order.id} className="px-4 py-3 space-y-2">
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
                            {order.created ? format(new Date(order.created), 'HH:mm', { locale: ptBR }) : ''}
                          </span>
                        </div>
                        <Badge className={`${s.class} text-xs`} variant="outline">{s.label}</Badge>
                      </div>

                      <ul className="space-y-0.5">
                        {(order.order_items ?? []).map((item: { id: string; quantity: number; menu_item?: { name: string } }) => (
                          <li key={item.id} className="text-sm text-gray-700">
                            {item.quantity}× {item.menu_item?.name}
                          </li>
                        ))}
                      </ul>

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
