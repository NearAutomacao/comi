import { createAdminClient, inFilter } from '@/lib/pb/server'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('comi_admin_session')?.value
    const session = token ? await verifyAdminSessionToken(token) : null
    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const restaurantId = session.restaurantId
    if (!restaurantId) return NextResponse.json({ error: 'Sem restaurante' }, { status: 400 })

    const pb = createAdminClient()

    const { items: tables } = await pb.collection('tables').getList(1, 100, {
      filter: `restaurant_id = "${restaurantId}"`,
      sort: 'number',
    })

    const occupiedIds = tables.filter((t: any) => t.status === 'occupied').map((t: any) => t.id)

    if (occupiedIds.length === 0) {
      return NextResponse.json({ tables: tables.map((t: any) => ({ ...t, current_order: null })) })
    }

    const { items: orders } = await pb.collection('orders').getList(1, 200, {
      filter: `(${inFilter('table_id', occupiedIds)}) && (status = "open" || status = "preparing" || status = "served")`,
      sort: '-code',
    })

    const orderByTable = new Map<string, any>()
    for (const order of orders) {
      if (!orderByTable.has(order.table_id)) orderByTable.set(order.table_id, order)
    }

    const activeOrderIds = Array.from(orderByTable.values()).map((o: any) => o.id)

    if (activeOrderIds.length === 0) {
      return NextResponse.json({ tables: tables.map((t: any) => ({ ...t, current_order: null })) })
    }

    const { items: allOrderItems } = await pb.collection('order_items').getList(1, 2000, {
      filter: inFilter('order_id', activeOrderIds),
    })

    const menuItemIds = [...new Set(allOrderItems.map((i: any) => i.menu_item_id))] as string[]
    const menuItemMap = new Map<string, any>()
    if (menuItemIds.length > 0) {
      const { items: menuItems } = await pb.collection('menu_items').getList(1, 1000, {
        filter: inFilter('id', menuItemIds),
        fields: 'id,name',
      })
      for (const m of menuItems) menuItemMap.set(m.id, m)
    }

    const itemsByOrder = new Map<string, any[]>()
    for (const item of allOrderItems) {
      const arr = itemsByOrder.get(item.order_id) ?? []
      arr.push({ ...item, menu_item: menuItemMap.get(item.menu_item_id) ? { name: menuItemMap.get(item.menu_item_id).name } : null })
      itemsByOrder.set(item.order_id, arr)
    }

    const tablesWithOrders = tables.map((t: any) => {
      const order = orderByTable.get(t.id)
      if (!order) return { ...t, current_order: null }
      return { ...t, current_order: { ...order, order_items: itemsByOrder.get(order.id) ?? [] } }
    })

    return NextResponse.json({ tables: tablesWithOrders })
  } catch (err: any) {
    console.error('[GET /api/mesas] erro:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
