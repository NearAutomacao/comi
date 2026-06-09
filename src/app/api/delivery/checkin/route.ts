import { createAdminClient } from '@/lib/pb/server'
import { createDeliverySessionToken } from '@/lib/delivery-session'
import { NextResponse } from 'next/server'

// POST /api/delivery/checkin — valida nome+fone, cria sessão de delivery
export async function POST(req: Request) {
  try {
    const { slug, guestName, guestPhone } = await req.json()
    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://')

    if (!slug) return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 })
    if (!guestName?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    if (!guestPhone?.trim()) return NextResponse.json({ error: 'WhatsApp obrigatório' }, { status: 400 })

    const nameParts = guestName.trim().split(/\s+/).filter(Boolean)
    if (nameParts.length < 2) {
      return NextResponse.json({ error: 'Informe nome e sobrenome' }, { status: 400 })
    }

    const pb = createAdminClient()

    let restaurant: any
    try {
      const { items } = await pb.collection('restaurants').getList(1, 1, {
        filter: `slug = "${slug}"`,
      })
      restaurant = items[0]
    } catch {}

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })
    }

    const token = await createDeliverySessionToken({
      restaurantId: restaurant.id,
      restaurantSlug: slug,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
    })

    const res = NextResponse.json({ ok: true, restaurantName: restaurant.name })

    res.cookies.set('delivery_session', token, {
      path: '/',
      maxAge: 60 * 60 * 4,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
    })

    return res
  } catch (err: any) {
    console.error('[POST /api/delivery/checkin] erro:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
