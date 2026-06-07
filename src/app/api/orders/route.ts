import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/orders
export async function POST(req: Request) {
  const { tableId, sessionId, items, notes } = await req.json() as {
    tableId: string
    sessionId?: string
    items: { menuItemId: string; quantity: number; unitPrice: number; notes?: string }[]
    notes?: string
  }

  if (!tableId || !items?.length) {
    return NextResponse.json({ error: 'tableId e items são obrigatórios' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Usa table_id da sessão como fonte de verdade (suporta troca de mesa automática)
  let currentTableId = tableId
  if (sessionId) {
    const { data: session } = await admin
      .from('table_sessions')
      .select('table_id')
      .eq('id', sessionId)
      .single()
    if (session?.table_id) currentTableId = session.table_id
  }

  const { data: table, error: tableErr } = await admin
    .from('tables')
    .select('restaurant_id, number')
    .eq('id', currentTableId)
    .single()

  if (tableErr || !table) {
    return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })
  }

  const restaurantId = table.restaurant_id

  // Busca itens do cardápio com categoria (para roteamento de impressora)
  const menuItemIds = items.map(i => i.menuItemId)
  const { data: menuItemsData } = await admin
    .from('menu_items')
    .select('id, name, category:menu_categories(printer)')
    .in('id', menuItemIds)

  // Gera código sequencial atômico
  const { data: orderCode } = await admin
    .rpc('next_order_code', { p_restaurant_id: restaurantId })

  // Cria o pedido
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      table_id: currentTableId,
      session_id: sessionId ?? null,
      customer_id: null,
      status: 'open',
      code: orderCode as number,
    })
    .select('id, total, code')
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: orderErr?.message ?? 'Erro ao criar pedido' }, { status: 500 })
  }

  // Insere os itens
  const { error: itemsErr } = await admin.from('order_items').insert(
    items.map(i => ({
      restaurant_id: restaurantId,
      order_id: order.id,
      menu_item_id: i.menuItemId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      notes: i.notes ?? null,
    }))
  )

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  // Nome do convidado para ticket de impressão
  let guestName: string | null = null
  if (sessionId) {
    const { data: session } = await admin
      .from('table_sessions')
      .select('guest_name')
      .eq('id', sessionId)
      .single()
    guestName = session?.guest_name ?? null
  }

  // Roteia itens por impressora e cria print_jobs
  const printerBuckets: Record<string, typeof items[number][]> = {}
  for (const item of items) {
    const mi = menuItemsData?.find(m => m.id === item.menuItemId)
    const printer = (mi?.category as { printer?: string } | null)?.printer ?? 'kitchen'
    if (!printerBuckets[printer]) printerBuckets[printer] = []
    printerBuckets[printer].push(item)
  }

  const printJobInserts = Object.entries(printerBuckets).map(([printer, printerItems]) => ({
    restaurant_id: restaurantId,
    order_id: order.id,
    printer,
    items: printerItems.map(i => {
      const mi = menuItemsData?.find(m => m.id === i.menuItemId)
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
    order_code: order.code,
  }))

  if (printJobInserts.length > 0) {
    await admin.from('print_jobs').insert(printJobInserts)
  }

  // Garante que a mesa está ocupada
  await admin
    .from('tables')
    .update({ status: 'occupied' })
    .eq('id', currentTableId)

  return NextResponse.json({ orderId: order.id, orderCode: order.code, restaurantId })
}
