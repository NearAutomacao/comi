import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { verifyDeliverySessionToken } from '@/lib/delivery-session'
import { createAdminClient } from '@/lib/pb/server'
import DeliveryMenu from '@/components/delivery/DeliveryMenu'

export const dynamic = 'force-dynamic'

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'

const getMenuData = unstable_cache(
  async (restaurantId: string) => {
    const pb = createAdminClient()
    const [catResult, itemResult] = await Promise.all([
      pb.collection('menu_categories').getList(1, 100, {
        filter: `restaurant_id = "${restaurantId}"`,
        sort: 'display_order',
      }),
      pb.collection('menu_items').getList(1, 500, {
        filter: `restaurant_id = "${restaurantId}" && available = true`,
        sort: 'display_order',
      }),
    ])
    return {
      categories: catResult.items as any[],
      items: itemResult.items as any[],
    }
  },
  ['delivery-menu'],
  { revalidate: 60 }
)

const getRestaurantBySlug = unstable_cache(
  async (slug: string) => {
    const pb = createAdminClient()
    const { items } = await pb.collection('restaurants').getList(1, 1, {
      filter: `slug = "${slug}"`,
    })
    return (items[0] as any) ?? null
  },
  ['delivery-restaurant'],
  { revalidate: 120 }
)

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

  if (session.orderId) {
    redirect(`/delivery/${slug}/acompanhar`)
  }

  const restaurant = await getRestaurantBySlug(slug).catch(() => null)

  if (!restaurant) redirect(`/delivery/${slug}`)

  const { categories, items } = await getMenuData(restaurant.id).catch(() => ({ categories: [], items: [] }))

  const itemsWithCategory = items.map((item: any) => ({
    ...item,
    category: categories.find((c: any) => c.id === item.category_id) ?? null,
  }))

  const grouped = categories
    .map((cat: any) => ({
      category: cat,
      items: itemsWithCategory
        .filter((i: any) => i.category_id === cat.id)
        .map((i: any) => ({
          ...i,
          photo_url: i.photo_url ||
            (i.photo ? `${PB_URL}/api/files/${i.collectionId}/${i.id}/${i.photo}` : null),
        })),
    }))
    .filter(g => g.items.length > 0)

  return (
    <DeliveryMenu
      slug={slug}
      restaurantName={restaurant.name}
      guestName={session.guestName}
      guestPhone={session.guestPhone}
      grouped={grouped}
      mpEnabled={!!restaurant.mp_access_token}
    />
  )
}
