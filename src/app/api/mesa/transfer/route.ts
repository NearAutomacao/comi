import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/mesa/transfer
// Transfere todos os pedidos abertos e sessões ativas de uma mesa para outra
export async function POST(req: Request) {
  const { fromTableId, toTableId } = await req.json() as {
    fromTableId: string
    toTableId: string
  }

  if (!fromTableId || !toTableId) {
    return NextResponse.json({ error: 'fromTableId e toTableId são obrigatórios' }, { status: 400 })
  }

  if (fromTableId === toTableId) {
    return NextResponse.json({ error: 'Mesas de origem e destino são iguais' }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { data: tables } = await admin
    .from('tables')
    .select('id, number, restaurant_id, status, guest_name, guest_phone')
    .in('id', [fromTableId, toTableId])

  const fromTable = tables?.find(t => t.id === fromTableId)
  const toTable = tables?.find(t => t.id === toTableId)

  if (!fromTable || !toTable) {
    return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })
  }
  if (fromTable.restaurant_id !== toTable.restaurant_id) {
    return NextResponse.json({ error: 'Mesas de restaurantes diferentes' }, { status: 400 })
  }
  if (toTable.status === 'occupied') {
    return NextResponse.json({ error: 'Mesa destino já está ocupada' }, { status: 409 })
  }
  if (fromTable.status !== 'occupied') {
    return NextResponse.json({ error: 'Mesa de origem não está ocupada' }, { status: 400 })
  }

  // Transfere pedidos abertos
  await admin
    .from('orders')
    .update({ table_id: toTableId })
    .eq('table_id', fromTableId)
    .in('status', ['open', 'preparing', 'served'])

  // Transfere sessões ativas (sem left_at)
  // Como a FK do JWT aponta para sessionId (não tableId), os tokens dos clientes
  // continuam válidos — o table_id é consultado do banco em tempo real
  await admin
    .from('table_sessions')
    .update({ table_id: toTableId })
    .eq('table_id', fromTableId)
    .is('left_at', null)

  // Transfere print_jobs não impressos
  await admin
    .from('print_jobs')
    .update({ table_number: toTable.number })
    .eq('restaurant_id', fromTable.restaurant_id)
    .is('printed_at', null)
    .in(
      'order_id',
      (await admin
        .from('orders')
        .select('id')
        .eq('table_id', toTableId)
        .in('status', ['open', 'preparing', 'served'])
        .then(r => r.data?.map(o => o.id) ?? []))
    )

  // Ocupa mesa destino com dados da origem
  await admin
    .from('tables')
    .update({
      status: 'occupied',
      guest_name: fromTable.guest_name,
      guest_phone: fromTable.guest_phone,
    })
    .eq('id', toTableId)

  // Libera mesa origem
  await admin
    .from('tables')
    .update({ status: 'empty', guest_name: null, guest_phone: null })
    .eq('id', fromTableId)

  return NextResponse.json({
    ok: true,
    fromTableNumber: fromTable.number,
    toTableNumber: toTable.number,
  })
}
