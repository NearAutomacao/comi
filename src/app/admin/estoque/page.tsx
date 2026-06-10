import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient, inFilter } from '@/lib/pb/server'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'
import EstoqueFilter from './EstoqueFilter'

function brazilToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session || session.role !== 'manager') redirect('/login')

  const restaurantId = session.restaurantId ?? ''
  const { from, to } = await searchParams
  const today = brazilToday()
  const fromDate = from || today
  const toDate = (to && to >= fromDate) ? to : fromDate

  const pb = createAdminClient()
  const costMap = new Map<string, { name: string; qty: number; revenue: number; cost: number }>()

  if (restaurantId) {
    try {
      const { items: orders } = await pb.collection('orders').getList(1, 2000, {
        filter: `restaurant_id = "${restaurantId}" && status != "cancelled" && created >= "${fromDate} 00:00:00" && created <= "${toDate} 23:59:59"`,
      })

      if (orders.length > 0) {
        const orderIds = orders.map((o: any) => o.id)

        const { items: allOrderItems } = await pb.collection('order_items').getList(1, 10000, {
          filter: inFilter('order_id', orderIds),
        })

        const menuItemIds = [...new Set(allOrderItems.map((i: any) => i.menu_item_id))] as string[]

        if (menuItemIds.length > 0) {
          const [menuItemsResult, costItemsResult] = await Promise.all([
            pb.collection('menu_items').getList(1, 1000, {
              filter: inFilter('id', menuItemIds),
              fields: 'id,name,price',
            }),
            pb.collection('cost_items').getList(1, 5000, {
              filter: inFilter('menu_item_id', menuItemIds),
            }),
          ])

          const menuItemMap = new Map((menuItemsResult.items as any[]).map(m => [m.id, m]))

          const costByItem = new Map<string, number>()
          for (const ci of costItemsResult.items as any[]) {
            costByItem.set(ci.menu_item_id, (costByItem.get(ci.menu_item_id) ?? 0) + (ci.unit_cost ?? 0))
          }

          for (const item of allOrderItems as any[]) {
            const menuItem = menuItemMap.get(item.menu_item_id)
            if (!menuItem) continue
            const itemCost = costByItem.get(item.menu_item_id) ?? 0
            const existing = costMap.get(item.menu_item_id)
            if (existing) {
              existing.qty += item.quantity
              existing.revenue += menuItem.price * item.quantity
              existing.cost += itemCost * item.quantity
            } else {
              costMap.set(item.menu_item_id, {
                name: menuItem.name,
                qty: item.quantity,
                revenue: menuItem.price * item.quantity,
                cost: itemCost * item.quantity,
              })
            }
          }
        }
      }
    } catch {}
  }

  const rows = Array.from(costMap.values()).sort((a, b) => b.qty - a.qty)
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const totalProfit = totalRevenue - totalCost

  const isToday = fromDate === today && toDate === today
  const periodLabel = isToday
    ? 'hoje'
    : fromDate === toDate
    ? new Date(fromDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : `${new Date(fromDate + 'T12:00:00').toLocaleDateString('pt-BR')} – ${new Date(toDate + 'T12:00:00').toLocaleDateString('pt-BR')}`

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Package size={24} className="text-orange-500" />
        Estoque & Custo
      </h1>

      <EstoqueFilter defaultFrom={fromDate} defaultTo={toDate} />

      <p className="text-sm text-gray-500 mb-4">
        Movimentações do período: <span className="font-medium text-gray-700">{periodLabel}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-gray-500">Receita do período</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-gray-500">Custo total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(totalCost)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-gray-500">Lucro estimado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatCurrency(totalProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-center py-16">Sem vendas registradas no período</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium text-gray-600">Produto</th>
                <th className="text-right p-3 font-medium text-gray-600">Qtd</th>
                <th className="text-right p-3 font-medium text-gray-600">Receita</th>
                <th className="text-right p-3 font-medium text-gray-600">Custo</th>
                <th className="text-right p-3 font-medium text-gray-600">Margem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const margin = row.revenue > 0 ? ((row.revenue - row.cost) / row.revenue) * 100 : 0
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 text-right text-gray-600">{row.qty}</td>
                    <td className="p-3 text-right text-green-600">{formatCurrency(row.revenue)}</td>
                    <td className="p-3 text-right text-red-500">{formatCurrency(row.cost)}</td>
                    <td className="p-3 text-right">
                      <span className={margin >= 30 ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
