'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Users, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import type { ReservationStatus } from '@/types'

interface Reservation {
  id: string
  date: string
  time: string
  guest_count: number
  status: ReservationStatus
  payment_status: string
  notes: string | null
  table?: { number: number } | null
  customer?: { name: string; phone: string | null } | null
}

const statusMap: Record<ReservationStatus, { label: string; class: string }> = {
  pending:   { label: 'Aguard. pagamento', class: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmada',        class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada',         class: 'bg-red-100 text-red-700' },
  completed: { label: 'Concluída',         class: 'bg-gray-100 text-gray-600' },
}

export default function ReservasAdmin({ initialReservations }: { initialReservations: Reservation[] }) {
  const [reservations, setReservations] = useState(initialReservations)
  const supabase = createClient()

  async function updateStatus(id: string, status: ReservationStatus) {
    await supabase.from('reservations').update({ status }).eq('id', id)
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    toast.success('Status atualizado')
  }

  if (reservations.length === 0) {
    return <p className="text-gray-400 text-center py-16">Nenhuma reserva próxima</p>
  }

  return (
    <div className="space-y-3">
      {reservations.map(r => {
        const s = statusMap[r.status]
        return (
          <Card key={r.id} className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="font-semibold">{r.customer?.name ?? 'Cliente'}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {format(new Date(r.date + 'T12:00'), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {r.time.slice(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {r.guest_count} pessoas
                    </span>
                    {r.customer?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={14} />
                        {r.customer.phone}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">Mesa {r.table?.number ?? '?'}</p>
                  {r.notes && <p className="text-xs text-gray-400 italic">{r.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={s.class} variant="outline">{s.label}</Badge>
                  {r.status === 'pending' && r.payment_status === 'paid' && (
                    <Button
                      size="sm"
                      onClick={() => updateStatus(r.id, 'confirmed')}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs"
                    >
                      Confirmar
                    </Button>
                  )}
                  {r.status !== 'cancelled' && r.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(r.id, 'cancelled')}
                      className="text-red-500 border-red-300 text-xs"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
