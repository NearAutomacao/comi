import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/shared/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Busca perfil e restaurante juntos — comi.profiles é a fonte de verdade do role
  const [{ data: profile }, { data: restaurant }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('restaurants').select('id, name').eq('owner_id', user.id).single(),
  ])

  if (profile?.role !== 'manager') redirect('/login')

  const managerName = user.user_metadata?.name ?? user.email ?? 'Gerente'
  const restaurantName = restaurant?.name ?? 'Meu Restaurante'
  const restaurantId = restaurant?.id ?? ''

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar managerName={managerName} restaurantName={restaurantName} restaurantId={restaurantId} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
