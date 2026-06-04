import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}/admin/configuracoes?mp=error`)
  }

  try {
    const redirectUri = `${appUrl}/api/mercadopago/callback`

    // Trocar o code pelo access_token
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MERCADOPAGO_CLIENT_ID,
        client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('MP OAuth error:', tokenData)
      return NextResponse.redirect(`${appUrl}/admin/configuracoes?mp=error`)
    }

    // Salvar tokens no restaurante do gerente
    const supabase = await createAdminClient()
    await supabase
      .from('restaurants')
      .update({
        mp_access_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token ?? null,
        mp_public_key: tokenData.public_key ?? null,
        mp_user_id: String(tokenData.user_id ?? ''),
      })
      .eq('owner_id', userId)

    return NextResponse.redirect(`${appUrl}/admin/configuracoes?mp=success`)
  } catch (err) {
    console.error('MP callback error:', err)
    return NextResponse.redirect(`${appUrl}/admin/configuracoes?mp=error`)
  }
}
