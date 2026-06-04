import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CardapioAdmin from '@/components/cardapio/CardapioAdmin'

export default async function CardapioAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  const restaurantId = restaurant?.id ?? ''

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('display_order'),
    supabase.from('menu_items').select('*, cost_items(*)').eq('restaurant_id', restaurantId).order('display_order'),
  ])

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Cardápio</h1>
      <CardapioAdmin
        restaurantId={restaurantId}
        initialCategories={categories ?? []}
        initialItems={items ?? []}
      />
    </div>
  )
}
