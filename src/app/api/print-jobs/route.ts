import { createAdminClient } from '@/lib/pb/server'
import { NextResponse } from 'next/server'

// GET /api/print-jobs?printer=kitchen&restaurantId=xxx
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const printer = searchParams.get('printer')
    const restaurantId = searchParams.get('restaurantId')

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId obrigatório' }, { status: 400 })
    }

    const pb = createAdminClient()

    let filter = `restaurant_id = "${restaurantId}" && printed_at = null`
    if (printer) filter += ` && printer = "${printer}"`

    const { items } = await pb.collection('print_jobs').getList(1, 100, {
      filter,
      sort: 'created',
    })

    return NextResponse.json({ jobs: items })
  } catch (err: any) {
    console.error('[GET /api/print-jobs] erro:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
