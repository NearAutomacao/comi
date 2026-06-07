import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/print-jobs/[id]/printed
// Marca um job como impresso — chamado pelo agente local após imprimir
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await createAdminClient()

  const { error } = await admin
    .from('print_jobs')
    .update({ printed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
