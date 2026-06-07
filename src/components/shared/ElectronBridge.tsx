'use client'

import { useEffect } from 'react'
import { isElectron, electronAPI } from '@/lib/electron'
import { createClient } from '@/lib/supabase/client'

interface Props {
  restaurantId: string
}

// Notifica o processo principal do Electron sobre o restaurante logado.
// Necessário para que o print agent e a verificação de licença saibam qual restaurante servir.
export default function ElectronBridge({ restaurantId }: Props) {
  useEffect(() => {
    if (!isElectron() || !restaurantId) return

    const supabase = createClient()

    async function configure() {
      const { data } = await supabase
        .from('restaurants')
        .select('printer_kitchen_host, printer_kitchen_port, printer_bar_host, printer_bar_port')
        .eq('id', restaurantId)
        .single()

      await electronAPI()?.setRestaurantConfig({
        restaurantId,
        printerConfig: data ? {
          kitchenHost: data.printer_kitchen_host ?? '',
          kitchenPort: data.printer_kitchen_port ?? 9100,
          barHost: data.printer_bar_host ?? '',
          barPort: data.printer_bar_port ?? 9100,
        } : undefined,
      })
    }

    configure().catch(console.error)
  }, [restaurantId])

  return null
}
