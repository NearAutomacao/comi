import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient, inFilter } from '@/lib/pb/server'
import TableMapAdmin from '@/components/mesas/TableMapAdmin'

export default async function MesasAdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) redirect('/login')

  const restaurantId = session.restaurantId ?? ''
  const pb = createAdminClient()

  // Busca mesas
  const { items: tables } = await pb.collection('tables').getList(1, 100, {
    filter: `restaurant_id = "${restaurantId}"`,
    sort: 'number',
  })

  // Para cada mesa ocupada, busca pedido aberto
  const tablesWithOrder = await Promise.all(
    tables.map(async (table: any) => {
      if (table.status !== 'occupied') return { ...table, current_order: null }
      try {
        const { items: orders } = await pb.collection('orders').getList(1, 1, {
          filter: `table_id = "${table.id}" && (${inFilter('status', ['open', 'preparing', 'served'])})`,
          sort: '-created',
        })
        if (!orders.length) return { ...table, current_order: null }
        const order = orders[0]
        const { items: orderItems } = await pb.collection('order_items').getList(1, 100, {
          filter: `order_id = "${order.id}"`,
        })
        const items = await Promise.all(
          orderItems.map(async (item: any) => {
            let menuItem: any = null
            try { menuItem = await pb.collection('menu_items').getOne(item.menu_item_id) } catch {}
            return { ...item, menu_item: menuItem ? { name: menuItem.name } : null }
          })
        )
        return { ...table, current_order: { ...order, order_items: items } }
      } catch {
        return { ...table, current_order: null }
      }
    })
  )

  const localIP = process.env.LOCAL_IP

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-4">Mapa de mesas</h1>
      <TableMapAdmin restaurantId={restaurantId} initialTables={tablesWithOrder} localIP={localIP} />
    </div>
  )
}
