import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ComiLandingPage } from '@/components/ComiLandingPage'

export const metadata = {
  title: 'comi — Gestão para restaurantes',
  description: 'Cardápio digital, pedidos em tempo real e pagamento pelo celular para restaurantes e lanchonetes.',
  icons: {
    icon: [{ url: '/comicon.png', type: 'image/png' }],
  },
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const role = user.app_metadata?.role ?? user.user_metadata?.role
    if (role === 'manager') redirect('/admin/dashboard')
    // Clientes chegam ao cardápio pelo QR code da mesa, não pelo login direto
  }

  return <ComiLandingPage />
}
