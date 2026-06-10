import { createAdminClient, inFilter } from '@/lib/pb/server'
import { NextResponse } from 'next/server'

// POST /api/orders
export async function POST(req: Request) {
  try {
    return await handlePost(req)
  } catch (err: any) {
    const fieldErrors = err?.data?.data
    const detail = fieldErrors
      ? Object.entries(fieldErrors).map(([k, v]: any) => `${k}: ${v?.message}`).join(', ')
      : null
    console.error('[POST /api/orders] erro:', err?.message, fieldErrors ?? err?.data)
    return NextResponse.json({ error: detail ?? err?.data?.message ?? err?.message ?? 'Erro interno' }, { status: 500 })
  }
}

async function handlePost(req: Request) {
  const { tableId, sessionId, items } = await req.json() as {
    tableId: string
    sessionId?: string
    items: { menuItemId: string; quantity: number; unitPrice: number; notes?: string }[]
  }

  if (!tableId || !items?.length) {
    return NextResponse.json({ error: 'tableId e items são obrigatórios' }, { status: 400 })
  }

  const pb = createAdminClient()

  // Usa table_id da sessão como fonte de verdade (suporta troca de mesa automática)
  let currentTableId = tableId
  if (sessionId) {
    try {
      const session = await pb.collection('table_sessions').getOne(sessionId)
      if (session.table_id) currentTableId = session.table_id
    } catch {}
  }

  let table: any
  try {
    table = await pb.collection('tables').getOne(currentTableId)
  } catch {
    return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })
  }

  const restaurantId = table.restaurant_id

  // Batch: busca todos menu_items e categorias de uma vez
  const menuItemIds = [...new Set(items.map(i => i.menuItemId))]
  const { items: menuItemsRaw } = await pb.collection('menu_items').getList(1, 200, {
    filter: inFilter('id', menuItemIds),
  })
  const categoryIds = [...new Set(menuItemsRaw.map((m: any) => m.category_id).filter(Boolean))] as string[]
  let catMap: Record<string, any> = {}
  if (categoryIds.length > 0) {
    const { items: cats } = await pb.collection('menu_categories').getList(1, 100, {
      filter: inFilter('id', categoryIds),
    })
    catMap = Object.fromEntries(cats.map((c: any) => [c.id, c]))
  }
  const menuItemsData = menuItemsRaw.map((mi: any) => ({ ...mi, category: catMap[mi.category_id] ?? null }))

  // Gera código sequencial atômico
  let orderCode = 1
  try {
    const seq = await pb.collection('order_sequences').getFirstListItem(
      `restaurant_id = "${restaurantId}"`
    )
    orderCode = (seq.last_code ?? 0) + 1
    await pb.collection('order_sequences').update(seq.id, { last_code: orderCode })
  } catch {
    // Não existe ainda — cria
    await pb.collection('order_sequences').create({ restaurant_id: restaurantId, last_code: 1 })
    orderCode = 1
  }

  // Cria o pedido
  let order: any
  try {
    order = await pb.collection('orders').create({
      restaurant_id: restaurantId,
      table_id: currentTableId,
      session_id: sessionId ?? null,
      customer_id: null,
      status: 'open',
      total: 0,
      code: orderCode,
      payment_status: 'pending',
      placed_at: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao criar pedido' }, { status: 500 })
  }

  // Insere os itens em paralelo e calcula total
  let total = 0
  for (const item of items) total += item.quantity * item.unitPrice
  await Promise.all(items.map(item =>
    pb.collection('order_items').create({
      restaurant_id: restaurantId,
      order_id: order.id,
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      notes: item.notes ?? null,
    })
  ))

  // Atualiza total do pedido
  await pb.collection('orders').update(order.id, { total })

  // Nome do convidado para ticket de impressão (reutiliza sessão já buscada no início)
  let guestName: string | null = null
  if (sessionId) {
    try {
      const sess = await pb.collection('table_sessions').getOne(sessionId)
      guestName = sess.guest_name ?? null
    } catch {}
  }

  // Roteia itens por impressora e cria print_jobs
  const printerBuckets: Record<string, typeof items[number][]> = {}
  for (const item of items) {
    const mi = menuItemsData.find(m => m.id === item.menuItemId)
    const printer = mi?.category?.printer || 'kitchen'
    if (!printerBuckets[printer]) printerBuckets[printer] = []
    printerBuckets[printer].push(item)
  }

  for (const [printer, printerItems] of Object.entries(printerBuckets)) {
    await pb.collection('print_jobs').create({
      restaurant_id: restaurantId,
      order_id: order.id,
      printer,
      items: printerItems.map(i => {
        const mi = menuItemsData.find(m => m.id === i.menuItemId)
        return {
          menu_item_id: i.menuItemId,
          name: mi?.name ?? 'Item',
          quantity: i.quantity,
          unit_price: i.unitPrice,
          notes: i.notes ?? null,
        }
      }),
      table_number: table.number,
      guest_name: guestName,
      order_code: orderCode,
    })
  }

  // Garante que a mesa está ocupada
  await pb.collection('tables').update(currentTableId, { status: 'occupied' })

  return NextResponse.json({ orderId: order.id, orderCode, restaurantId })
}
