import { createAdminClient } from '@/lib/pb/server'
import { createMesaSessionToken } from '@/lib/mesa-session'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { tableId, guestName, guestPhone } = await req.json()
  const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://')

  if (!tableId || !guestName?.trim()) {
    return NextResponse.json({ error: 'tableId e nome são obrigatórios' }, { status: 400 })
  }

  const pb = createAdminClient()

  let table: any
  try {
    table = await pb.collection('tables').getOne(tableId)
  } catch {
    return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })
  }

  const isJoining = table.status === 'occupied'

  if (!isJoining) {
    if (!guestPhone?.trim()) {
      return NextResponse.json({ error: 'Telefone é obrigatório para sentar' }, { status: 400 })
    }
    await pb.collection('tables').update(tableId, {
      status: 'occupied',
      guest_name: guestName.trim(),
      guest_phone: guestPhone.trim(),
    })
  }

  // Cria sessão individual (PocketBase gera o ID automaticamente)
  const session = await pb.collection('table_sessions').create({
    restaurant_id: table.restaurant_id,
    table_id: tableId,
    guest_name: guestName.trim(),
    guest_phone: guestPhone?.trim() ?? '',
  })

  const token = await createMesaSessionToken({
    tableId,
    sessionId: session.id,
    guestName: guestName.trim(),
    guestPhone: guestPhone?.trim() ?? '',
    restaurantId: table.restaurant_id,
  })

  const response = NextResponse.json({
    ok: true,
    tableNumber: table.number,
    restaurantId: table.restaurant_id,
    sessionId: session.id,
    isJoining,
  })

  response.cookies.set('mesa_session', token, {
    path: '/',
    maxAge: 60 * 60 * 8,
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
  })

  response.cookies.set('comi_restaurant_id', table.restaurant_id, {
    path: '/',
    maxAge: 60 * 60 * 8,
    sameSite: 'lax',
    httpOnly: false,
  })

  return response
}
