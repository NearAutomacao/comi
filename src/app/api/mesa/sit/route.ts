import { createAdminClient } from '@/lib/supabase/server'
import { createMesaSessionToken } from '@/lib/mesa-session'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: Request) {
  const { tableId, guestName, guestPhone } = await req.json()

  if (!tableId || !guestName?.trim()) {
    return NextResponse.json({ error: 'tableId e nome são obrigatórios' }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { data: table, error } = await admin
    .from('tables')
    .select('id, number, restaurant_id, status, guest_name, guest_phone')
    .eq('id', tableId)
    .single()

  if (error || !table) {
    return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })
  }

  const isJoining = table.status === 'occupied'

  // Primeira pessoa: precisa de telefone e marca a mesa como ocupada
  if (!isJoining) {
    if (!guestPhone?.trim()) {
      return NextResponse.json({ error: 'Telefone é obrigatório para sentar' }, { status: 400 })
    }
    await admin
      .from('tables')
      .update({
        status: 'occupied',
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
      })
      .eq('id', tableId)
  }

  // Cria sessão individual (sempre — seja primeiro ou se juntando)
  const sessionId = uuidv4()
  await admin.from('table_sessions').insert({
    id: sessionId,
    restaurant_id: table.restaurant_id,
    table_id: tableId,
    guest_name: guestName.trim(),
    guest_phone: guestPhone?.trim() ?? '',
  })

  const token = await createMesaSessionToken({
    tableId,
    sessionId,
    guestName: guestName.trim(),
    guestPhone: guestPhone?.trim() ?? '',
    restaurantId: table.restaurant_id,
  })

  const response = NextResponse.json({
    ok: true,
    tableNumber: table.number,
    restaurantId: table.restaurant_id,
    sessionId,
    isJoining,
  })

  response.cookies.set('mesa_session', token, {
    path: '/',
    maxAge: 60 * 60 * 8,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
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
