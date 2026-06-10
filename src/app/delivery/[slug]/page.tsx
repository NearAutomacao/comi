import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyDeliverySessionToken } from '@/lib/delivery-session'
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

  return <DeliveryLandingForm slug={slug} />
}
