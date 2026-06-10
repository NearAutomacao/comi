import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeliverySessionToken } from '@/lib/delivery-session'
import { createAdminClient, inFilter } from '@/lib/pb/server'
import OrderTracking from '@/components/delivery/OrderTracking'
import { Button } from '@/components/ui/button'

export const revalidate = 0

async function clearSessionAction(slug: string) {
  'use server'
  const cookieStore = await cookies()
  cookieStore.delete('delivery_session')
  redirect(`/delivery/${slug}`)
}

export default async function AcompanharPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get('delivery_session')?.value
  const session = token ? await verifyDeliverySessionToken(token) : null

  if (!session || session.restaurantSlug !== slug || !session.orderId) {
    redirect(`/delivery/${slug}`)
  }

  const pb = createAdminClient()
  let order: any = null

  try {
    order = await pb.collection('orders').getOne(session.orderId)
  } catch {}

  if (!order) {
    const clearAction = clearSessionAction.bind(null, slug)
    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <p className="text-gray-500 mb-6">Não foi possível carregar seu pedido.</p>
          <form action={clearAction}>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white">
              Voltar ao início
            </Button>
          </form>
        </div>
      </main>
    )
  }

  let orderItems: { quantity: number; unit_price: number; menu_item: { name: string } | null }[] = []
  try {
    const { items } = await pb.collection('order_items').getList(1, 100, {
      filter: `order_id = "${session.orderId}"`,
    })
    const menuItemIds = [...new Set(items.map((oi: any) => oi.menu_item_id).filter(Boolean))] as string[]
    let menuItemMap: Record<string, string> = {}
    if (menuItemIds.length > 0) {
      const { items: menuItems } = await pb.collection('menu_items').getList(1, 200, {
        filter: inFilter('id', menuItemIds),
        fields: 'id,name',
      })
      menuItemMap = Object.fromEntries(menuItems.map((m: any) => [m.id, m.name]))
    }
    orderItems = items.map((oi: any) => ({
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      menu_item: menuItemMap[oi.menu_item_id] ? { name: menuItemMap[oi.menu_item_id] } : null,
    }))
  } catch {}

  return (
    <OrderTracking
      slug={slug}
      guestName={session.guestName}
      orderId={session.orderId}
      orderCode={order.code ?? null}
      initialStatus={order.status}
      total={order.total ?? 0}
      orderItems={orderItems}
    />
  )
}
