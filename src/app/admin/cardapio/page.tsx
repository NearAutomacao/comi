import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import CardapioAdmin from '@/components/cardapio/CardapioAdmin'

export default async function CardapioAdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) redirect('/login')

  const restaurantId = session.restaurantId ?? ''
  const pb = createAdminClient()

  let categories: any[] = []
  let items: any[] = []
  try {
    const [catResult, itemResult] = await Promise.all([
      pb.collection('menu_categories').getList(1, 100, {
        filter: `restaurant_id = "${restaurantId}"`,
        sort: 'display_order',
      }),
      pb.collection('menu_items').getList(1, 500, {
        filter: `restaurant_id = "${restaurantId}"`,
        sort: 'display_order',
      }),
    ])
    categories = catResult.items
    items = itemResult.items
  } catch (err) {
    console.error('[cardapio admin] erro ao buscar dados:', err)
  }

  // Busca cost_items para cada menu_item
  const itemsWithCosts = await Promise.all(
    items.map(async (item: any) => {
      try {
        const { items: costItems } = await pb.collection('cost_items').getList(1, 50, {
          filter: `menu_item_id = "${item.id}"`,
        })
        return { ...item, cost_items: costItems }
      } catch {
        return { ...item, cost_items: [] }
      }
    })
  )

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Cardápio</h1>
      <CardapioAdmin
        restaurantId={restaurantId}
        initialCategories={categories as any}
        initialItems={itemsWithCosts}
      />
    </div>
  )
}
