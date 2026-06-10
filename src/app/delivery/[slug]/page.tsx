import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeliverySessionToken } from '@/lib/delivery-session'
import { createAdminClient } from '@/lib/pb/server'
import DeliveryLandingForm from '@/components/delivery/DeliveryLandingForm'

export default async function DeliveryLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get('delivery_session')?.value
  const session = token ? await verifyDeliverySessionToken(token) : null

  if (session && session.restaurantSlug === slug) {
    if (session.orderId) {
      redirect(`/delivery/${slug}/acompanhar`)
    } else {
      redirect(`/delivery/${slug}/cardapio`)
    }
  }

  const pb = createAdminClient()

  let restaurantName = ''
  let whatsappContact: string | null = null
  let workingHours: { day_of_week: number; open_time: string | null; close_time: string | null; is_open: boolean }[] = []
  let closedDates: string[] = []

  try {
    const { items } = await pb.collection('restaurants').getList(1, 1, {
      filter: `slug = "${slug}"`,
    })
    const restaurant = items[0]
    if (restaurant) {
      restaurantName = (restaurant as any).name ?? ''
      whatsappContact = (restaurant as any).whatsapp_contact ?? null
      const restaurantId = restaurant.id

      const [hoursResult, datesResult] = await Promise.allSettled([
        pb.collection('working_hours').getList(1, 7, {
          filter: `restaurant_id = "${restaurantId}"`,
          sort: 'day_of_week',
        }),
        pb.collection('closed_dates').getList(1, 100, {
          filter: `restaurant_id = "${restaurantId}"`,
          sort: 'date',
        }),
      ])

      if (hoursResult.status === 'fulfilled') {
        workingHours = hoursResult.value.items.map((h: any) => ({
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_open: h.is_open,
        }))
      }
      if (datesResult.status === 'fulfilled') {
        closedDates = datesResult.value.items.map((d: any) => d.date as string)
      }
    }
  } catch {}

  return (
    <DeliveryLandingForm
      slug={slug}
      restaurantName={restaurantName}
      whatsappContact={whatsappContact}
      workingHours={workingHours}
      closedDates={closedDates}
    />
  )
}
