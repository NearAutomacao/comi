import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import ReservasClient from '@/components/reservas/ReservasClient'

export default async function ReservasPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) redirect('/login')

  const userId = session.userId
  const pb = createAdminClient()

  // Busca o primeiro restaurante disponível
  let restaurantId = ''
  try {
    const { items } = await pb.collection('restaurants').getList(1, 1)
    restaurantId = items[0]?.id ?? ''
  } catch {}

  const [tablesResult, hoursResult, closedResult, reservationsResult] = await Promise.allSettled([
    pb.collection('tables').getList(1, 100, {
      filter: `restaurant_id = "${restaurantId}"`,
      sort: 'number',
    }),
    pb.collection('working_hours').getList(1, 7, {
      filter: `restaurant_id = "${restaurantId}"`,
    }),
    pb.collection('closed_dates').getList(1, 200, {
      filter: `restaurant_id = "${restaurantId}"`,
    }),
    pb.collection('reservations').getList(1, 20, {
      filter: `customer_id = "${userId}"`,
      sort: '-date',
    }),
  ])

  const tables = tablesResult.status === 'fulfilled'
    ? (tablesResult.value as any).items.map((t: any) => ({ id: t.id, number: t.number, capacity: t.capacity }))
    : []

  const workingHours = hoursResult.status === 'fulfilled'
    ? (hoursResult.value as any).items
    : []

  const closedDates = closedResult.status === 'fulfilled'
    ? (closedResult.value as any).items.map((d: any) => d.date)
    : []

  const rawReservations = reservationsResult.status === 'fulfilled'
    ? (reservationsResult.value as any).items
    : []

  const myReservations = await Promise.all(
    rawReservations.map(async (r: any) => {
      let table: any = null
      if (r.table_id) {
        try { table = await pb.collection('tables').getOne(r.table_id) } catch {}
      }
      return {
        ...r,
        table: table ? { number: table.number } : null,
      }
    })
  )

  return (
    <ReservasClient
      userId={userId}
      restaurantId={restaurantId}
      tables={tables}
      workingHours={workingHours}
      closedDates={closedDates}
      myReservations={myReservations}
    />
  )
}
