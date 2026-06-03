import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/server'

async function getMPConfig() {
  const supabase = await createAdminClient()
  const { data } = await supabase
    .from('restaurant_settings')
    .select('mercadopago_access_token')
    .single()

  const token = data?.mercadopago_access_token ?? process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('MercadoPago access token não configurado')

  return new MercadoPagoConfig({ accessToken: token })
}

export async function createReservationPreference(params: {
  reservationId: string
  amount: number
  description: string
  customerEmail: string
  successUrl: string
  failureUrl: string
}) {
  const client = await getMPConfig()
  const preference = new Preference(client)

  const result = await preference.create({
    body: {
      items: [{
        id: params.reservationId,
        title: params.description,
        quantity: 1,
        unit_price: params.amount,
        currency_id: 'BRL',
      }],
      payer: { email: params.customerEmail },
      back_urls: {
        success: params.successUrl,
        failure: params.failureUrl,
        pending: params.successUrl,
      },
      auto_return: 'approved',
      external_reference: `reservation:${params.reservationId}`,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
    },
  })

  return result
}

export async function getPaymentById(paymentId: string) {
  const client = await getMPConfig()
  const payment = new Payment(client)
  return payment.get({ id: paymentId })
}
