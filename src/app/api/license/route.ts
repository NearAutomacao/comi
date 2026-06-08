import { createAdminClient } from '@/lib/pb/server'
import { NextResponse } from 'next/server'

// GET /api/license?restaurantId=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId')

  if (!restaurantId) {
    return NextResponse.json({ valid: false, reason: 'restaurantId obrigatório' }, { status: 400 })
  }

  const pb = createAdminClient()

  try {
    const sub = await pb.collection('subscriptions').getFirstListItem(
      `restaurant_id = "${restaurantId}"`
    )
    const isExpired = sub.expires_at ? new Date(sub.expires_at) < new Date() : false
    const valid = !isExpired

    return NextResponse.json({
      valid,
      plan: sub.plan,
      expires_at: sub.expires_at,
      reason: isExpired ? 'expired' : undefined,
    })
  } catch {
    return NextResponse.json({ valid: false, reason: 'subscription_not_found' })
  }
}
