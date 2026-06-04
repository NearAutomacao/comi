'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, Receipt, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

const statusLabel: Record<string, { label: string; class: string }> = {
  open:      { label: 'Aberto',     class: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparando', class: 'bg-yellow-100 text-yellow-700' },
  served:    { label: 'Servido',    class: 'bg-green-100 text-green-700' },
  closed:    { label: 'Fechado',    class: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelado',  class: 'bg-red-100 text-red-700' },
}

interface OrderItem { quantity: number; menu_item: { name: string } }
interface Order {
  id: string
  total: number
  status: string
  created_at: string
  table?: { number: number }
  order_items: OrderItem[]
}

export default function PedidosPage() {
  const router = useRouter()
  const { tableId, tableNumber } = useCartStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase
        .from('orders')
        .select('*, order_items(*, menu_item:menu_items(name)), table:tables(number)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          setOrders((data ?? []) as Order[])
          setLoading(false)
        })
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-orange-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <ClipboardList size={24} className="text-orange-500" />
        Meus pedidos
      </h1>

      {/* CTA fechar conta */}
      {tableId && (
        <Link href="/conta" className="block mb-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between hover:bg-green-100 transition-colors">
            <div>
              <p className="font-semibold text-green-800">Pronto para pagar?</p>
              <p className="text-sm text-green-600">Você está na Mesa {tableNumber} · Ver conta completa</p>
            </div>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-shrink-0">
              <Receipt size={14} />
              Fechar conta
            </Button>
          </div>
        </Link>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList size={48} className="mx-auto mb-3 text-gray-200" />
          <p>Nenhum pedido ainda</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const s = statusLabel[order.status] ?? statusLabel.open
            return (
              <Card key={order.id} className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Mesa {order.table?.number ?? '?'}
                    </CardTitle>
                    <Badge className={s.class} variant="outline">{s.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 mb-3">
                    {order.order_items?.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 flex justify-between">
                        <span>{item.quantity}× {item.menu_item?.name}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-orange-600">{formatCurrency(order.total)}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
