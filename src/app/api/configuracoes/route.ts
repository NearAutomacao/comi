import { createAdminClient } from '@/lib/pb/server'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// GET /api/configuracoes — retorna restaurant, working_hours e closed_dates
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('comi_admin_session')?.value
    const session = token ? await verifyAdminSessionToken(token) : null
    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const restaurantId = session.restaurantId
    if (!restaurantId) return NextResponse.json({ error: 'Sem restaurante' }, { status: 400 })

    const pb = createAdminClient()

    const [restaurant, hoursResult, datesResult] = await Promise.all([
      pb.collection('restaurants').getOne(restaurantId).catch(() => null),
      pb.collection('working_hours').getList(1, 7, {
        filter: `restaurant_id = "${restaurantId}"`,
        sort: 'day_of_week',
      }).catch(() => ({ items: [] })),
      pb.collection('closed_dates').getList(1, 100, {
        filter: `restaurant_id = "${restaurantId}"`,
        sort: 'date',
      }).catch(() => ({ items: [] })),
    ])

    let workingHours = hoursResult.items

    // Cria horários padrão se não existirem
    if (workingHours.length === 0) {
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
      } catch {}
    }

    return NextResponse.json({
      restaurant,
      workingHours,
      closedDates: datesResult.items,
    })
  } catch (err: any) {
    console.error('[GET /api/configuracoes] erro:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
