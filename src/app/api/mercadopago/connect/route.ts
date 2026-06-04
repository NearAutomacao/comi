import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))

  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'MERCADOPAGO_CLIENT_ID não configurado' }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/mercadopago/callback`

  const url = new URL('https://auth.mercadopago.com.br/authorization')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('platform_id', 'mp')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', user.id) // state = user_id para identificar o gerente no callback

  return NextResponse.redirect(url.toString())
}
