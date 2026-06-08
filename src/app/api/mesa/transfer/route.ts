import { createAdminClient, inFilter } from '@/lib/pb/server'
import { NextResponse } from 'next/server'

// POST /api/mesa/transfer
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

  const pb = createAdminClient()

  let fromTable: any, toTable: any
  try {
    fromTable = await pb.collection('tables').getOne(fromTableId)
    toTable = await pb.collection('tables').getOne(toTableId)
  } catch {
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
  const { items: openOrders } = await pb.collection('orders').getList(1, 50, {
    filter: `table_id = "${fromTableId}" && (${inFilter('status', ['open', 'preparing', 'served'])})`,
  })
  for (const order of openOrders) {
    await pb.collection('orders').update(order.id, { table_id: toTableId })
  }

  // Transfere sessões ativas (sem left_at)
  const { items: activeSessions } = await pb.collection('table_sessions').getList(1, 50, {
    filter: `table_id = "${fromTableId}" && left_at = null`,
  })
  for (const session of activeSessions) {
    await pb.collection('table_sessions').update(session.id, { table_id: toTableId })
  }

  // Transfere print_jobs não impressos dos pedidos transferidos
  const orderIds = openOrders.map((o: any) => o.id)
  if (orderIds.length > 0) {
    const { items: pendingJobs } = await pb.collection('print_jobs').getList(1, 100, {
      filter: `restaurant_id = "${fromTable.restaurant_id}" && printed_at = null && (${inFilter('order_id', orderIds)})`,
    })
    for (const job of pendingJobs) {
      await pb.collection('print_jobs').update(job.id, { table_number: toTable.number })
    }
  }

  // Ocupa mesa destino com dados da origem
  await pb.collection('tables').update(toTableId, {
    status: 'occupied',
    guest_name: fromTable.guest_name,
    guest_phone: fromTable.guest_phone,
  })

  // Libera mesa origem
  await pb.collection('tables').update(fromTableId, {
    status: 'empty',
    guest_name: null,
    guest_phone: null,
  })

  return NextResponse.json({
    ok: true,
    fromTableNumber: fromTable.number,
    toTableNumber: toTable.number,
  })
}
