import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import ReservasAdmin from '@/components/reservas/ReservasAdmin'

export default async function ReservasAdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session || session.role !== 'manager') redirect('/login')

  const restaurantId = session.restaurantId ?? ''
  const today = new Date().toISOString().split('T')[0]
  const pb = createAdminClient()

  let reservations: any[] = []
  if (restaurantId) {
    try {
      const { items } = await pb.collection('reservations').getList(1, 200, {
        filter: `restaurant_id = "${restaurantId}" && date >= "${today}"`,
        sort: 'date,time',
      })

      reservations = await Promise.all(
        items.map(async (r: any) => {
          const [tableResult, customerResult] = await Promise.allSettled([
            r.table_id ? pb.collection('tables').getOne(r.table_id) : Promise.resolve(null),
            r.customer_id ? pb.collection('users').getOne(r.customer_id) : Promise.resolve(null),
          ])
          const table = tableResult.status === 'fulfilled' ? tableResult.value : null
          const customer = customerResult.status === 'fulfilled' ? customerResult.value : null
          return {
            ...r,
            table: table ? { number: (table as any).number } : null,
            customer: customer ? { name: (customer as any).name, phone: (customer as any).phone ?? null } : null,
          }
        })
      )
    } catch {}
  }

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Reservas</h1>
      <ReservasAdmin initialReservations={reservations} />
    </div>
  )
}
