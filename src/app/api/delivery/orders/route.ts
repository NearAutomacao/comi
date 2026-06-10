import { createAdminClient, inFilter } from '@/lib/pb/server'
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

    if (items.length === 0) return NextResponse.json({ orders: [] })

    // Batch: todos os order_items em 1 query
    const orderIds = items.map((o: any) => o.id)
    const { items: allOrderItems } = await pb.collection('order_items').getList(1, 1000, {
      filter: inFilter('order_id', orderIds),
    })

    // Batch: todos os menu_items necessários em 1 query
    const menuItemIds = [...new Set(allOrderItems.map((oi: any) => oi.menu_item_id).filter(Boolean))] as string[]
    let menuItemMap: Record<string, any> = {}
    if (menuItemIds.length > 0) {
      const { items: menuItems } = await pb.collection('menu_items').getList(1, 1000, {
        filter: inFilter('id', menuItemIds),
        fields: 'id,name',
      })
      menuItemMap = Object.fromEntries(menuItems.map((m: any) => [m.id, m]))
    }

    // Monta mapa order_id → order_items em memória
    const orderItemsByOrder = new Map<string, any[]>()
    for (const oi of allOrderItems) {
      if (!orderItemsByOrder.has(oi.order_id)) orderItemsByOrder.set(oi.order_id, [])
      orderItemsByOrder.get(oi.order_id)!.push({
        ...oi,
        menu_item: menuItemMap[oi.menu_item_id] ? { name: menuItemMap[oi.menu_item_id].name } : null,
      })
    }

    const orders = items.map((order: any) => ({
      ...order,
      order_items: orderItemsByOrder.get(order.id) ?? [],
    }))

    return NextResponse.json({ orders })
  } catch (err: any) {
    console.error('[GET /api/delivery/orders] erro:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
