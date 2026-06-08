import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) redirect('/login')

  const restaurantId = session.restaurantId ?? ''
  const pb = createAdminClient()

  const today = new Date().toISOString().split('T')[0]

  let todayOrders: any[] = []
  let occupiedTables: any[] = []
  let pendingReservations: any[] = []
  let totalTables: any[] = []

  try {
    const [r1, r2, r3, r4] = await Promise.all([
      pb.collection('orders').getList(1, 500, {
        filter: `restaurant_id = "${restaurantId}" && created >= "${today} 00:00:00" && status != "cancelled"`,
      }),
      pb.collection('tables').getList(1, 100, {
        filter: `restaurant_id = "${restaurantId}" && status = "occupied"`,
      }),
      pb.collection('reservations').getList(1, 100, {
        filter: `restaurant_id = "${restaurantId}" && date = "${today}" && (status = "pending" || status = "confirmed")`,
      }),
      pb.collection('tables').getList(1, 100, {
        filter: `restaurant_id = "${restaurantId}"`,
      }),
    ])
    todayOrders = r1.items
    occupiedTables = r2.items
    pendingReservations = r3.items
    totalTables = r4.items
  } catch (err) {
    console.error('[dashboard] erro ao buscar dados:', err)
  }

  return (
    <DashboardClient
      restaurantId={restaurantId}
      initialRevenue={todayOrders.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0)}
      initialOrders={todayOrders.length}
      initialOccupied={occupiedTables.length}
      initialTotal={totalTables.length}
      initialReservations={pendingReservations.length}
    />
  )
}
