import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyMesaSessionToken } from '@/lib/mesa-session'

// Apenas estas rotas exigem conta cadastrada (login)
const PROTECTED_AUTH = ['/pedidos', '/reservas']

// Estas rotas exigem sessão de mesa válida (JWT token)
const PROTECTED_MESA = ['/cardapio', '/carrinho', '/conta']

function isProtectedAuth(pathname: string) {
  return PROTECTED_AUTH.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function isProtectedMesa(pathname: string) {
  return PROTECTED_MESA.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let supabaseResponse = NextResponse.next({ request })

  // No-cache no cardápio para sempre mostrar itens frescos
  if (pathname === '/cardapio' || pathname.startsWith('/cardapio/')) {
    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    supabaseResponse.headers.set('Pragma', 'no-cache')
    supabaseResponse.headers.set('Expires', '0')
  }

  // Validação JWT para rotas de mesa (sem autenticação)
  if (isProtectedMesa(pathname)) {
    const token = request.cookies.get('mesa_session')?.value

    if (!token) {
      // Sem token: redireciona para /
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    const session = await verifyMesaSessionToken(token)
    if (!session) {
      // Token inválido/expirado: limpa cookies e redireciona
      const url = request.nextUrl.clone()
      url.pathname = '/'
      const response = NextResponse.redirect(url)
      response.cookies.delete('mesa_session')
      response.cookies.delete('comi_restaurant_id')
      return response
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'comi' },
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          if (pathname === '/cardapio' || pathname.startsWith('/cardapio/')) {
            supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            supabaseResponse.headers.set('Pragma', 'no-cache')
            supabaseResponse.headers.set('Expires', '0')
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redireciona rotas protegidas (auth) para /login?next=<path>
  if (!user && isProtectedAuth(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
