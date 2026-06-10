import { createAdminClient } from '@/lib/pb/server'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// GET /api/delivery/orders?restaurantId=xxx — lista pedidos de delivery ativos
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('comi_admin_session')?.value
    const session = token ? await verifyAdminSessionToken(token) : null
    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const restaurantId = searchParams.get('restaurantId')
    if (!restaurantId || restaurantId !== session.restaurantId) {
      return NextResponse.json({ error: 'Restaurante inválido' }, { status: 403 })
    }

    const pb = createAdminClient()
    const { items } = await pb.collection('orders').getList(1, 200, {
      filter: `restaurant_id = "${restaurantId}" && delivery_name != null && delivery_name != "" && status != "closed" && status != "cancelled"`,
      sort: '-code',
      fields: '*,created',
    })

    const orders = await Promise.all(
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

    return NextResponse.json({ orders })
  } catch (err: any) {
    console.error('[GET /api/delivery/orders] erro:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
