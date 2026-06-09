import { createAdminClient } from '@/lib/pb/server'
import { NextResponse } from 'next/server'

// POST /api/orders/items — adiciona itens a um pedido existente
export async function POST(req: Request) {
  try {
    return await handlePost(req)
  } catch (err: any) {
    console.error('[POST /api/orders/items] erro:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}

async function handlePost(req: Request) {
  const { orderId, restaurantId, items } = await req.json() as {
    orderId: string
    restaurantId: string
    items: { menuItemId: string; quantity: number; unitPrice: number }[]
  }

  if (!orderId || !items?.length) {
    return NextResponse.json({ error: 'orderId e items são obrigatórios' }, { status: 400 })
  }

  const pb = createAdminClient()

  let order: any
  try {
    order = await pb.collection('orders').getOne(orderId)
  } catch {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  const restId = restaurantId || order.restaurant_id

  // Busca dados do cardápio para roteamento de impressora
  const menuItemsData: any[] = []
  for (const item of items) {
    try {
      const mi = await pb.collection('menu_items').getOne(item.menuItemId)
      let cat: any = null
      if (mi.category_id) {
        try { cat = await pb.collection('menu_categories').getOne(mi.category_id) } catch {}
      }
      menuItemsData.push({ ...mi, category: cat })
    } catch {}
  }

  // Insere os novos itens
  let addedTotal = 0
  for (const item of items) {
    const subtotal = item.quantity * item.unitPrice
    addedTotal += subtotal
    await pb.collection('order_items').create({
      restaurant_id: restId,
      order_id: orderId,
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      notes: null,
    })
  }

  // Atualiza total do pedido
  const newTotal = (order.total ?? 0) + addedTotal
  await pb.collection('orders').update(orderId, { total: newTotal })

  // Cria print jobs para os novos itens
  let table: any = null
  try { table = await pb.collection('tables').getOne(order.table_id) } catch {}

  const printerBuckets: Record<string, typeof items[number][]> = {}
  for (const item of items) {
    const mi = menuItemsData.find(m => m.id === item.menuItemId)
    const printer = mi?.category?.printer ?? 'kitchen'
    if (!printerBuckets[printer]) printerBuckets[printer] = []
    printerBuckets[printer].push(item)
  }

  for (const [printer, printerItems] of Object.entries(printerBuckets)) {
    await pb.collection('print_jobs').create({
      restaurant_id: restId,
      order_id: orderId,
      printer,
      items: printerItems.map(i => {
        const mi = menuItemsData.find(m => m.id === i.menuItemId)
        return {
          menu_item_id: i.menuItemId,
          name: mi?.name ?? 'Item',
          quantity: i.quantity,
          unit_price: i.unitPrice,
          notes: null,
        }
      }),
      table_number: table?.number ?? null,
      guest_name: null,
      order_code: order.code ?? null,
    })
  }

  return NextResponse.json({ ok: true, newTotal })
}

