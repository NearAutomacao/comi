import { createAdminClient } from '@/lib/pb/server'
import { NextResponse } from 'next/server'

// POST /api/print-jobs/[id]/printed
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pb = createAdminClient()

  try {
    await pb.collection('print_jobs').update(id, { printed_at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
