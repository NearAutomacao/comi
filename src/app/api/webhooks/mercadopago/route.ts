import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/pb/server'
import { getPaymentById } from '@/lib/mercadopago/client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, data } = body

    if (type !== 'payment' || !data?.id) return NextResponse.json({ ok: true })

    const pb = createAdminClient()
    const externalRef = String(data.external_reference ?? '')

    if (!externalRef.startsWith('reservation:')) return NextResponse.json({ ok: true })

    const reservationId = externalRef.replace('reservation:', '')

    let reservation: any
    try {
      reservation = await pb.collection('reservations').getOne(reservationId)
    } catch {
      return NextResponse.json({ ok: true })
    }

    if (!reservation?.restaurant_id) return NextResponse.json({ ok: true })

    const payment = await getPaymentById(String(data.id), reservation.restaurant_id)

    if (payment.status === 'approved') {
      await pb.collection('reservations').update(reservationId, {
        payment_status: 'paid',
        mercadopago_preference_id: String(data.id),
        status: 'confirmed',
      })

      await pb.collection('payments').create({
        restaurant_id: reservation.restaurant_id,
        reservation_id: reservationId,
        method: payment.payment_method_id?.includes('pix') ? 'pix' : 'credit_card',
        amount: payment.transaction_amount ?? 0,
        status: 'approved',
        mercadopago_payment_id: String(data.id),
      })
    } else if (payment.status === 'rejected') {
      await pb.collection('reservations').update(reservationId, {
        payment_status: 'unpaid',
        status: 'cancelled',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
