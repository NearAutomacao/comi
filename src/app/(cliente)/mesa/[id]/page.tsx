import { createAdminClient } from '@/lib/pb/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import TableSelection from '@/components/mesas/TableSelection'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MesaPage({ params }: Props) {
  const { id } = await params
  const pb = createAdminClient()

  let table: any
  try {
    table = await pb.collection('tables').getOne(id)
  } catch {
    notFound()
  }

  // Verifica se a mesa está bloqueada por uma reserva de outro cliente
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  const userId = session?.userId ?? null

  const today = new Date().toISOString().split('T')[0]
  let blockedByOther = false

  try {
    const { items } = await pb.collection('reservations').getList(1, 1, {
      filter: `table_id = "${id}" && date = "${today}" && (status = "pending" || status = "confirmed")`,
    })
    if (items.length > 0) {
      const reservation = items[0] as any
      blockedByOther = !!(reservation.customer_id && reservation.customer_id !== userId)
    }
  } catch {}

  return (
    <TableSelection
      table={table}
      blockedByOther={blockedByOther}
    />
  )
}
