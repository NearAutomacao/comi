import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/pb/server'

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

    // Busca nome/email do usuário MP para exibir na tela
    let mpUserName = ''
    try {
      const meRes = await fetch(`https://api.mercadopago.com/users/${tokenData.user_id}`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (meRes.ok) {
        const me = await meRes.json()
        const parts = [me.first_name, me.last_name].filter(Boolean)
        mpUserName = parts.length > 0 ? parts.join(' ') : (me.email ?? '')
      }
    } catch {}

    // Find restaurant by owner_id and update tokens
    const pb = createAdminClient()
    const { items } = await pb.collection('restaurants').getList(1, 1, {
      filter: `owner_id = "${userId}"`,
    })

    if (items.length > 0) {
      await pb.collection('restaurants').update(items[0].id, {
        mp_access_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token ?? null,
        mp_public_key: tokenData.public_key ?? null,
        mp_user_id: String(tokenData.user_id ?? ''),
        mp_user_name: mpUserName,
      })
    }

    return NextResponse.redirect(`${appUrl}/admin/configuracoes?mp=success`)
  } catch (err) {
    console.error('MP callback error:', err)
    return NextResponse.redirect(`${appUrl}/admin/configuracoes?mp=error`)
  }
}
