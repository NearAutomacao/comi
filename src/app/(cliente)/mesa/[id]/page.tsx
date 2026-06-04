import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TableSelection from '@/components/mesas/TableSelection'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MesaPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: table } = await supabase
    .from('tables')
    .select('*')
    .eq('id', id)
    .single()

  if (!table) notFound()

  // Verifica se a mesa está bloqueada por uma reserva de outro cliente
  const { data: { user } } = await supabase.auth.getUser()
  const today = new Date().toISOString().split('T')[0]
  const { data: activeReservation } = await supabase
    .from('reservations')
    .select('id, customer_id, status')
    .eq('table_id', id)
    .eq('date', today)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle()

  const blockedByOther = !!(activeReservation && activeReservation.customer_id !== user?.id)

  return (
    <TableSelection
      table={table}
      blockedByOther={blockedByOther}
    />
  )
}
