import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) redirect('/login')

  return (
    <DashboardClient
      restaurantId={session.restaurantId ?? ''}
      initialRevenue={0}
      initialOrders={0}
      initialOccupied={0}
      initialTotal={0}
      initialReservations={0}
    />
  )
}
