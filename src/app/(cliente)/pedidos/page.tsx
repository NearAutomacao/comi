import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
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
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) redirect('/login')

  const pb = createAdminClient()
  let orders: any[] = []

  try {
    const { items } = await pb.collection('orders').getList(1, 20, {
      filter: `customer_id = "${session.userId}"`,
      sort: '-code',
    })

    orders = await Promise.all(
      items.map(async (order: any) => {
        const [tableResult, orderItemsResult] = await Promise.allSettled([
          order.table_id ? pb.collection('tables').getOne(order.table_id) : Promise.resolve(null),
          pb.collection('order_items').getList(1, 100, { filter: `order_id = "${order.id}"` }),
        ])

        const table = tableResult.status === 'fulfilled' ? tableResult.value : null
        const orderItemsList = orderItemsResult.status === 'fulfilled' ? (orderItemsResult.value as any).items : []

        const enrichedItems = await Promise.all(
          orderItemsList.map(async (item: any) => {
            let menuItem: any = null
            try { menuItem = await pb.collection('menu_items').getOne(item.menu_item_id) } catch {}
            return { ...item, menu_item: menuItem ? { name: menuItem.name } : null }
          })
        )

        return {
          ...order,
          table: table ? { number: (table as any).number } : null,
          order_items: enrichedItems,
        }
      })
    )
  } catch {}

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <ClipboardList size={24} className="text-orange-500" />
        Meus pedidos
      </h1>

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
                    {order.created ? format(new Date(order.created), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 mb-3">
                    {order.order_items?.map((item: any, i: number) => (
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
