import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/pb/server'
import CategoryNav from '@/components/cardapio/CategoryNav'
import MenuSection from '@/components/cardapio/MenuSection'
import RestaurantStatus from '@/components/shared/RestaurantStatus'

export const revalidate = 0

export default async function CardapioPage() {
  const cookieStore = await cookies()
  const pb = createAdminClient()

  const restaurantIdFromCookie = cookieStore.get('comi_restaurant_id')?.value

  let restaurantId: string | null = null
  if (restaurantIdFromCookie) {
    try {
      await pb.collection('restaurants').getOne(restaurantIdFromCookie)
      restaurantId = restaurantIdFromCookie
    } catch {}
  }
  if (!restaurantId) {
    try {
      const { items } = await pb.collection('restaurants').getList(1, 1)
      restaurantId = items[0]?.id ?? null
    } catch {}
  }

  const [{ items: categories }, { items: allItems }, { items: workingHours }, { items: closedDates }] =
    restaurantId
      ? await Promise.all([
          pb.collection('menu_categories').getList(1, 100, {
            filter: `restaurant_id = "${restaurantId}"`,
            sort: 'display_order',
          }),
          pb.collection('menu_items').getList(1, 500, {
            filter: `restaurant_id = "${restaurantId}" && available = true`,
            sort: 'display_order',
          }),
          pb.collection('working_hours').getList(1, 7, {
            filter: `restaurant_id = "${restaurantId}"`,
            sort: 'day_of_week',
          }),
          pb.collection('closed_dates').getList(1, 100, {
            filter: `restaurant_id = "${restaurantId}"`,
          }),
        ])
      : [
          { items: [] },
          { items: [] },
          { items: [] },
          { items: [] },
        ]

  // Enriquece itens com categoria
  const itemsWithCategory = allItems.map((item: any) => ({
    ...item,
    category: categories.find((c: any) => c.id === item.category_id) ?? null,
  }))

  const grouped = categories.map((cat: any) => ({
    category: cat,
    items: itemsWithCategory.filter((i: any) => i.category_id === cat.id),
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 pb-20">
      <div className="py-4">
        <RestaurantStatus
          workingHours={workingHours as any}
          closedDates={closedDates.map((d: any) => ({ date: d.date }))}
        />
      </div>
      {categories.length > 0 && <CategoryNav categories={categories as any} />}
      <div className="space-y-8 mt-4">
        {grouped.map(({ category, items }: any) =>
          items.length > 0 ? (
            <MenuSection key={category.id} category={category} items={items} />
          ) : null
        )}
        {grouped.every((g: any) => g.items.length === 0) && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Cardápio em breve</p>
            <p className="text-sm mt-1">O restaurante ainda está configurando o cardápio</p>
          </div>
        )}
      </div>
    </div>
  )
}
