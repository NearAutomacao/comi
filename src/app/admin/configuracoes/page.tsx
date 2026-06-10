import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import ConfiguracoesClient from '@/components/admin/ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) redirect('/login')

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Configurações</h1>
      <ConfiguracoesClient
        restaurant={null}
        initialHours={[]}
        initialClosedDates={[]}
      />
    </div>
  )
}
