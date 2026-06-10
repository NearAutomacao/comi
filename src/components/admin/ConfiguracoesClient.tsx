'use client'

import { useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/pb/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getDayName } from '@/lib/utils'
import { toast } from 'sonner'
import { CreditCard, Clock, CalendarX, Settings, CheckCircle, AlertCircle, ExternalLink, Printer, MessageCircle } from 'lucide-react'
import type { WorkingHours, ClosedDate, Restaurant } from '@/types'

interface Props {
  restaurant: Restaurant | null
  initialHours: WorkingHours[]
  initialClosedDates: ClosedDate[]
}

export default function ConfiguracoesClient({ restaurant, initialHours, initialClosedDates }: Props) {
  const searchParams = useSearchParams()
  const mpStatus = searchParams.get('mp')
  const pbRef = useRef(createClient())

  const [restaurantName, setRestaurantName] = useState(restaurant?.name ?? '')
  const [hours, setHours] = useState(initialHours)
  const [closedDates, setClosedDates] = useState(initialClosedDates)
  const [newDate, setNewDate] = useState('')
  const [newDateReason, setNewDateReason] = useState('')
  const [whatsappContact, setWhatsappContact] = useState(restaurant?.whatsapp_contact ?? '')
  const [kitchenHost, setKitchenHost] = useState(restaurant?.printer_kitchen_host ?? '')
  const [kitchenPort, setKitchenPort] = useState(String(restaurant?.printer_kitchen_port ?? 9100))
  const [barHost, setBarHost] = useState(restaurant?.printer_bar_host ?? '')
  const [barPort, setBarPort] = useState(String(restaurant?.printer_bar_port ?? 9100))

  const mpConnected = !!restaurant?.mp_access_token

  async function saveRestaurantName() {
    if (!restaurant?.id) return
    await pbRef.current.collection('restaurants').update(restaurant.id, { name: restaurantName })
    toast.success('Nome atualizado')
  }

  async function saveWhatsapp() {
    if (!restaurant?.id) return
    const digits = whatsappContact.replace(/\D/g, '')
    await pbRef.current.collection('restaurants').update(restaurant.id, { whatsapp_contact: digits || null })
    toast.success('WhatsApp salvo')
  }

  async function updateHours(hour: WorkingHours, field: keyof WorkingHours, value: string | boolean) {
    await pbRef.current.collection('working_hours').update(hour.id, { [field]: value })
    setHours(prev => prev.map(h => h.id === hour.id ? { ...h, [field]: value } : h))
  }

  async function addClosedDate() {
    if (!newDate || !restaurant?.id) return
    const data = await pbRef.current.collection('closed_dates').create({
      restaurant_id: restaurant.id,
      date: newDate,
      reason: newDateReason || null,
    })
    setClosedDates(prev => [...prev, data as unknown as ClosedDate].sort((a, b) => a.date.localeCompare(b.date)))
    setNewDate('')
    setNewDateReason('')
    toast.success('Data adicionada')
  }

  async function removeClosedDate(id: string) {
    await pbRef.current.collection('closed_dates').delete(id)
    setClosedDates(prev => prev.filter(d => d.id !== id))
  }

  async function savePrinters() {
    if (!restaurant?.id) return
    await pbRef.current.collection('restaurants').update(restaurant.id, {
      printer_kitchen_host: kitchenHost || null,
      printer_kitchen_port: parseInt(kitchenPort) || 9100,
      printer_bar_host: barHost || null,
      printer_bar_port: parseInt(barPort) || 9100,
    })
    toast.success('Impressoras salvas')
  }

  async function disconnectMP() {
    if (!restaurant?.id) return
    await pbRef.current.collection('restaurants').update(restaurant.id, {
      mp_access_token: null,
      mp_refresh_token: null,
      mp_public_key: null,
      mp_user_id: null,
    })
    toast.success('MercadoPago desconectado')
    window.location.reload()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings size={18} className="text-orange-500" /> Restaurante
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do restaurante</Label>
            <div className="flex gap-2">
              <Input value={restaurantName} onChange={e => setRestaurantName(e.target.value)} />
              <Button onClick={saveRestaurantName} className="bg-orange-500 hover:bg-orange-600 text-white">
                Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle size={18} className="text-green-500" /> WhatsApp de contato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500">
            Número exibido no link de delivery para os clientes entrarem em contato.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="(11) 99999-0000"
              value={whatsappContact}
              onChange={e => setWhatsappContact(e.target.value)}
            />
            <Button onClick={saveWhatsapp} className="bg-green-600 hover:bg-green-700 text-white shrink-0">
              Salvar
            </Button>
          </div>
          <p className="text-xs text-gray-400">Informe apenas os dígitos ou com máscara. Ex: 47999990000</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={18} className="text-green-600" /> MercadoPago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mpStatus === 'success' && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
              <CheckCircle size={16} /> MercadoPago conectado com sucesso!
            </div>
          )}
          {mpStatus === 'error' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              <AlertCircle size={16} /> Erro ao conectar. Tente novamente.
            </div>
          )}

          {mpConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                <CheckCircle size={16} />
                <div>
                  <p className="font-medium">Conta conectada</p>
                  {restaurant?.mp_user_id && (
                    <p className="text-xs text-green-600">ID: {restaurant.mp_user_id}</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Os pagamentos de pedidos e reservas serão recebidos diretamente na sua conta MercadoPago.
              </p>
              <Button onClick={disconnectMP} variant="outline" className="text-red-500 border-red-300 hover:bg-red-50 text-sm">
                Desconectar conta
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Conecte sua conta MercadoPago para receber pagamentos de pedidos e reservas diretamente.
              </p>
              <a href="/api/mercadopago/connect">
                <Button className="bg-[#009ee3] hover:bg-[#0082c0] text-white flex items-center gap-2">
                  <ExternalLink size={16} />
                  Conectar MercadoPago
                </Button>
              </a>
              <p className="text-xs text-gray-400">
                Você será redirecionado para o MercadoPago para autorizar o acesso.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock size={18} className="text-blue-500" /> Horários de funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hours.length === 0 && (
            <p className="text-sm text-gray-400">Nenhum horário configurado.</p>
          )}
          {hours.map(h => (
            <div key={h.id} className="flex items-center gap-3 flex-wrap">
              <Switch checked={h.is_open} onCheckedChange={v => updateHours(h, 'is_open', v)} />
              <span className="w-20 text-sm font-medium">{getDayName(h.day_of_week)}</span>
              <Input type="time" value={h.open_time ?? ''} disabled={!h.is_open}
                onChange={e => updateHours(h, 'open_time', e.target.value)} className="w-28 text-sm" />
              <span className="text-gray-400 text-sm">às</span>
              <Input type="time" value={h.close_time ?? ''} disabled={!h.is_open}
                onChange={e => updateHours(h, 'close_time', e.target.value)} className="w-28 text-sm" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarX size={18} className="text-red-500" /> Datas fechadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="flex-1 min-w-32" />
            <Input placeholder="Motivo (opcional)" value={newDateReason} onChange={e => setNewDateReason(e.target.value)} className="flex-1 min-w-32" />
            <Button onClick={addClosedDate} className="bg-red-500 hover:bg-red-600 text-white">Adicionar</Button>
          </div>
          {closedDates.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma data fechada</p>
          ) : (
            <ul className="space-y-1.5">
              {closedDates.map(d => (
                <li key={d.id} className="flex items-center justify-between text-sm bg-red-50 rounded-lg px-3 py-2">
                  <span className="font-medium">{new Date(d.date + 'T12:00').toLocaleDateString('pt-BR')}</span>
                  {d.reason && <span className="text-gray-500 text-xs">{d.reason}</span>}
                  <button onClick={() => removeClosedDate(d.id)} className="text-red-400 hover:text-red-600 text-xs">Remover</button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer size={18} className="text-purple-500" /> Impressoras térmicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-500">
            Configure o IP das impressoras na rede local do restaurante. Porta padrão ESC/POS: <strong>9100</strong>.
          </p>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 font-medium">Cozinha</Label>
            <div className="flex gap-2">
              <Input
                placeholder="192.168.1.100"
                value={kitchenHost}
                onChange={e => setKitchenHost(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="9100"
                value={kitchenPort}
                onChange={e => setKitchenPort(e.target.value)}
                className="w-24"
                type="number"
              />
            </div>
            <p className="text-xs text-gray-400">Itens de comida são enviados para esta impressora.</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 font-medium">Bar</Label>
            <div className="flex gap-2">
              <Input
                placeholder="192.168.1.101"
                value={barHost}
                onChange={e => setBarHost(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="9100"
                value={barPort}
                onChange={e => setBarPort(e.target.value)}
                className="w-24"
                type="number"
              />
            </div>
            <p className="text-xs text-gray-400">Bebidas são enviadas para esta impressora.</p>
          </div>

          <Button onClick={savePrinters} className="bg-purple-500 hover:bg-purple-600 text-white">
            Salvar impressoras
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
