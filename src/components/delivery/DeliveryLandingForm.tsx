'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, MessageCircle } from 'lucide-react'

function maskPhone(v: string) {
  return v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2').slice(0, 15)
}

interface WorkingHour {
  day_of_week: number
  open_time: string | null
  close_time: string | null
  is_open: boolean
}

interface Props {
  slug: string
  restaurantName: string
  whatsappContact: string | null
  workingHours: WorkingHour[]
  closedDates: string[]
}

function useOpenStatus(workingHours: WorkingHour[], closedDates: string[]) {
  const [open, setOpen] = useState<boolean | null>(null)
  const [todayHours, setTodayHours] = useState<WorkingHour | null>(null)

  useEffect(() => {
    function compute() {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const todayStr = `${year}-${month}-${day}`
      const dayOfWeek = now.getDay()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      if (closedDates.includes(todayStr)) {
        setOpen(false)
        setTodayHours(null)
        return
      }

      const h = workingHours.find(w => w.day_of_week === dayOfWeek) ?? null
      setTodayHours(h)

      if (!h || !h.is_open || !h.open_time || !h.close_time) {
        setOpen(false)
        return
      }

      setOpen(currentTime >= h.open_time && currentTime <= h.close_time)
    }

    compute()
    // Recalcula a cada minuto
    const interval = setInterval(compute, 60_000)
    return () => clearInterval(interval)
  }, [workingHours, closedDates])

  return { open, todayHours }
}

function formatTime(t: string) {
  return t.slice(0, 5) // "HH:MM:SS" → "HH:MM"
}

export default function DeliveryLandingForm({ slug, restaurantName, whatsappContact, workingHours, closedDates }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { open, todayHours } = useOpenStatus(workingHours, closedDates)

  function whatsappLink() {
    const digits = (whatsappContact ?? '').replace(/\D/g, '')
    const number = digits.startsWith('55') ? digits : `55${digits}`
    return `https://wa.me/${number}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length < 2) {
      setError('Informe seu nome completo (nome e sobrenome)')
      return
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Informe um WhatsApp válido')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/delivery/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, guestName: name.trim(), guestPhone: phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao entrar')
        setLoading(false)
        return
      }
      window.location.href = `/delivery/${slug}/cardapio`
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/icomi-nobg.png" alt="comi" width={80} height={80} className="mx-auto mb-3 drop-shadow-md" />
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-1">Delivery</p>
          <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {restaurantName || 'Cardápio'}
          </h1>

          {/* Badge aberto/fechado */}
          {open !== null && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                <span className={`w-2 h-2 rounded-full ${open ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
                {open ? 'Aberto agora' : 'Fechado agora'}
              </span>
              {todayHours?.is_open && todayHours.open_time && todayHours.close_time && (
                <p className="text-xs text-gray-400">
                  Hoje: {formatTime(todayHours.open_time)} às {formatTime(todayHours.close_time)}
                </p>
              )}
              {!open && !todayHours?.is_open && (
                <p className="text-xs text-gray-400">Sem atendimento hoje</p>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="font-medium">Seu nome completo *</Label>
            <Input
              id="name"
              placeholder="João da Silva"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={loading}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="font-medium">WhatsApp *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 99999-0000"
              value={phone}
              onChange={e => setPhone(maskPhone(e.target.value))}
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-400">Usado para confirmar seu pedido</p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 mt-2"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin mr-2" />Entrando...</>
              : 'Ver cardápio →'
            }
          </Button>
        </form>

        {/* Botão WhatsApp */}
        {whatsappContact && (
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-11 rounded-xl transition-colors text-sm"
          >
            <MessageCircle size={18} />
            Falar com o restaurante
          </a>
        )}

      </div>
    </main>
  )
}
