import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import AdminSidebar from '@/components/shared/AdminSidebar'
import AdminShell from '@/components/shared/AdminShell'
import UpdateNotifier from '@/components/shared/UpdateNotifier'
import ElectronBridge from '@/components/shared/ElectronBridge'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null

  if (!session || session.role !== 'manager') redirect('/login')

  // Busca nome atualizado do restaurante
  let restaurantName = 'Meu Restaurante'
  if (session.restaurantId) {
    try {
      const pb = createAdminClient()
      const restaurant = await pb.collection('restaurants').getOne(session.restaurantId)
      restaurantName = restaurant.name ?? restaurantName
    } catch {}
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-100">
      <AdminSidebar
        managerName={session.name}
        restaurantName={restaurantName}
        restaurantId={session.restaurantId ?? ''}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminShell>{children}</AdminShell>
      </div>
      <UpdateNotifier />
      <ElectronBridge restaurantId={session.restaurantId ?? ''} />
    </div>
  )
}
