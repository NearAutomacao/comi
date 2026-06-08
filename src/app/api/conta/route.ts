import { createAdminClient, inFilter } from '@/lib/pb/server'
import { NextResponse } from 'next/server'

// GET /api/conta?tableId=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tableId = searchParams.get('tableId')
  if (!tableId) return NextResponse.json({ error: 'tableId required' }, { status: 400 })

  const pb = createAdminClient()

  const { items: orders } = await pb.collection('orders').getList(1, 50, {
    filter: `table_id = "${tableId}" && (${inFilter('status', ['open', 'preparing', 'served'])})`,
    sort: 'created',
  })

  // Busca itens de cada pedido
  const ordersWithItems = await Promise.all(
    orders.map(async (order: any) => {
      const { items: orderItems } = await pb.collection('order_items').getList(1, 100, {
        filter: `order_id = "${order.id}"`,
      })
      const enrichedItems = await Promise.all(
        orderItems.map(async (item: any) => {
          let menuItem: any = null
          try {
            menuItem = await pb.collection('menu_items').getOne(item.menu_item_id)
          } catch {}
          return { ...item, menu_item: menuItem ? { name: menuItem.name } : null }
        })
      )
      return { ...order, order_items: enrichedItems }
    })
  )

  // Busca nomes das sessões
  const sessionIds = [...new Set(orders.map((o: any) => o.session_id).filter(Boolean))] as string[]
  let sessions: { id: string; guest_name: string }[] = []
  if (sessionIds.length > 0) {
    const { items } = await pb.collection('table_sessions').getList(1, 50, {
      filter: inFilter('id', sessionIds),
    })
    sessions = items.map((s: any) => ({ id: s.id, guest_name: s.guest_name }))
  }

  return NextResponse.json({ orders: ordersWithItems, sessions })
}

// POST /api/conta
export async function POST(req: Request) {
  try {
    return await handlePost(req)
  } catch (err: any) {
    console.error('[POST /api/conta] erro:', err?.message, err?.data)
    const detail = err?.data?.data
      ? Object.entries(err.data.data).map(([k, v]: any) => `${k}: ${v?.message}`).join(', ')
      : null
    return NextResponse.json({ error: detail ?? err?.data?.message ?? err?.message ?? 'Erro interno' }, { status: 500 })
  }
}

async function handlePost(req: Request) {
  const body = await req.json()
  const { tableId, payments, skipPayment } = body as {
    tableId: string
    skipPayment?: boolean
    payments?: {
      order_id: string
      restaurant_id: string
      method: 'credit_card' | 'debit_card' | 'pix' | 'cash'
      amount: number
    }[]
  }

  if (!tableId) {
    return NextResponse.json({ error: 'tableId é obrigatório' }, { status: 400 })
  }
  if (!skipPayment && !payments?.length) {
    return NextResponse.json({ error: 'payments é obrigatório quando skipPayment não é true' }, { status: 400 })
  }

  const pb = createAdminClient()

  // Registra pagamentos
  if (!skipPayment && payments?.length) {
    for (const p of payments) {
      await pb.collection('payments').create({
        restaurant_id: p.restaurant_id,
        order_id: p.order_id,
        method: p.method,
        amount: p.amount,
        status: 'approved',
        installments: 1,
      })
    }
  }

  // Determina quais pedidos fechar
  let orderIds: string[]
  if (skipPayment) {
    const { items: openOrders } = await pb.collection('orders').getList(1, 50, {
      filter: `table_id = "${tableId}" && (${inFilter('status', ['open', 'preparing', 'served'])})`,
    })
    orderIds = openOrders.map((o: any) => o.id)
  } else {
    orderIds = [...new Set((payments ?? []).map(p => p.order_id))]
  }

  for (const orderId of orderIds) {
    await pb.collection('orders').update(orderId, {
      status: 'closed',
      payment_status: skipPayment ? 'pending' : 'paid',
    })
  }

  // Verifica se ainda há pedidos abertos
  const { items: remaining } = await pb.collection('orders').getList(1, 5, {
    filter: `table_id = "${tableId}" && (${inFilter('status', ['open', 'preparing', 'served'])})`,
  })

  if (remaining.length === 0) {
    await pb.collection('tables').update(tableId, {
      status: 'empty',
      guest_name: null,
      guest_phone: null,
    })

    // Encerra sessões ativas da mesa
    const { items: activeSessions } = await pb.collection('table_sessions').getList(1, 20, {
      filter: `table_id = "${tableId}" && (left_at = null || left_at = "")`,
    })
    for (const s of activeSessions) {
      await pb.collection('table_sessions').update(s.id, {
        left_at: new Date().toISOString(),
      })
    }
  }

  return NextResponse.json({ ok: true, tableFreed: remaining.length === 0 })
}
