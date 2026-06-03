import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReservasClient from '@/components/reservas/ReservasClient'

export default async function ReservasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: tables },
    { data: workingHours },
    { data: closedDates },
    { data: myReservations },
  ] = await Promise.all([
    supabase.from('tables').select('id, number, capacity').order('number'),
    supabase.from('working_hours').select('*'),
    supabase.from('closed_dates').select('date'),
    supabase
      .from('reservations')
      .select('*, table:tables(number)')
      .eq('customer_id', user.id)
      .order('date', { ascending: false })
      .limit(10),
  ])

  return (
    <ReservasClient
      userId={user.id}
      tables={tables ?? []}
      workingHours={workingHours ?? []}
      closedDates={(closedDates ?? []).map(d => d.date)}
      myReservations={myReservations ?? []}
    />
  )
}
