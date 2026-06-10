import { createAdminClient, inFilter } from '@/lib/pb/server'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// GET /api/pedidos?restaurantId=xxx — lista pedidos de mesa ativos (não-delivery)
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

    // Query 1: pedidos de mesa abertos
    const { items: orders } = await pb.collection('orders').getList(1, 200, {
      filter: `restaurant_id = "${restaurantId}" && delivery_name = "" && (${inFilter('status', ['open', 'preparing', 'served'])})`,
      sort: '-code',
    })

    if (orders.length === 0) return NextResponse.json({ orders: [] })

    const orderIds = orders.map((o: any) => o.id)

    // Query 2: todos os order_items de todos os pedidos de uma vez
    const { items: allOrderItems } = await pb.collection('order_items').getList(1, 2000, {
      filter: inFilter('order_id', orderIds),
    })

    // Query 3: todos os menu_items necessários de uma vez
    const menuItemIds = [...new Set(allOrderItems.map((oi: any) => oi.menu_item_id).filter(Boolean))] as string[]
    let menuItemMap: Record<string, any> = {}
    if (menuItemIds.length > 0) {
      const { items: menuItems } = await pb.collection('menu_items').getList(1, 1000, {
        filter: inFilter('id', menuItemIds),
        fields: 'id,name,price',
      })
      menuItemMap = Object.fromEntries(menuItems.map((m: any) => [m.id, m]))
    }

    // Queries 4+5 em paralelo: mesas e sessões
    const tableIds = [...new Set(orders.map((o: any) => o.table_id).filter(Boolean))] as string[]
    const sessionIds = [...new Set(orders.map((o: any) => o.session_id).filter(Boolean))] as string[]

    const [tableMap, sessionMap] = await Promise.all([
      tableIds.length > 0
        ? pb.collection('tables').getList(1, 200, {
            filter: inFilter('id', tableIds),
            fields: 'id,number',
          }).then(r => Object.fromEntries(r.items.map((t: any) => [t.id, t])))
        : Promise.resolve({} as Record<string, any>),
      sessionIds.length > 0
        ? pb.collection('table_sessions').getList(1, 200, {
            filter: inFilter('id', sessionIds),
            fields: 'id,guest_name',
          }).then(r => Object.fromEntries(r.items.map((s: any) => [s.id, s])))
        : Promise.resolve({} as Record<string, any>),
    ])

    // Monta mapa order_id → order_items em memória
    const orderItemsByOrder = new Map<string, any[]>()
    for (const oi of allOrderItems) {
      if (!orderItemsByOrder.has(oi.order_id)) orderItemsByOrder.set(oi.order_id, [])
      const mi = menuItemMap[oi.menu_item_id]
      orderItemsByOrder.get(oi.order_id)!.push({
        ...oi,
        menu_item: mi ? { name: mi.name, price: mi.price } : null,
      })
    }

    const enrichedOrders = orders.map((order: any) => ({
      ...order,
      table: tableMap[order.table_id] ? { number: tableMap[order.table_id].number } : undefined,
      session: sessionMap[order.session_id] ? { guest_name: sessionMap[order.session_id].guest_name } : null,
      order_items: orderItemsByOrder.get(order.id) ?? [],
    }))

    return NextResponse.json({ orders: enrichedOrders })
  } catch (err: any) {
    console.error('[GET /api/pedidos] erro:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
