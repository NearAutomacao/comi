import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { tableId, guestName, guestPhone } = await req.json()

  if (!tableId || !guestName?.trim() || !guestPhone?.trim()) {
    return NextResponse.json({ error: 'tableId, nome e telefone são obrigatórios' }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { data: table, error } = await admin
    .from('tables')
    .select('id, number, restaurant_id')
    .eq('id', tableId)
    .single()

  if (error || !table) {
    return NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 })
  }

  // Marca mesa como ocupada e salva dados do convidado
  await admin
    .from('tables')
    .update({ status: 'occupied', guest_name: guestName.trim(), guest_phone: guestPhone.trim() })
    .eq('id', tableId)

  // Registra no histórico
  await admin.from('table_sessions').insert({
    restaurant_id: table.restaurant_id,
    table_id: tableId,
    guest_name: guestName.trim(),
    guest_phone: guestPhone.trim(),
  })

  const response = NextResponse.json({
    ok: true,
    tableNumber: table.number,
    restaurantId: table.restaurant_id,
  })

  // Cookie para o servidor saber qual restaurante exibir no cardápio
  response.cookies.set('comi_restaurant_id', table.restaurant_id, {
    path: '/',
    maxAge: 60 * 60 * 8, // 8h
    sameSite: 'lax',
    httpOnly: false,
  })

  return response
}
