import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import CategoryNav from '@/components/cardapio/CategoryNav'
import MenuSection from '@/components/cardapio/MenuSection'
import RestaurantStatus from '@/components/shared/RestaurantStatus'

export const revalidate = 0

export default async function CardapioPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  // Preferência: restaurante da mesa escaneada (cookie) → fallback primeiro restaurante
  const restaurantIdFromCookie = cookieStore.get('comi_restaurant_id')?.value

  const { data: restaurant } = restaurantIdFromCookie
    ? await supabase.from('restaurants').select('id, name').eq('id', restaurantIdFromCookie).single()
    : await supabase.from('restaurants').select('id, name').limit(1).single()

  const restaurantId = restaurant?.id

  const [
    { data: categories },
    { data: items },
    { data: workingHours },
    { data: closedDates },
  ] = await Promise.all([
    restaurantId
      ? supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('display_order')
      : Promise.resolve({ data: [] }),
    restaurantId
      ? supabase.from('menu_items').select('*, category:menu_categories(*)').eq('restaurant_id', restaurantId).eq('available', true).order('display_order')
      : Promise.resolve({ data: [] }),
    restaurantId
      ? supabase.from('working_hours').select('*').eq('restaurant_id', restaurantId).order('day_of_week')
      : Promise.resolve({ data: [] }),
    restaurantId
      ? supabase.from('closed_dates').select('date').eq('restaurant_id', restaurantId)
      : Promise.resolve({ data: [] }),
  ])

  const grouped = (categories ?? []).map(cat => ({
    category: cat,
    items: (items ?? []).filter(i => i.category_id === cat.id),
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 pb-20">
      <div className="py-4">
        <RestaurantStatus
          workingHours={workingHours ?? []}
          closedDates={(closedDates ?? []).map(d => ({ date: d.date }))}
        />
      </div>
      {categories && categories.length > 0 && (
        <CategoryNav categories={categories} />
      )}
      <div className="space-y-8 mt-4">
        {grouped.map(({ category, items }) =>
          items.length > 0 ? (
            <MenuSection key={category.id} category={category} items={items} />
          ) : null
        )}
        {grouped.every(g => g.items.length === 0) && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Cardápio em breve</p>
            <p className="text-sm mt-1">O restaurante ainda está configurando o cardápio</p>
          </div>
        )}
      </div>
    </div>
  )
}
