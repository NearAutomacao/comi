import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/shared/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'manager') redirect('/cardapio')

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar managerName={profile.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
