import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import ConfiguracoesClient from '@/components/admin/ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) redirect('/login')

  const restaurantId = session.restaurantId ?? ''
  const pb = createAdminClient()

  let restaurant: any = null
  try {
    restaurant = await pb.collection('restaurants').getOne(restaurantId)
  } catch {}

  let workingHours: any[] = []
  let closedDates: any[] = []
  try {
    const [hoursResult, datesResult] = await Promise.all([
      pb.collection('working_hours').getList(1, 7, {
        filter: `restaurant_id = "${restaurantId}"`,
        sort: 'day_of_week',
      }),
      pb.collection('closed_dates').getList(1, 100, {
        filter: `restaurant_id = "${restaurantId}"`,
        sort: 'date',
      }),
    ])
    workingHours = hoursResult.items
    closedDates = datesResult.items
  } catch (err) {
    console.error('[configuracoes] erro ao buscar dados:', err)
  }

  if (workingHours.length === 0 && restaurantId) {
    try {
      const created = await Promise.all(
        [0, 1, 2, 3, 4, 5, 6].map(d =>
          pb.collection('working_hours').create({
            restaurant_id: restaurantId,
            day_of_week: d,
            open_time: '11:00',
            close_time: '23:00',
            is_open: true,
          })
        )
      )
      workingHours = created.sort((a: any, b: any) => a.day_of_week - b.day_of_week)
    } catch (err) {
      console.error('[configuracoes] erro ao criar horários padrão:', err)
    }
  }

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Configurações</h1>
      <ConfiguracoesClient
        restaurant={restaurant}
        initialHours={workingHours as any}
        initialClosedDates={closedDates as any}
      />
    </div>
  )
}
