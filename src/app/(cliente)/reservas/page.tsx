import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReservasClient from '@/components/reservas/ReservasClient'

export default async function ReservasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Pega o primeiro restaurante disponível
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .limit(1)
    .single()

  const restaurantId = restaurant?.id ?? ''

  const [{ data: tables }, { data: workingHours }, { data: closedDates }, { data: myReservations }] =
    await Promise.all([
      supabase.from('tables').select('id, number, capacity').eq('restaurant_id', restaurantId).order('number'),
      supabase.from('working_hours').select('*').eq('restaurant_id', restaurantId),
      supabase.from('closed_dates').select('date').eq('restaurant_id', restaurantId),
      supabase.from('reservations').select('*, table:tables(number)').eq('customer_id', user.id).order('date', { ascending: false }).limit(10),
    ])

  return (
    <ReservasClient
      userId={user.id}
      restaurantId={restaurantId}
      tables={tables ?? []}
      workingHours={workingHours ?? []}
      closedDates={(closedDates ?? []).map(d => d.date)}
      myReservations={myReservations ?? []}
    />
  )
}
