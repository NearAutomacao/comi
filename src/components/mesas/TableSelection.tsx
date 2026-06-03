'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, UtensilsCrossed } from 'lucide-react'
import type { Table } from '@/types'
import { toast } from 'sonner'

interface Props {
  table: Table
  userId: string
  blockedByOther: boolean
}

export default function TableSelection({ table, userId, blockedByOther }: Props) {
  const router = useRouter()
  const { setTable, tableId } = useCartStore()
  const [confirmed, setConfirmed] = useState(false)
  const alreadySet = tableId === table.id

  useEffect(() => {
    if (alreadySet) setConfirmed(true)
  }, [alreadySet])

  async function handleSit() {
    if (blockedByOther) return

    const supabase = createClient()

    // Notify manager via realtime (update table status)
    await supabase
      .from('tables')
      .update({ status: 'occupied' })
      .eq('id', table.id)

    setTable(table.id)
    setConfirmed(true)
    toast.success(`Mesa ${table.number} selecionada!`)
  }

  if (blockedByOther) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertTriangle size={56} className="mx-auto text-yellow-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Mesa reservada</h2>
        <p className="text-gray-500 mt-2">Esta mesa está reservada por outro cliente hoje.</p>
        <Button
          onClick={() => router.push('/cardapio')}
          className="mt-6 bg-orange-500 hover:bg-orange-600 text-white"
        >
          Ver cardápio
        </Button>
      </div>
    )
  }

  if (confirmed) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <CheckCircle size={56} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">Mesa {table.number}</h2>
        <p className="text-gray-500 mt-2">Você está na mesa. O restaurante foi notificado!</p>
        <p className="text-sm text-gray-400 mt-1">Capacidade: {table.capacity} pessoas</p>
        <Button
          onClick={() => router.push('/cardapio')}
          className="mt-6 bg-orange-500 hover:bg-orange-600 text-white w-full"
        >
          Ver cardápio e fazer pedido
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-6">
        <UtensilsCrossed size={36} className="text-orange-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800">Mesa {table.number}</h2>
      <p className="text-gray-500 mt-2">Capacidade para {table.capacity} pessoas</p>

      {table.status === 'occupied' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4 text-sm text-yellow-700">
          Esta mesa já está ocupada. Confirme se é você.
        </div>
      )}

      <Button
        onClick={handleSit}
        className="mt-8 w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
      >
        Sentar nesta mesa
      </Button>
    </div>
  )
}
