import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/shared/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.role ?? user.user_metadata?.role
  if (role !== 'manager') redirect('/cardapio')

  // Busca nome do restaurante (fallback para nome do usuário)
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name')
    .eq('owner_id', user.id)
    .single()

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
