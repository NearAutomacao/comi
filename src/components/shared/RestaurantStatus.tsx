'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isRestaurantOpen, getDayName } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface Props {
  workingHours: {
    day_of_week: number
    open_time: string | null
    close_time: string | null
    is_open: boolean
  }[]
  closedDates: { date: string }[]
}

export default function RestaurantStatus({ workingHours, closedDates }: Props) {
  const status = isRestaurantOpen(workingHours, closedDates)
  const today = new Date()
  const todayHours = workingHours.find(h => h.day_of_week === today.getDay())
  const router = useRouter()

  // Atualiza o status automaticamente a cada 60 segundos
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 60_000)
    return () => clearInterval(interval)
  }, [router])

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gray-700">Status</span>
        <Badge
          className={
            status.open
              ? 'bg-green-100 text-green-700 border-green-300'
              : 'bg-red-100 text-red-700 border-red-300'
          }
          variant="outline"
        >
          {status.open ? '● Aberto agora' : '● Fechado'}
        </Badge>
      </div>

      {!status.open && status.reason && (
        <p className="text-sm text-gray-500 mt-1">
          {status.reason === 'fechado hoje' ? 'Fechado hoje' : status.reason}
        </p>
      )}

      {todayHours?.is_open && todayHours.open_time && todayHours.close_time && (
        <p className="text-sm text-gray-500 mt-1">
          {getDayName(today.getDay())}: {todayHours.open_time.slice(0, 5)} às {todayHours.close_time.slice(0, 5)}
        </p>
      )}
    </div>
  )
}
