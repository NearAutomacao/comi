import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/orders
// Cria pedido + itens usando admin client (sem RLS) — suporta convidados sem sessão Supabase
export async function POST(req: Request) {
  const { tableId, items, notes } = await req.json() as {
    tableId: string
    items: { menuItemId: string; quantity: number; unitPrice: number; notes?: string }[]
    notes?: string
  }

  if (!tableId || !items?.length) {
    return NextResponse.json({ error: 'tableId e items são obrigatórios' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Busca restaurant_id da mesa
  const { data: table, error: tableErr } = await admin
    .from('tables')
    .select('restaurant_id')
    .eq('id', tableId)
    .single()

  if (tableErr || !table) {
    return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })
  }

  const restaurantId = table.restaurant_id

  // Cria o pedido
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({ restaurant_id: restaurantId, table_id: tableId, customer_id: null, status: 'open' })
    .select('id, total')
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

  // Garante que a mesa está marcada como ocupada
  await admin
    .from('tables')
    .update({ status: 'occupied' })
    .eq('id', tableId)

  return NextResponse.json({ orderId: order.id, restaurantId })
}
