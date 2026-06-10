import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import DeliveryAdmin from '@/components/delivery/DeliveryAdmin'

export default async function AdminDeliveryPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session || session.role !== 'manager') redirect('/login')

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <DeliveryAdmin
        restaurantId={session.restaurantId ?? ''}
        restaurantSlug=""
        initialOrders={[]}
      />
    </div>
  )
}
