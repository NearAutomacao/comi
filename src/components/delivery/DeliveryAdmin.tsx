'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/pb/client'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Copy, Check, ExternalLink, Truck, Clock, ChefHat, PackageCheck, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type OrderStatus = 'open' | 'preparing' | 'served' | 'closed' | 'cancelled'

interface DeliveryOrder {
  id: string
  code: number | null
  status: OrderStatus
  total: number
  delivery_name: string
  delivery_phone: string
  created: string
  order_items: { quantity: number; unit_price: number; menu_item: { name: string } | null }[]
}

const COLUMNS: { status: OrderStatus; label: string; icon: React.ElementType; color: string }[] = [
  { status: 'open',      label: 'Recebido',    icon: Clock,        color: 'text-blue-500' },
  { status: 'preparing', label: 'Preparando',  icon: ChefHat,      color: 'text-yellow-500' },
  { status: 'served',    label: 'Saiu p/ entrega', icon: Truck,    color: 'text-purple-500' },
]

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  open:      'preparing',
  preparing: 'served',
  served:    'closed',
  closed:    null,
  cancelled: null,
}

const ACTION_LABEL: Record<OrderStatus, string> = {
  open:      'Iniciar preparo',
  preparing: 'Saiu para entrega',
  served:    'Marcar entregue',
  closed:    '',
  cancelled: '',
}

interface Props {
  restaurantId: string
  restaurantSlug: string
  initialOrders: DeliveryOrder[]
}

export default function DeliveryAdmin({ restaurantId, restaurantSlug, initialOrders }: Props) {
  const [orders, setOrders] = useState<DeliveryOrder[]>(initialOrders)
  const [copied, setCopied] = useState(false)
  const pbRef = useRef(createClient())

  const deliveryUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/delivery/${restaurantSlug}`
    : `/delivery/${restaurantSlug}`

  function copyLink() {
    navigator.clipboard.writeText(deliveryUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Link copiado!')
    })
  }

  function whatsappLink(phone: string) {
    const digits = phone.replace(/\D/g, '')
    const number = digits.startsWith('55') ? digits : `55${digits}`
    return `https://wa.me/${number}`
  }

  async function updateStatus(order: DeliveryOrder, newStatus: OrderStatus) {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { toast.error('Erro ao atualizar status'); return }

      if (newStatus === 'closed') {
        setOrders(prev => prev.filter(o => o.id !== order.id))
        toast.success(`Pedido #${String(order.code ?? 0).padStart(3, '0')} entregue!`)
      } else {
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
      }
    } catch {
      toast.error('Erro de conexão')
    }
  }

  // Realtime: escuta novos pedidos de delivery
  useEffect(() => {
    if (!restaurantId) return
    const pb = pbRef.current
    let unsub: (() => void) | null = null
    let realtimeOk = false

    pb.collection('orders').subscribe('*', async event => {
      if (event.action !== 'create') return
      const order = event.record as any
      if (order.restaurant_id !== restaurantId) return
      if (!order.delivery_name) return

      let orderItems: any[] = []
      try {
        const result = await pb.collection('order_items').getList(1, 50, { filter: `order_id = "${order.id}"` })
        orderItems = await Promise.all(
          result.items.map(async (oi: any) => {
            let menuItem: any = null
            try { menuItem = await pb.collection('menu_items').getOne(oi.menu_item_id) } catch {}
            return { ...oi, menu_item: menuItem ? { name: menuItem.name } : null }
          })
        )
      } catch {}

      const newOrder = { ...order, order_items: orderItems }
      setOrders(prev => [newOrder, ...prev])

      const code = order.code != null ? `#${String(order.code).padStart(3, '0')}` : ''
      toast(`🛵 Novo pedido delivery! ${code}`, {
        description: order.delivery_name,
        duration: 10000,
      })
    }, { filter: `restaurant_id = "${restaurantId}"` })
      .then(u => { unsub = u; realtimeOk = true })
      .catch(() => {})

    // Fallback: polling a cada 20s caso o realtime falhe
    const interval = setInterval(async () => {
      if (realtimeOk) return
      try {
        const res = await fetch(`/api/delivery/orders?restaurantId=${restaurantId}`)
        if (!res.ok) return
        const data = await res.json()
        setOrders(data.orders ?? [])
      } catch {}
    }, 20000)

    return () => { unsub?.(); clearInterval(interval) }
  }, [restaurantId])

  const ordersByStatus = (status: OrderStatus) => orders.filter(o => o.status === status)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="text-orange-500" size={24} />
            Delivery
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Pedidos recebidos pelo link de delivery</p>
        </div>
      </div>

      {/* Link de delivery */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Seu link de delivery</p>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 text-sm bg-gray-50 border rounded-lg px-3 py-2 text-gray-700 min-w-0 truncate">
            {restaurantSlug ? deliveryUrl : 'Configure o slug do restaurante em Configurações'}
          </code>
          {restaurantSlug && (
            <>
              <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0 gap-1.5">
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
              <a href={deliveryUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
                  <ExternalLink size={14} />
                  Abrir
                </Button>
              </a>
            </>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Compartilhe este link com seus clientes pelo WhatsApp, Instagram ou qualquer canal.
        </p>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(({ status, label, icon: Icon, color }) => {
          const colOrders = ordersByStatus(status)
          return (
            <div key={status} className="bg-gray-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className={color} />
                <h3 className="font-semibold text-sm text-gray-700">{label}</h3>
                {colOrders.length > 0 && (
                  <span className="ml-auto bg-white text-gray-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border">
                    {colOrders.length}
                  </span>
                )}
              </div>

              <div className="space-y-3 min-h-[80px]">
                {colOrders.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">Nenhum pedido</p>
                )}
                {colOrders.map(order => {
                  const next = NEXT_STATUS[order.status]
                  const code = order.code != null ? `#${String(order.code).padStart(3, '0')}` : ''
                  return (
                    <div key={order.id} className="bg-white rounded-lg border shadow-sm p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-bold text-orange-500 text-sm">{code}</span>
                          <p className="font-semibold text-gray-800 text-sm">{order.delivery_name}</p>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {format(new Date(order.created), 'HH:mm', { locale: ptBR })}
                        </span>
                      </div>

                      {/* Items */}
                      <ul className="space-y-0.5 mb-3">
                        {order.order_items?.map((oi, i) => (
                          <li key={i} className="text-xs text-gray-600">
                            {oi.quantity}× {oi.menu_item?.name ?? 'Item'}
                          </li>
                        ))}
                      </ul>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-800">{formatCurrency(order.total)}</span>
                          {order.delivery_phone && (
                            <a
                              href={whatsappLink(order.delivery_phone)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-green-500 hover:text-green-600"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </a>
                          )}
                        </div>
                        {next && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(order, next)}
                            className="text-xs h-7 bg-orange-500 hover:bg-orange-600 text-white px-3"
                          >
                            {ACTION_LABEL[order.status]}
                          </Button>
                        )}
                        {order.status === 'served' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(order, 'cancelled')}
                            className="text-xs h-7 text-red-500 hover:text-red-600 border-red-200"
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {orders.length === 0 && (
        <div className="text-center py-16 text-gray-400 mt-4">
          <PackageCheck size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">Nenhum pedido de delivery ainda</p>
          <p className="text-sm mt-1">Compartilhe seu link de delivery para receber pedidos</p>
        </div>
      )}
    </div>
  )
}
