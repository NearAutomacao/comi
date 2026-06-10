import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import AdminSidebar from '@/components/shared/AdminSidebar'
import AdminShell from '@/components/shared/AdminShell'
import UpdateNotifier from '@/components/shared/UpdateNotifier'
import ElectronBridge from '@/components/shared/ElectronBridge'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null

  if (!session || session.role !== 'manager') redirect('/login')

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-100">
      <AdminSidebar
        managerName={session.name}
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
