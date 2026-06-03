'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getDayName } from '@/lib/utils'
import { toast } from 'sonner'
import { CreditCard, Clock, CalendarX, Settings } from 'lucide-react'
import type { WorkingHours, ClosedDate, RestaurantSettings } from '@/types'

interface Props {
  settings: RestaurantSettings | null
  initialHours: WorkingHours[]
  initialClosedDates: ClosedDate[]
}

export default function ConfiguracoesClient({ settings, initialHours, initialClosedDates }: Props) {
  const [restaurantName, setRestaurantName] = useState(settings?.restaurant_name ?? 'Comi')
  const [mpToken, setMpToken] = useState(settings?.mercadopago_access_token ?? '')
  const [mpPublicKey, setMpPublicKey] = useState(settings?.mercadopago_public_key ?? '')
  const [hours, setHours] = useState(initialHours)
  const [closedDates, setClosedDates] = useState(initialClosedDates)
  const [newDate, setNewDate] = useState('')
  const [newDateReason, setNewDateReason] = useState('')
  const supabase = createClient()

  async function saveSettings() {
    if (settings?.id) {
      await supabase.from('restaurant_settings').update({
        restaurant_name: restaurantName,
        mercadopago_access_token: mpToken || null,
        mercadopago_public_key: mpPublicKey || null,
      }).eq('id', settings.id)
    }
    toast.success('Configurações salvas')
  }

  async function updateHours(hour: WorkingHours, field: keyof WorkingHours, value: string | boolean) {
    await supabase.from('working_hours').update({ [field]: value }).eq('id', hour.id)
    setHours(prev => prev.map(h => h.id === hour.id ? { ...h, [field]: value } : h))
  }

  async function addClosedDate() {
    if (!newDate) return
    const { data } = await supabase
      .from('closed_dates')
      .insert({ date: newDate, reason: newDateReason || null })
      .select()
      .single()
    if (data) {
      setClosedDates(prev => [...prev, data as ClosedDate].sort((a, b) => a.date.localeCompare(b.date)))
      setNewDate('')
      setNewDateReason('')
      toast.success('Data de fechamento adicionada')
    }
  }

  async function removeClosedDate(id: string) {
    await supabase.from('closed_dates').delete().eq('id', id)
    setClosedDates(prev => prev.filter(d => d.id !== id))
    toast.success('Removido')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Geral */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings size={18} className="text-orange-500" /> Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do restaurante</Label>
            <Input value={restaurantName} onChange={e => setRestaurantName(e.target.value)} />
          </div>
          <Button onClick={saveSettings} className="bg-orange-500 hover:bg-orange-600 text-white">
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* MercadoPago */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={18} className="text-green-600" /> MercadoPago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Necessário para aceitar pagamentos de pedidos e reservas.
          </p>
          <div className="space-y-2">
            <Label>Access Token (privado)</Label>
            <Input
              type="password"
              value={mpToken}
              onChange={e => setMpToken(e.target.value)}
              placeholder="APP_USR-..."
            />
          </div>
          <div className="space-y-2">
            <Label>Public Key</Label>
            <Input
              value={mpPublicKey}
              onChange={e => setMpPublicKey(e.target.value)}
              placeholder="APP_USR-..."
            />
          </div>
          <Button onClick={saveSettings} className="bg-green-600 hover:bg-green-700 text-white">
            Salvar credenciais
          </Button>
        </CardContent>
      </Card>

      {/* Horários */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock size={18} className="text-blue-500" /> Horários de funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hours.map(h => (
            <div key={h.id} className="flex items-center gap-3">
              <Switch
                checked={h.is_open}
                onCheckedChange={v => updateHours(h, 'is_open', v)}
              />
              <span className="w-20 text-sm font-medium">{getDayName(h.day_of_week)}</span>
              <Input
                type="time"
                value={h.open_time ?? ''}
                disabled={!h.is_open}
                onChange={e => updateHours(h, 'open_time', e.target.value)}
                className="w-28 text-sm"
              />
              <span className="text-gray-400 text-sm">às</span>
              <Input
                type="time"
                value={h.close_time ?? ''}
                disabled={!h.is_open}
                onChange={e => updateHours(h, 'close_time', e.target.value)}
                className="w-28 text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Datas fechadas */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarX size={18} className="text-red-500" /> Datas fechadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Motivo (opcional)"
              value={newDateReason}
              onChange={e => setNewDateReason(e.target.value)}
              className="flex-1"
            />
            <Button onClick={addClosedDate} className="bg-red-500 hover:bg-red-600 text-white">
              Adicionar
            </Button>
          </div>

          {closedDates.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma data fechada cadastrada</p>
          ) : (
            <ul className="space-y-1.5">
              {closedDates.map(d => (
                <li key={d.id} className="flex items-center justify-between text-sm bg-red-50 rounded-lg px-3 py-2">
                  <span className="font-medium">{new Date(d.date + 'T12:00').toLocaleDateString('pt-BR')}</span>
                  {d.reason && <span className="text-gray-500 text-xs">{d.reason}</span>}
                  <button
                    onClick={() => removeClosedDate(d.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
