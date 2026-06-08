import { cookies } from 'next/headers'
import { verifyAdminSessionToken } from '@/lib/auth-session'
import ClienteHeader from '@/components/shared/ClienteHeader'

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('comi_admin_session')?.value
  const session = token ? await verifyAdminSessionToken(token) : null

  const userName = session?.name ?? ''

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ClienteHeader userName={userName} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
