import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/conta?tableId=xxx
// Returns all open orders for a table (bypasses RLS via admin client)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tableId = searchParams.get('tableId')
  if (!tableId) return NextResponse.json({ error: 'tableId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
// Registers payments, closes all orders for the table, frees the table
export async function POST(req: Request) {
  const body = await req.json()
  const { tableId, payments } = body as {
    tableId: string
    payments: { order_id: string; restaurant_id: string; method: string; amount: number }[]
  }

  if (!tableId || !payments?.length) {
    return NextResponse.json({ error: 'tableId and payments required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()

  // Insert payment records
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

  // Close all orders for the table
  const orderIds = [...new Set(payments.map(p => p.order_id))]
  const { error: orderError } = await admin
    .from('orders')
    .update({ status: 'closed', payment_status: 'paid' })
    .in('id', orderIds)
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  // Free the table
  const { error: tableError } = await admin
    .from('tables')
    .update({ status: 'empty' })
    .eq('id', tableId)
  if (tableError) return NextResponse.json({ error: tableError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
