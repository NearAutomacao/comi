import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSessionToken } from '@/lib/auth-session'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null

  if (!session) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))

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
  url.searchParams.set('state', session.userId)

  return NextResponse.redirect(url.toString())
}
