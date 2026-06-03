import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, UtensilsCrossed, Calendar, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: todayOrders },
    { data: occupiedTables },
    { data: pendingReservations },
    { data: totalTables },
  ] = await Promise.all([
    supabase.from('orders').select('total').gte('created_at', today).neq('status', 'cancelled'),
    supabase.from('tables').select('id').eq('status', 'occupied'),
    supabase.from('reservations').select('id').eq('date', today).in('status', ['pending', 'confirmed']),
    supabase.from('tables').select('id'),
  ])

  const revenue = (todayOrders ?? []).reduce((s, o) => s + Number(o.total), 0)

  const stats = [
    {
      title: 'Receita hoje',
      value: formatCurrency(revenue),
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Mesas ocupadas',
      value: `${occupiedTables?.length ?? 0} / ${totalTables?.length ?? 0}`,
      icon: UtensilsCrossed,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      href: '/admin/mesas',
    },
    {
      title: 'Pedidos hoje',
      value: String(todayOrders?.length ?? 0),
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/admin/pedidos',
    },
    {
      title: 'Reservas hoje',
      value: String(pendingReservations?.length ?? 0),
      icon: Calendar,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      href: '/admin/reservas',
    },
  ]

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ title, value, icon: Icon, color, bg, href }) => (
          <Card key={title} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-sm text-gray-500">{title}</p>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              {href && (
                <Link href={href} className="text-xs text-gray-400 hover:underline mt-1 block">
                  Ver detalhes →
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ações rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/admin/mesas">
              <Button variant="outline" className="w-full justify-start">
                <UtensilsCrossed size={16} className="mr-2 text-orange-500" />
                Ver mapa de mesas
              </Button>
            </Link>
            <Link href="/admin/pedidos">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp size={16} className="mr-2 text-blue-500" />
                Gerenciar pedidos
              </Button>
            </Link>
            <Link href="/admin/cardapio">
              <Button variant="outline" className="w-full justify-start">
                <UtensilsCrossed size={16} className="mr-2 text-green-500" />
                Editar cardápio
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
