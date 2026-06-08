import { createAdminClient } from '@/lib/pb/server'
import { NextResponse } from 'next/server'

// PATCH /api/orders/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const pb = createAdminClient()
    const updated = await pb.collection('orders').update(id, body)
    return NextResponse.json({ ok: true, order: updated })
  } catch (err: any) {
    const detail = err?.data?.data
      ? Object.entries(err.data.data).map(([k, v]: any) => `${k}: ${v?.message}`).join(', ')
      : null
    console.error('[PATCH /api/orders/[id]]', err?.message, err?.data)
    return NextResponse.json(
      { error: detail ?? err?.data?.message ?? err?.message ?? 'Erro interno' },
      { status: err?.status ?? 500 }
    )
  }
}
