import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createReservationPreference } from '@/lib/mercadopago/client'

export async function POST(request: Request) {
  try {
    const { reservationId } = await request.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: reservation } = await supabase
      .from('reservations')
      .select('*, table:tables(number)')
      .eq('id', reservationId)
      .eq('customer_id', user.id)
      .single()

    if (!reservation) return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })

    const tableNum = (reservation.table as { number: number } | null)?.number ?? '?'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const preference = await createReservationPreference({
      restaurantId: reservation.restaurant_id,
      reservationId,
      amount: 50,
      description: `Reserva — Mesa ${tableNum} em ${reservation.date}`,
      customerEmail: user.email ?? '',
      successUrl: `${appUrl}/reservas?payment=success`,
      failureUrl: `${appUrl}/reservas?payment=failure`,
    })

    return NextResponse.json({
      checkoutUrl: preference.sandbox_init_point ?? preference.init_point,
      preferenceId: preference.id,
    })
  } catch (err) {
    console.error('Payment error:', err)
    return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 })
  }
}
