import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UtensilsCrossed, Store } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const role = user.app_metadata?.role ?? user.user_metadata?.role
    if (role === 'manager') redirect('/admin/dashboard')
    else redirect('/cardapio')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 px-4">
      <div className="text-center max-w-md w-full">
        <div className="mb-8">
          <div className="w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-4xl text-white font-bold">C</span>
          </div>
          <h1 className="text-4xl font-bold text-orange-600 mb-2">Comi</h1>
          <p className="text-gray-500 text-base">Sistema de gestão para restaurantes</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/login">
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg rounded-xl shadow">
              Entrar
            </Button>
          </Link>
          <Link href="/cadastro">
            <Button variant="outline" className="w-full py-6 text-lg rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50">
              <UtensilsCrossed size={18} className="mr-2" />
              Sou cliente
            </Button>
          </Link>
          <Link href="/cadastro-restaurante">
            <Button variant="outline" className="w-full py-6 text-lg rounded-xl border-gray-300 text-gray-600 hover:bg-gray-50">
              <Store size={18} className="mr-2" />
              Tenho um restaurante
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
