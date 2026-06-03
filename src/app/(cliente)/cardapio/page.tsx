import { createClient } from '@/lib/supabase/server'
import CategoryNav from '@/components/cardapio/CategoryNav'
import MenuSection from '@/components/cardapio/MenuSection'
import RestaurantStatus from '@/components/shared/RestaurantStatus'

export default async function CardapioPage() {
  const supabase = await createClient()

  const [
    { data: categories },
    { data: items },
    { data: workingHours },
    { data: closedDates },
  ] = await Promise.all([
    supabase.from('menu_categories').select('*').order('display_order'),
    supabase.from('menu_items').select('*, category:menu_categories(*)').eq('available', true).order('display_order'),
    supabase.from('working_hours').select('*'),
    supabase.from('closed_dates').select('date'),
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

      <CategoryNav categories={categories ?? []} />

      <div className="space-y-8 mt-4">
        {grouped.map(({ category, items }) =>
          items.length > 0 ? (
            <MenuSection key={category.id} category={category} items={items} />
          ) : null
        )}
      </div>
    </div>
  )
}
