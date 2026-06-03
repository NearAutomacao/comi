import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import RestaurantStatus from '@/components/shared/RestaurantStatus'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role === 'manager') redirect('/admin/dashboard')
    else redirect('/cardapio')
  }

  const { data: workingHours } = await supabase.from('working_hours').select('*')
  const { data: closedDates } = await supabase.from('closed_dates').select('date')
  const { data: settings } = await supabase.from('restaurant_settings').select('restaurant_name').single()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 px-4">
      <div className="text-center max-w-md w-full">
        <div className="mb-6">
          <div className="w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-4xl text-white font-bold">C</span>
          </div>
          <h1 className="text-4xl font-bold text-orange-600 mb-2">
            {settings?.restaurant_name ?? 'Comi'}
          </h1>
          <p className="text-gray-600 text-lg">Bem-vindo ao nosso restaurante</p>
        </div>

        <RestaurantStatus
          workingHours={workingHours ?? []}
          closedDates={(closedDates ?? []).map(d => ({ date: d.date }))}
        />

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/cadastro">
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg rounded-xl shadow">
              Criar conta
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full py-6 text-lg rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50">
              Entrar
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Acesse o cardápio, faça pedidos e reserve sua mesa
        </p>
      </div>
    </main>
  )
}
