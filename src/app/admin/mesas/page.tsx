import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TableMapAdmin from '@/components/mesas/TableMapAdmin'

export default async function MesasAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  const restaurantId = restaurant?.id ?? ''

  const { data: tables } = await supabase
    .from('tables')
    .select('*, current_order:orders(id, total, status, order_items(id, quantity, menu_item:menu_items(name)))')
    .eq('restaurant_id', restaurantId)
    .eq('orders.status', 'open')
    .order('number')

  const tablesWithOrder = (tables ?? []).map(t => ({
    ...t,
    current_order: Array.isArray(t.current_order) ? (t.current_order[0] ?? null) : null,
  }))

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-4">Mapa de mesas</h1>
      <TableMapAdmin restaurantId={restaurantId} initialTables={tablesWithOrder} />
    </div>
  )
}
