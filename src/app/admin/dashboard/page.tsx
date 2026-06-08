import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  const restaurantId = restaurant?.id ?? ''

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: todayOrders },
    { data: occupiedTables },
    { data: pendingReservations },
    { data: totalTables },
  ] = await Promise.all([
    supabase.from('orders').select('id, total, status').eq('restaurant_id', restaurantId).gte('created_at', today).neq('status', 'cancelled'),
    supabase.from('tables').select('id').eq('restaurant_id', restaurantId).eq('status', 'occupied'),
    supabase.from('reservations').select('id').eq('restaurant_id', restaurantId).eq('date', today).in('status', ['pending', 'confirmed']),
    supabase.from('tables').select('id').eq('restaurant_id', restaurantId),
  ])

  return (
    <DashboardClient
      restaurantId={restaurantId}
      initialRevenue={(todayOrders ?? []).reduce((s, o) => s + Number(o.total), 0)}
      initialOrders={todayOrders?.length ?? 0}
      initialOccupied={occupiedTables?.length ?? 0}
      initialTotal={totalTables?.length ?? 0}
      initialReservations={pendingReservations?.length ?? 0}
    />
  )
}
