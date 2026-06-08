'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, UtensilsCrossed, Receipt, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const statusConfig: Record<string, { label: string; class: string }> = {
  open:      { label: 'Recebido',   class: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparando', class: 'bg-yellow-100 text-yellow-700' },
  served:    { label: 'Servido',    class: 'bg-green-100 text-green-700' },
  closed:    { label: 'Fechado',    class: 'bg-gray-100 text-gray-600' },
}

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  menu_item?: { name: string }
}

interface Order {
  id: string
  total: number
  status: string
  created: string
  restaurant_id: string
  order_items: OrderItem[]
}

export default function MinhaMesaPage() {
  const router = useRouter()
  const { tableId, tableNumber, guestName } = useCartStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = useCallback(async (silent = false) => {
    if (!tableId) return
    if (!silent) setRefreshing(true)
    const res = await fetch(`/api/conta?tableId=${tableId}`)
    if (res.ok) {
      const { orders: fetched } = await res.json()
      setOrders(fetched ?? [])
    }
    setLoading(false)
    setRefreshing(false)
  }, [tableId])

  useEffect(() => {
    if (!tableId) { router.replace('/cardapio'); return }
    fetchOrders(false)
    // Atualiza status automaticamente a cada 20s
    const interval = setInterval(() => fetchOrders(true), 20000)
    return () => clearInterval(interval)
  }, [tableId, fetchOrders, router])

  const grandTotal = orders.reduce((s, o) => s + (o.total ?? 0), 0)

  const allItems = orders.flatMap(o => o.order_items ?? []).reduce<
    Record<string, { name: string; qty: number; price: number }>
  >((acc, item) => {
    const name = item.menu_item?.name ?? 'Item'
    if (!acc[name]) acc[name] = { name, qty: 0, price: item.unit_price }
    acc[name].qty += item.quantity
    return acc
  }, {})

  // Status geral: o pior (open > preparing > served)
  const priority: Record<string, number> = { open: 0, preparing: 1, served: 2, closed: 3 }
  const overallStatus = orders.length > 0
    ? orders.reduce((worst, o) =>
        priority[o.status] < priority[worst] ? o.status : worst, 'closed')
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-orange-400" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mesa {tableNumber}</h1>
          {guestName && <p className="text-sm text-gray-500">Olá, {guestName.split(' ')[0]}!</p>}
        </div>
        <button
          onClick={() => fetchOrders(false)}
          disabled={refreshing}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <UtensilsCrossed size={48} className="mx-auto text-gray-200" />
          <p className="text-gray-500">Nenhum pedido ainda</p>
          <Link href="/cardapio">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus size={16} className="mr-2" /> Ver cardápio
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Status geral */}
          {overallStatus && overallStatus !== 'closed' && (
            <div className={`rounded-xl p-3 mb-4 flex items-center justify-between ${statusConfig[overallStatus]?.class ?? ''}`}>
              <span className="font-semibold text-sm">
                {statusConfig[overallStatus]?.label ?? overallStatus}
              </span>
              <span className="text-xs opacity-70">Atualiza a cada 20s</span>
            </div>
          )}

          {/* Resumo de itens */}
          <div className="bg-white rounded-xl border shadow-sm p-4 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Seus pedidos</p>
            <ul className="space-y-2">
              {Object.values(allItems).map(item => (
                <li key={item.name} className="flex justify-between text-sm text-gray-700">
                  <span>{item.qty}× {item.name}</span>
                  <span className="font-medium">{formatCurrency(item.price * item.qty)}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-orange-600">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Pedidos individuais com status */}
          {orders.length > 1 && (
            <div className="space-y-2 mb-4">
              {orders.map((order, idx) => {
                const s = statusConfig[order.status] ?? statusConfig.open
                return (
                  <div key={order.id} className="bg-white rounded-xl border px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-gray-600">Pedido {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(order.total)}</span>
                      <Badge className={`${s.class} text-xs`} variant="outline">{s.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Botões fixos */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 space-y-2">
        <div className="max-w-md mx-auto flex gap-3">
          <Link href="/cardapio" className="flex-1">
            <Button variant="outline" className="w-full border-orange-300 text-orange-600 gap-1">
              <Plus size={15} /> Mais itens
            </Button>
          </Link>
          {orders.length > 0 && (
            <Link href="/conta" className="flex-1">
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-1">
                <Receipt size={15} /> Fechar conta
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
