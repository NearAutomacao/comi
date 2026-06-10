import { createAdminClient, inFilter } from '@/lib/pb/server'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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

    const today = new Date().toISOString().split('T')[0]
    const pb = createAdminClient()

    const { items: reservations } = await pb.collection('reservations').getList(1, 200, {
      filter: `restaurant_id = "${restaurantId}" && date >= "${today}"`,
      sort: 'date,time',
    })

    if (reservations.length === 0) {
      return NextResponse.json({ reservations: [] })
    }

    const tableIds = [...new Set(reservations.filter((r: any) => r.table_id).map((r: any) => r.table_id))] as string[]
    const customerIds = [...new Set(reservations.filter((r: any) => r.customer_id).map((r: any) => r.customer_id))] as string[]

    const [tablesResult, customersResult] = await Promise.all([
      tableIds.length > 0
        ? pb.collection('tables').getList(1, 200, { filter: inFilter('id', tableIds), fields: 'id,number' })
        : Promise.resolve({ items: [] }),
      customerIds.length > 0
        ? pb.collection('users').getList(1, 200, { filter: inFilter('id', customerIds), fields: 'id,name,phone' })
        : Promise.resolve({ items: [] }),
    ])

    const tableMap = new Map((tablesResult.items as any[]).map(t => [t.id, t]))
    const customerMap = new Map((customersResult.items as any[]).map(c => [c.id, c]))

    const enriched = reservations.map((r: any) => ({
      ...r,
      table: r.table_id && tableMap.has(r.table_id) ? { number: tableMap.get(r.table_id).number } : null,
      customer: r.customer_id && customerMap.has(r.customer_id)
        ? { name: customerMap.get(r.customer_id).name, phone: customerMap.get(r.customer_id).phone ?? null }
        : null,
    }))

    return NextResponse.json({ reservations: enriched })
  } catch (err: any) {
    console.error('[GET /api/reservas] erro:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
