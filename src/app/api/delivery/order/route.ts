import { createAdminClient } from '@/lib/pb/server'
import { verifyDeliverySessionToken, createDeliverySessionToken } from '@/lib/delivery-session'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// POST /api/delivery/order — cria pedido de delivery
export async function POST(req: Request) {
  try {
    return await handlePost(req)
  } catch (err: any) {
    console.error('[POST /api/delivery/order] erro:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}

async function handlePost(req: Request) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('delivery_session')?.value
  if (!sessionToken) {
    return NextResponse.json({ error: 'Sessão expirada. Acesse o link novamente.' }, { status: 401 })
  }

  const session = await verifyDeliverySessionToken(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'Sessão inválida. Acesse o link novamente.' }, { status: 401 })
  }

  const { items } = await req.json() as {
    items: { menuItemId: string; quantity: number; unitPrice: number; notes?: string }[]
  }

  if (!items?.length) {
    return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 })
  }

  const pb = createAdminClient()
  const { restaurantId, guestName, guestPhone } = session

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

  // Gera código sequencial
  let orderCode = 1
  try {
    const seq = await pb.collection('order_sequences').getFirstListItem(
      `restaurant_id = "${restaurantId}"`
    )
    orderCode = (seq.last_code ?? 0) + 1
    await pb.collection('order_sequences').update(seq.id, { last_code: orderCode })
  } catch {
    try {
      await pb.collection('order_sequences').create({ restaurant_id: restaurantId, last_code: 1 })
    } catch {}
    orderCode = 1
  }

  // Calcula total
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  // Cria o pedido com campos de delivery
  const order = await pb.collection('orders').create({
    restaurant_id: restaurantId,
    table_id: null,
    session_id: null,
    customer_id: null,
    status: 'open',
    total,
    code: orderCode,
    payment_status: 'pending',
    delivery_name: guestName,
    delivery_phone: guestPhone,
  })

  // Insere os itens
  for (const item of items) {
    await pb.collection('order_items').create({
      restaurant_id: restaurantId,
      order_id: order.id,
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      notes: item.notes ?? null,
    })
  }

  // Roteia por impressora e cria print_jobs
  const printerBuckets: Record<string, typeof items[number][]> = {}
  for (const item of items) {
    const mi = menuItemsData.find(m => m.id === item.menuItemId)
    const printer = mi?.category?.printer || 'kitchen'
    if (!printerBuckets[printer]) printerBuckets[printer] = []
    printerBuckets[printer].push(item)
  }

  for (const [printer, printerItems] of Object.entries(printerBuckets)) {
    try {
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
        table_number: null,
        guest_name: guestName,
        order_code: orderCode,
      })
    } catch {}
  }

  const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://')
  const updatedToken = await createDeliverySessionToken({
    restaurantId: session.restaurantId,
    restaurantSlug: session.restaurantSlug,
    guestName: session.guestName,
    guestPhone: session.guestPhone,
    orderId: order.id,
  })

  const res = NextResponse.json({ ok: true, orderCode, orderId: order.id })
  res.cookies.set('delivery_session', updatedToken, {
    path: '/',
    maxAge: 60 * 60 * 4,
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
  })
  return res
}
