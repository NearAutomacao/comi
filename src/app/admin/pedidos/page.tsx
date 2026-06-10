import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import PedidosAdmin from '@/components/pedidos/PedidosAdmin'

export default async function PedidosAdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session || session.role !== 'manager') redirect('/login')

  const restaurantId = session.restaurantId ?? ''
  const pb = createAdminClient()

  let orders: any[] = []
  if (restaurantId) {
    try {
      const { items } = await pb.collection('orders').getList(1, 200, {
        filter: `restaurant_id = "${restaurantId}" && (status = "open" || status = "preparing" || status = "served")`,
        sort: 'code',
      })

      orders = await Promise.all(
        items.map(async (order: any) => {
          const [tableResult, sessionResult, orderItemsResult] = await Promise.allSettled([
            order.table_id ? pb.collection('tables').getOne(order.table_id) : Promise.resolve(null),
            order.session_id ? pb.collection('table_sessions').getOne(order.session_id) : Promise.resolve(null),
            pb.collection('order_items').getList(1, 100, { filter: `order_id = "${order.id}"` }),
          ])

          const table = tableResult.status === 'fulfilled' ? tableResult.value : null
          const tableSession = sessionResult.status === 'fulfilled' ? sessionResult.value : null
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
            session: tableSession ? { guest_name: (tableSession as any).guest_name } : null,
            order_items: enrichedItems,
          }
        })
      )
    } catch {}
  }

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Pedidos em aberto</h1>
      <PedidosAdmin initialOrders={orders} restaurantId={restaurantId} />
    </div>
  )
}
