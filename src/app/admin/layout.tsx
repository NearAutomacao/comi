import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/shared/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verifica role pelo JWT (app_metadata ou user_metadata) — não depende do schema comi
  const role = user.app_metadata?.role ?? user.user_metadata?.role
  const name = user.user_metadata?.name ?? user.email ?? 'Gerente'

  if (role !== 'manager') redirect('/cardapio')

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar managerName={name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
