import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPaymentById } from '@/lib/mercadopago/client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, data } = body

    if (type !== 'payment' || !data?.id) {
      return NextResponse.json({ ok: true })
    }

    const payment = await getPaymentById(String(data.id))
    const externalRef = payment.external_reference ?? ''

    if (!externalRef.startsWith('reservation:')) {
      return NextResponse.json({ ok: true })
    }

    const reservationId = externalRef.replace('reservation:', '')
    const supabase = await createAdminClient()

    if (payment.status === 'approved') {
      await supabase.from('reservations').update({
        payment_status: 'paid',
        payment_id: String(data.id),
        status: 'confirmed',
      }).eq('id', reservationId)

      await supabase.from('payments').insert({
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
