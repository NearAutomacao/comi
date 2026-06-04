import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPaymentById } from '@/lib/mercadopago/client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, data } = body

    if (type !== 'payment' || !data?.id) return NextResponse.json({ ok: true })

    const supabase = await createAdminClient()
    const externalRef = String(data.external_reference ?? '')

    if (!externalRef.startsWith('reservation:')) return NextResponse.json({ ok: true })

    const reservationId = externalRef.replace('reservation:', '')

    // Buscar restaurant_id da reserva para usar o token correto
    const { data: reservation } = await supabase
      .from('reservations')
      .select('restaurant_id')
      .eq('id', reservationId)
      .single()

    if (!reservation?.restaurant_id) return NextResponse.json({ ok: true })

    const payment = await getPaymentById(String(data.id), reservation.restaurant_id)

    if (payment.status === 'approved') {
      await supabase.from('reservations').update({
        payment_status: 'paid',
        payment_id: String(data.id),
        status: 'confirmed',
      }).eq('id', reservationId)

      await supabase.from('payments').insert({
        restaurant_id: reservation.restaurant_id,
        reservation_id: reservationId,
        method: payment.payment_method_id?.includes('pix') ? 'pix' : 'credit_card',
        amount: payment.transaction_amount ?? 0,
        status: 'approved',
        mercadopago_id: String(data.id),
      })
    } else if (payment.status === 'rejected') {
      await supabase.from('reservations').update({
        payment_status: 'unpaid',
        status: 'cancelled',
      }).eq('id', reservationId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
