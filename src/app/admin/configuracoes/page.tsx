import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfiguracoesClient from '@/components/admin/ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  const restaurantId = restaurant?.id

  const [{ data: workingHours }, { data: closedDates }] = await Promise.all([
    restaurantId
      ? supabase.from('working_hours').select('*').eq('restaurant_id', restaurantId).order('day_of_week')
      : Promise.resolve({ data: [] }),
    restaurantId
      ? supabase.from('closed_dates').select('*').eq('restaurant_id', restaurantId).order('date')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Configurações</h1>
      <ConfiguracoesClient
        restaurant={restaurant}
        initialHours={workingHours ?? []}
        initialClosedDates={closedDates ?? []}
      />
    </div>
  )
}
