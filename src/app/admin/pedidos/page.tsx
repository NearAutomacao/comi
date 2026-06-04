import { createClient } from '@/lib/supabase/server'
import PedidosAdmin from '@/components/pedidos/PedidosAdmin'

export default async function PedidosAdminPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select('*, table:tables(number), order_items(*, menu_item:menu_items(name, price))')
    .in('status', ['open', 'preparing', 'served'])
    .order('created_at', { ascending: true })

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Pedidos em aberto</h1>
      <PedidosAdmin initialOrders={orders ?? []} />
    </div>
  )
}
