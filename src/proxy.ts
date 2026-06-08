import { NextResponse, type NextRequest } from 'next/server'
import { verifyMesaSessionToken } from '@/lib/mesa-session'
import { verifyAdminSessionToken } from '@/lib/auth-session'

// Rotas que exigem login de gerente
const PROTECTED_AUTH = ['/pedidos', '/reservas']

// Rotas que exigem sessão de mesa válida (JWT token de convidado)
const PROTECTED_MESA = ['/carrinho', '/conta']

function isProtectedAuth(pathname: string) {
  return PROTECTED_AUTH.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function isProtectedMesa(pathname: string) {
  return PROTECTED_MESA.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  // No-cache no cardápio para sempre mostrar itens frescos
  if (pathname === '/cardapio' || pathname.startsWith('/cardapio/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  // Validação JWT para rotas de mesa (convidados sem login)
  if (isProtectedMesa(pathname)) {
    const token = request.cookies.get('mesa_session')?.value
    if (!token) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    const session = await verifyMesaSessionToken(token)
    if (!session) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      const res = NextResponse.redirect(url)
      res.cookies.delete('mesa_session')
      res.cookies.delete('comi_restaurant_id')
      return res
    }
  }

  // Validação JWT para rotas protegidas (gerentes logados)
  if (isProtectedAuth(pathname)) {
    const token = request.cookies.get('comi_admin_session')?.value
    if (!token) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    const session = await verifyAdminSessionToken(token)
    if (!session) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      const res = NextResponse.redirect(url)
      res.cookies.delete('comi_admin_session')
      return res
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
