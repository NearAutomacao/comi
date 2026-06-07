import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/license?restaurantId=xxx
// Verifica se a assinatura do restaurante está ativa — usado pelo app Electron no startup
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId')

  if (!restaurantId) {
    return NextResponse.json({ valid: false, reason: 'restaurantId obrigatório' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('subscriptions')
    .select('status, plan, expires_at')
    .eq('restaurant_id', restaurantId)
    .single()

  if (error || !data) {
    return NextResponse.json({ valid: false, reason: 'subscription_not_found' })
  }

  const isActive = data.status === 'active' || data.status === 'trial'
  const isExpired = data.expires_at ? new Date(data.expires_at) < new Date() : false
  const valid = isActive && !isExpired

  return NextResponse.json({
    valid,
    status: data.status,
    plan: data.plan,
    expires_at: data.expires_at,
    reason: !valid
      ? isExpired ? 'expired' : `subscription_${data.status}`
      : undefined,
  })
}
