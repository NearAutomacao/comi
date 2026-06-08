import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { createAdminClient } from '@/lib/pb/server'

async function getMPClientForRestaurant(restaurantId: string) {
  const pb = createAdminClient()
  const restaurant = await pb.collection('restaurants').getOne(restaurantId)
  const token = restaurant?.mp_access_token
  if (!token) throw new Error('MercadoPago não conectado. Configure em Admin → Configurações.')
  return new MercadoPagoConfig({ accessToken: token })
}

export async function createReservationPreference(params: {
  restaurantId: string
  reservationId: string
  amount: number
  description: string
  customerEmail: string
  successUrl: string
  failureUrl: string
}) {
  const client = await getMPClientForRestaurant(params.restaurantId)
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

export async function getPaymentById(paymentId: string, restaurantId: string) {
  const client = await getMPClientForRestaurant(restaurantId)
  const payment = new Payment(client)
  return payment.get({ id: paymentId })
}
