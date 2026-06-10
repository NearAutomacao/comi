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

    const [catResult, itemResult] = await Promise.all([
      pb.collection('menu_categories').getList(1, 100, {
        filter: `restaurant_id = "${restaurantId}"`,
        sort: 'display_order',
      }),
      pb.collection('menu_items').getList(1, 500, {
        filter: `restaurant_id = "${restaurantId}"`,
        sort: 'display_order',
      }),
    ])

    const categories = catResult.items
    const items = itemResult.items
    const itemIds = items.map((i: any) => i.id)

    let costItems: any[] = []
    if (itemIds.length > 0) {
      const { items: ci } = await pb.collection('cost_items').getList(1, 2000, {
        filter: inFilter('menu_item_id', itemIds),
      })
      costItems = ci
    }

    const costByItem = new Map<string, any[]>()
    for (const ci of costItems) {
      const arr = costByItem.get(ci.menu_item_id) ?? []
      arr.push(ci)
      costByItem.set(ci.menu_item_id, arr)
    }

    const itemsWithCosts = items.map((item: any) => ({
      ...item,
      cost_items: costByItem.get(item.id) ?? [],
    }))

    return NextResponse.json({ categories, items: itemsWithCosts })
  } catch (err: any) {
    console.error('[GET /api/cardapio] erro:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
