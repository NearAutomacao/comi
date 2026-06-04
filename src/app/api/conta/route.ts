import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/conta?tableId=xxx
// Retorna pedidos abertos de uma mesa — acessível por convidados (sem sessão)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tableId = searchParams.get('tableId')
  if (!tableId) return NextResponse.json({ error: 'tableId required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: orders, error } = await admin
    .from('orders')
    .select('id, total, status, created_at, restaurant_id, order_items(id, quantity, unit_price, menu_item:menu_items(name))')
    .eq('table_id', tableId)
    .in('status', ['open', 'preparing', 'served'])
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ orders: orders ?? [] })
}

// POST /api/conta
// Registra pagamento, fecha pedidos, libera mesa e encerra sessão do convidado
export async function POST(req: Request) {
  const body = await req.json()
  const { tableId, payments } = body as {
    tableId: string
    payments: { order_id: string; restaurant_id: string; method: string; amount: number }[]
  }

  if (!tableId || !payments?.length) {
    return NextResponse.json({ error: 'tableId e payments são obrigatórios' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Registra pagamentos
  const { error: payError } = await admin.from('payments').insert(
    payments.map(p => ({
      restaurant_id: p.restaurant_id,
      order_id: p.order_id,
      method: p.method,
      amount: p.amount,
      status: 'approved',
      installments: 1,
    }))
  )
  if (payError) return NextResponse.json({ error: payError.message }, { status: 500 })

  // Fecha todos os pedidos da mesa
  const orderIds = [...new Set(payments.map(p => p.order_id))]
  const { error: orderError } = await admin
    .from('orders')
    .update({ status: 'closed', payment_status: 'paid' })
    .in('id', orderIds)
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  // Libera a mesa e apaga dados do convidado
  const { error: tableError } = await admin
    .from('tables')
    .update({ status: 'empty', guest_name: null, guest_phone: null })
    .eq('id', tableId)
  if (tableError) return NextResponse.json({ error: tableError.message }, { status: 500 })

  // Marca fim da sessão do convidado
  await admin
    .from('table_sessions')
    .update({ left_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .is('left_at', null)

  return NextResponse.json({ ok: true })
}
