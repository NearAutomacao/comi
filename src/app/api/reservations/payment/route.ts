import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import { createReservationPreference } from '@/lib/mercadopago/client'

export async function POST(request: Request) {
  try {
    const { reservationId } = await request.json()
    const cookieStore = await cookies()
    const token = cookieStore.get('comi_admin_session')?.value
    const session = token ? await verifyAdminSessionToken(token) : null

    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const pb = createAdminClient()
    let reservation: any
    try {
      reservation = await pb.collection('reservations').getOne(reservationId)
      if (reservation.customer_id !== session.userId) {
        return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
      }
    } catch {
      return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
    }

    let tableNum: string | number = '?'
    if (reservation.table_id) {
      try {
        const table = await pb.collection('tables').getOne(reservation.table_id)
        tableNum = table.number
      } catch {}
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const preference = await createReservationPreference({
      restaurantId: reservation.restaurant_id,
      reservationId,
      amount: 50,
      description: `Reserva — Mesa ${tableNum} em ${reservation.date}`,
      customerEmail: session.email ?? '',
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
