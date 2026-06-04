import { createClient } from '@/lib/supabase/server'
import CardapioAdmin from '@/components/cardapio/CardapioAdmin'

export default async function CardapioAdminPage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('menu_categories').select('*').order('display_order'),
    supabase
      .from('menu_items')
      .select('*, cost_items(*)')
      .order('display_order'),
  ])

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Cardápio</h1>
      <CardapioAdmin initialCategories={categories ?? []} initialItems={items ?? []} />
    </div>
  )
}
