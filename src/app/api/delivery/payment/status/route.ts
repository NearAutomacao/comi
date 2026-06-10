import { createAdminClient } from '@/lib/pb/server'
import { verifyDeliverySessionToken } from '@/lib/delivery-session'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// GET /api/delivery/payment/status — verifica status do pagamento em andamento na sessão
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('delivery_session')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    }

    const session = await verifyDeliverySessionToken(sessionToken)
    if (!session) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    if (!session.paymentId) {
      return NextResponse.json({ error: 'Nenhum pagamento em andamento' }, { status: 400 })
    }

    const pb = createAdminClient()
    const restaurant = await pb.collection('restaurants').getOne(session.restaurantId)

    if (!restaurant?.mp_access_token) {
      return NextResponse.json({ error: 'Configuração inválida' }, { status: 422 })
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${session.paymentId}`,
      {
        headers: { 'Authorization': `Bearer ${restaurant.mp_access_token}` },
        // Sem cache para sempre obter status atualizado
        cache: 'no-store',
      }
    )

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error('[MP payment status] erro:', mpData)
      return NextResponse.json({ error: 'Erro ao verificar pagamento' }, { status: 502 })
    }

    // status possíveis: pending, approved, authorized, in_process, rejected, cancelled, refunded, charged_back
    return NextResponse.json({ ok: true, status: mpData.status ?? 'pending' })
  } catch (err: any) {
    console.error('[GET /api/delivery/payment/status] erro:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
