import { NextRequest, NextResponse } from 'next/server'
import { verifyMesaSessionToken } from '@/lib/mesa-session'

/**
 * Middleware que valida acesso a rotas de mesa.
 * Bloqueia tentativas de acessar diretamente via URL sem check-in.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Proteção: rotas que PRECISAM de sessão de mesa válida
  const protectedPatterns = [
    /^\/cardapio/,      // Cardápio só após check-in
    /^\/carrinho/,      // Carrinho só após check-in
    /^\/conta/,         // Conta só após check-in
  ]

  const isProtected = protectedPatterns.some(pattern => pattern.test(pathname))

  if (!isProtected) {
    return NextResponse.next()
  }

  // Tenta obter o token JWT da sessão de mesa
  const token = request.cookies.get('mesa_session')?.value

  // Se não tem token, redireciona para home (sem mesa)
  if (!token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Valida o token
  const session = await verifyMesaSessionToken(token)

  if (!session) {
    // Token inválido ou expirado - remove cookie e redireciona
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.delete('mesa_session')
    response.cookies.delete('comi_restaurant_id')
    return response
  }

  // Token válido - continua
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|\.well-known).*)',
  ],
}
