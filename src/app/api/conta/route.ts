import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/conta?tableId=xxx
// Retorna pedidos abertos da mesa com informações de sessão (comanda por pessoa)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tableId = searchParams.get('tableId')
  if (!tableId) return NextResponse.json({ error: 'tableId required' }, { status: 400 })

  const admin = await createAdminClient()

  const { data: orders, error } = await admin
    .from('orders')
    .select(`
      id, total, status, created_at, restaurant_id, code, session_id,
      order_items(id, quantity, unit_price, notes, menu_item:menu_items(name))
    `)
    .eq('table_id', tableId)
    .in('status', ['open', 'preparing', 'served'])
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Busca nomes das sessões para montar visão "por comanda"
  const sessionIds = [...new Set((orders ?? []).map(o => o.session_id).filter(Boolean))]
  let sessions: { id: string; guest_name: string }[] = []
  if (sessionIds.length > 0) {
    const { data } = await admin
      .from('table_sessions')
      .select('id, guest_name')
      .in('id', sessionIds)
    sessions = data ?? []
  }

  return NextResponse.json({ orders: orders ?? [], sessions })
}

// POST /api/conta
// Registra pagamento, fecha pedidos, libera mesa
export async function POST(req: Request) {
  const body = await req.json()
  const { tableId, payments } = body as {
    tableId: string
    payments: {
      order_id: string
      restaurant_id: string
      method: 'credit_card' | 'debit_card' | 'pix' | 'cash'
      amount: number
    }[]
  }

  if (!tableId || !payments?.length) {
    return NextResponse.json({ error: 'tableId e payments são obrigatórios' }, { status: 400 })
  }

  const admin = await createAdminClient()

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

  const orderIds = [...new Set(payments.map(p => p.order_id))]
  const { error: orderError } = await admin
    .from('orders')
    .update({ status: 'closed', payment_status: 'paid' })
    .in('id', orderIds)
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  // Verifica se ainda há pedidos abertos na mesa (outros clientes)
  const { data: remaining } = await admin
    .from('orders')
    .select('id')
    .eq('table_id', tableId)
    .in('status', ['open', 'preparing', 'served'])

  // Só libera a mesa se não houver mais pedidos abertos
  if (!remaining || remaining.length === 0) {
    await admin
      .from('tables')
      .update({ status: 'empty', guest_name: null, guest_phone: null })
      .eq('id', tableId)

    await admin
      .from('table_sessions')
      .update({ left_at: new Date().toISOString() })
      .eq('table_id', tableId)
      .is('left_at', null)
  }

  return NextResponse.json({ ok: true, tableFreed: !remaining || remaining.length === 0 })
}
