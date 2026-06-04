import { createClient } from '@/lib/supabase/server'
import ClienteHeader from '@/components/shared/ClienteHeader'

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userName = ''
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()
    userName = profile?.name ?? ''
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ClienteHeader userName={userName} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
