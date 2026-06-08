'use client'

import { useEffect } from 'react'
import { isElectron, electronAPI } from '@/lib/electron'
import { createClient } from '@/lib/pb/client'

interface Props {
  restaurantId: string
}

export default function ElectronBridge({ restaurantId }: Props) {
  useEffect(() => {
    if (!isElectron() || !restaurantId) return

    const pb = createClient()

    async function configure() {
      const data = await pb.collection('restaurants').getOne(restaurantId)
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
