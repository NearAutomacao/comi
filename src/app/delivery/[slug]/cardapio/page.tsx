import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeliverySessionToken } from '@/lib/delivery-session'
import { createAdminClient } from '@/lib/pb/server'
import DeliveryMenu from '@/components/delivery/DeliveryMenu'

export const revalidate = 0

export default async function DeliveryCardapioPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get('delivery_session')?.value
  const session = token ? await verifyDeliverySessionToken(token) : null

  if (!session || session.restaurantSlug !== slug) {
    redirect(`/delivery/${slug}`)
  }

  const pb = createAdminClient()

  let restaurant: any = null
  let categories: any[] = []
  let items: any[] = []

  try {
    const { items: restaurants } = await pb.collection('restaurants').getList(1, 1, {
      filter: `slug = "${slug}"`,
    })
    restaurant = restaurants[0] ?? null
  } catch {}

  if (!restaurant) redirect(`/delivery/${slug}`)

  try {
    const [catResult, itemResult] = await Promise.all([
      pb.collection('menu_categories').getList(1, 100, {
        filter: `restaurant_id = "${restaurant.id}"`,
        sort: 'display_order',
      }),
      pb.collection('menu_items').getList(1, 500, {
        filter: `restaurant_id = "${restaurant.id}" && available = true`,
        sort: 'display_order',
      }),
    ])
    categories = catResult.items
    items = itemResult.items
  } catch {}

  const itemsWithCategory = items.map((item: any) => ({
    ...item,
    category: categories.find((c: any) => c.id === item.category_id) ?? null,
  }))

  const grouped = categories
    .map((cat: any) => ({
      category: cat,
      items: itemsWithCategory.filter((i: any) => i.category_id === cat.id),
    }))
    .filter(g => g.items.length > 0)

  return (
    <DeliveryMenu
      slug={slug}
      restaurantName={restaurant.name}
      guestName={session.guestName}
      guestPhone={session.guestPhone}
      grouped={grouped}
    />
  )
}
