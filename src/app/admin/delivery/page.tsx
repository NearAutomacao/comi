import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import DeliveryAdmin from '@/components/delivery/DeliveryAdmin'

export const revalidate = 0

export default async function AdminDeliveryPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session || session.role !== 'manager') redirect('/login')

  const restaurantId = session.restaurantId ?? ''
  const pb = createAdminClient()

  let restaurantSlug = ''
  try {
    const r = await pb.collection('restaurants').getOne(restaurantId)
    restaurantSlug = r.slug ?? ''
  } catch {}

  let orders: any[] = []
  if (restaurantId) {
    try {
      const { items } = await pb.collection('orders').getList(1, 200, {
        filter: `restaurant_id = "${restaurantId}" && delivery_name != null && delivery_name != "" && status != "closed" && status != "cancelled"`,
        sort: '-code',
      })

      orders = await Promise.all(
        items.map(async (order: any) => {
          let orderItems: any[] = []
          try {
            const result = await pb.collection('order_items').getList(1, 50, {
              filter: `order_id = "${order.id}"`,
            })
            orderItems = await Promise.all(
              result.items.map(async (oi: any) => {
                let menuItem: any = null
                try { menuItem = await pb.collection('menu_items').getOne(oi.menu_item_id) } catch {}
                return { ...oi, menu_item: menuItem ? { name: menuItem.name } : null }
              })
            )
          } catch {}
          return { ...order, order_items: orderItems }
        })
      )
    } catch (err) {
      console.error('[admin/delivery] erro:', err)
    }
  }

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <DeliveryAdmin
        restaurantId={restaurantId}
        restaurantSlug={restaurantSlug}
        initialOrders={orders}
      />
    </div>
  )
}
