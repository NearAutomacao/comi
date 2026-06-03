import { createClient } from '@/lib/supabase/server'
import ReservasAdmin from '@/components/reservas/ReservasAdmin'

export default async function ReservasAdminPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: reservations } = await supabase
    .from('reservations')
    .select('*, table:tables(number), customer:profiles(name, phone)')
    .gte('date', today)
    .order('date')
    .order('time')

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Reservas</h1>
      <ReservasAdmin initialReservations={reservations ?? []} />
    </div>
  )
}
