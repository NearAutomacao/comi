import { createClient } from '@/lib/supabase/server'
import ConfiguracoesClient from '@/components/admin/ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const [{ data: settings }, { data: workingHours }, { data: closedDates }] = await Promise.all([
    supabase.from('restaurant_settings').select('*').single(),
    supabase.from('working_hours').select('*').order('day_of_week'),
    supabase.from('closed_dates').select('*').order('date'),
  ])

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-6">Configurações</h1>
      <ConfiguracoesClient
        settings={settings}
        initialHours={workingHours ?? []}
        initialClosedDates={closedDates ?? []}
      />
    </div>
  )
}
