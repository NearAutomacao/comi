import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import { createAdminClient } from '@/lib/pb/server'
import DeliveryAdmin from '@/components/delivery/DeliveryAdmin'

export default async function AdminDeliveryPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session || session.role !== 'manager') redirect('/login')

  const restaurantId = session.restaurantId ?? ''
  const pb = createAdminClient()

  let restaurantSlug = ''
  try {
    const r = await pb.collection('restaurants').getOne(restaurantId)
    restaurantSlug = r.slug ?? ''
  } catch {}

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <DeliveryAdmin
        restaurantId={restaurantId}
        restaurantSlug={restaurantSlug}
        initialOrders={[]}
      />
    </div>
  )
}
