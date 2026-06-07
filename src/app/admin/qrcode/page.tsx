import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QRCodeCard from '@/components/shared/QRCodeCard'

export default async function QRCodePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('slug, name')
    .eq('owner_id', user.id)
    .single()

  const localIP = process.env.LOCAL_IP
  const isDesktop = !!localIP && localIP !== '127.0.0.1'

  const localUrl = isDesktop
    ? `http://${localIP}:3100/cardapio`
    : null

  const productionUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/cardapio`
    : null

  return (
    <div className="p-4 md:p-6 mt-14 md:mt-0">
      <h1 className="text-2xl font-bold mb-2">QR Code do Cardápio</h1>
      <p className="text-gray-500 text-sm mb-6">
        Imprima ou exiba na mesa para os clientes acessarem o cardápio.
      </p>

      <div className="flex flex-col md:flex-row gap-6">
        {localUrl && (
          <QRCodeCard
            url={localUrl}
            label="Rede local (offline)"
            description={`Clientes conectados ao mesmo Wi-Fi acessam em: ${localUrl}`}
            highlight
          />
        )}

        {productionUrl && (
          <QRCodeCard
            url={productionUrl}
            label="Link online"
            description="Funciona de qualquer lugar com internet."
          />
        )}

        {!localUrl && !productionUrl && (
          <p className="text-gray-500">Nenhuma URL configurada.</p>
        )}
      </div>

      {!isDesktop && (
        <p className="mt-6 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          O QR Code de rede local só aparece quando o app COMI está instalado no PC do restaurante.
        </p>
      )}
    </div>
  )
}
