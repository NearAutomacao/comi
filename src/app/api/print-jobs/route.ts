import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/print-jobs?printer=kitchen&restaurantId=xxx
// Retorna jobs não impressos — usado pelo agente local de impressão
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const printer = searchParams.get('printer')
  const restaurantId = searchParams.get('restaurantId')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId obrigatório' }, { status: 400 })
  }

  const admin = await createAdminClient()

  let query = admin
    .from('print_jobs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('printed_at', null)
    .order('created_at', { ascending: true })

  if (printer) query = query.eq('printer', printer)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ jobs: data ?? [] })
}
