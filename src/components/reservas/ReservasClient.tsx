'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Users } from 'lucide-react'
import { createClient } from '@/lib/pb/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  userId: string
  restaurantId: string
  tables: { id: string; number: number; capacity: number }[]
  workingHours: { day_of_week: number; open_time: string | null; close_time: string | null; is_open: boolean }[]
  closedDates: string[]
  myReservations: {
    id: string
    date: string
    time: string
    guest_count: number
    status: string
    payment_status: string
    table?: { number: number } | null
  }[]
}

const statusMap: Record<string, { label: string; class: string }> = {
  pending:   { label: 'Aguardando pagamento', class: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmada',           class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada',            class: 'bg-red-100 text-red-700' },
  completed: { label: 'Concluída',            class: 'bg-gray-100 text-gray-600' },
}

export default function ReservasClient({ userId, restaurantId, tables, workingHours, closedDates, myReservations }: Props) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [tableId, setTableId] = useState('')
  const [guests, setGuests] = useState('2')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [reservations, setReservations] = useState(myReservations)
  const pbRef = useRef(createClient())

  function isDateAllowed(dateStr: string): boolean {
    if (closedDates.includes(dateStr)) return false
    const d = new Date(dateStr + 'T12:00:00')
    const dow = d.getDay()
    const h = workingHours.find(w => w.day_of_week === dow)
    return !!(h?.is_open)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isDateAllowed(date)) {
      toast.error('Esta data não está disponível para reservas')
      return
    }

    setLoading(true)
    const pb = pbRef.current

    let reservation: any
    try {
      reservation = await pb.collection('reservations').create({
        restaurant_id: restaurantId,
        table_id: tableId,
        customer_id: userId,
        date,
        time,
        guest_count: parseInt(guests),
        notes: notes || null,
        status: 'pending',
        payment_status: 'unpaid',
      })
    } catch (err: any) {
      toast.error('Erro ao criar reserva: ' + (err?.message ?? 'Desconhecido'))
      setLoading(false)
      return
    }

    // Create MercadoPago payment (redirect)
    const res = await fetch('/api/reservations/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId: reservation.id }),
    })

    const { checkoutUrl } = await res.json()
    if (checkoutUrl) {
      window.location.href = checkoutUrl
    } else {
      toast.success('Reserva criada! Aguardando confirmação de pagamento.')
      setLoading(false)
      setReservations(prev => [{ ...reservation, table: tables.find(t => t.id === tableId) ?? null }, ...prev])
    }
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Calendar size={24} className="text-orange-500" />
        Reservas
      </h1>

      <Card className="mb-8 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Nova reserva</CardTitle>
          <p className="text-sm text-gray-500">Reservas exigem pagamento antecipado para confirmação</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  min={minDateStr}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mesa</Label>
                <Select value={tableId} onValueChange={setTableId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar mesa" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        Mesa {t.number} ({t.capacity} lugares)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pessoas</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={guests}
                  onChange={e => setGuests(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Input
                placeholder="Ex: aniversário, necessidades especiais..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {date && !isDateAllowed(date) && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                Esta data não está disponível (restaurante fechado)
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || (date ? !isDateAllowed(date) : false)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5"
            >
              {loading ? 'Aguarde...' : 'Reservar e pagar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mb-4">Minhas reservas</h2>
      {reservations.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Nenhuma reserva ainda</p>
      ) : (
        <div className="space-y-3">
          {reservations.map(r => {
            const s = statusMap[r.status] ?? statusMap.pending
            return (
              <Card key={r.id} className="shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">
                        Mesa {(r.table as { number: number } | null)?.number ?? '?'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
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
                          {r.guest_count}
                        </span>
                      </div>
                    </div>
                    <Badge className={s.class} variant="outline">{s.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
