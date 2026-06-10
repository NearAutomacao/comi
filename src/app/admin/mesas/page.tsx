import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import TableMapAdmin from '@/components/mesas/TableMapAdmin'

export default async function MesasAdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) redirect('/login')

  const localIP = process.env.LOCAL_IP

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-4">Mapa de mesas</h1>
      <TableMapAdmin restaurantId={session.restaurantId ?? ''} initialTables={[]} localIP={localIP} />
    </div>
  )
}
