import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { ComiLandingPage } from '@/components/ComiLandingPage'

export const metadata = {
  title: 'comi — Gestão para restaurantes',
  description: 'Cardápio digital, pedidos em tempo real e pagamento pelo celular para restaurantes e lanchonetes.',
}

export default async function HomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null

  if (session?.role === 'manager') redirect('/admin/dashboard')

  return <ComiLandingPage />
}
