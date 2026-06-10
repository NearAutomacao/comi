import { createAdminClient } from '@/lib/pb/server'
import { verifyDeliverySessionToken, createDeliverySessionToken } from '@/lib/delivery-session'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// POST /api/delivery/payment — cria pagamento PIX via MercadoPago
export async function POST(req: Request) {
  try {
    return await handlePost(req)
  } catch (err: any) {
    console.error('[POST /api/delivery/payment] erro:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}

async function handlePost(req: Request) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('delivery_session')?.value
  if (!sessionToken) {
    return NextResponse.json({ error: 'Sessão expirada. Acesse o link novamente.' }, { status: 401 })
  }

  const session = await verifyDeliverySessionToken(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'Sessão inválida. Acesse o link novamente.' }, { status: 401 })
  }

  const { items } = await req.json() as {
    items: { menuItemId: string; quantity: number }[]
  }

  if (!items?.length) {
    return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 })
  }

  const pb = createAdminClient()

  // Busca restaurante e valida que tem MP conectado
  const restaurant = await pb.collection('restaurants').getOne(session.restaurantId)
  if (!restaurant?.mp_access_token) {
    return NextResponse.json(
      { error: 'Pagamento não disponível. O restaurante ainda não configurou o MercadoPago.' },
      { status: 422 }
    )
  }

  // Calcula total com os preços do servidor (nunca confia no cliente)
  let total = 0
  for (const item of items) {
    try {
      const mi = await pb.collection('menu_items').getOne(item.menuItemId)
      total += (mi.price ?? 0) * item.quantity
    } catch {}
  }

  total = Math.round(total * 100) / 100

  if (total <= 0) {
    return NextResponse.json({ error: 'Total inválido' }, { status: 400 })
  }

  // Monta dados do pagador
  const payerEmail = process.env.MP_DEFAULT_PAYER_EMAIL ?? 'cliente@delivery.comi'
  const nameParts = session.guestName.trim().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ') || firstName

  const payer: Record<string, unknown> = {
    email: payerEmail,
    first_name: firstName,
    last_name: lastName,
  }

  // Adiciona telefone se disponível
  const phoneDigits = session.guestPhone.replace(/\D/g, '')
  if (phoneDigits.length >= 10) {
    payer.phone = {
      area_code: phoneDigits.slice(0, 2),
      number: phoneDigits.slice(2),
    }
  }

  // Cria pagamento PIX no MercadoPago
  const idempotencyKey = `comi-delivery-${session.restaurantId}-${session.guestPhone}-${Date.now()}`

  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restaurant.mp_access_token}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: total,
      description: `Pedido delivery - ${restaurant.name}`,
      payment_method_id: 'pix',
      payer,
      metadata: {
        restaurant_id: session.restaurantId,
        guest_name: session.guestName,
        guest_phone: session.guestPhone,
      },
    }),
  })

  const mpData = await mpRes.json()

  if (!mpRes.ok || !mpData.id) {
    console.error('[MP payment create] status:', mpRes.status, 'body:', JSON.stringify(mpData))
    const mpError = mpData?.cause?.[0]?.description ?? mpData?.message ?? null
    return NextResponse.json(
      { error: mpError ?? 'Erro ao gerar pagamento. Tente novamente.' },
      { status: 502 }
    )
  }

  const paymentId = String(mpData.id)
  const txData = mpData.point_of_interaction?.transaction_data ?? {}

  // Atualiza sessão com paymentId
  const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://')
  const updatedToken = await createDeliverySessionToken({
    restaurantId: session.restaurantId,
    restaurantSlug: session.restaurantSlug,
    guestName: session.guestName,
    guestPhone: session.guestPhone,
    orderId: session.orderId ?? null,
    paymentId,
  })

  const res = NextResponse.json({
    ok: true,
    paymentId,
    qrCode: txData.qr_code ?? null,
    qrCodeBase64: txData.qr_code_base64 ?? null,
    amount: total,
  })

  res.cookies.set('delivery_session', updatedToken, {
    path: '/',
    maxAge: 60 * 60 * 4,
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
  })

  return res
}
