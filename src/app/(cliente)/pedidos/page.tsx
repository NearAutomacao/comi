import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const statusLabel: Record<string, { label: string; class: string }> = {
  open:      { label: 'Aberto',     class: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparando', class: 'bg-yellow-100 text-yellow-700' },
  served:    { label: 'Servido',    class: 'bg-green-100 text-green-700' },
  closed:    { label: 'Fechado',    class: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelado',  class: 'bg-red-100 text-red-700' },
}

export default async function PedidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*, menu_item:menu_items(name)), table:tables(number)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <ClipboardList size={24} className="text-orange-500" />
        Meus pedidos
      </h1>

      {(!orders || orders.length === 0) ? (
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
                      Mesa {(order.table as { number: number })?.number ?? '?'}
                    </CardTitle>
                    <Badge className={s.class} variant="outline">{s.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 mb-3">
                    {(order.order_items as { quantity: number; menu_item: { name: string } }[])?.map((item, i) => (
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
