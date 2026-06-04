'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, UtensilsCrossed, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { Table } from '@/types'

interface Props {
  table: Table
  blockedByOther: boolean
}

function maskPhone(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
    .slice(0, 15)
}

export default function TableSelection({ table, blockedByOther }: Props) {
  const router = useRouter()
  const { setTable, setGuest } = useCartStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  if (blockedByOther) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertTriangle size={56} className="mx-auto text-yellow-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Mesa reservada</h2>
        <p className="text-gray-500 mt-2">Esta mesa está reservada por outro cliente hoje.</p>
      </div>
    )
  }

  async function handleSit() {
    if (!name.trim()) { toast.error('Informe seu nome'); return }
    if (!phone.trim()) { toast.error('Informe seu telefone'); return }

    setLoading(true)

    const res = await fetch('/api/mesa/sit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: table.id, guestName: name.trim(), guestPhone: phone.trim() }),
    })

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
      toast.error(error ?? 'Não foi possível entrar na mesa')
      setLoading(false)
      return
    }

    const { tableNumber, restaurantId } = await res.json()
    setTable(table.id, tableNumber)
    setGuest(name.trim(), phone.trim(), restaurantId)
    toast.success(`Mesa ${tableNumber} pronta! Bom apetite.`)
    router.push('/cardapio')
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
          <UtensilsCrossed size={36} className="text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Mesa {table.number}</h2>
        <p className="text-gray-500 mt-1">Capacidade para {table.capacity} pessoas</p>
        {table.status === 'occupied' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3 text-sm text-yellow-700">
            Esta mesa já está ocupada. Confirme se é você.
          </div>
        )}
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
        <p className="text-sm text-gray-500 text-center font-medium">
          Informe seus dados para acessar o cardápio
        </p>

        <div className="space-y-1">
          <Label htmlFor="guest-name">Seu nome</Label>
          <Input
            id="guest-name"
            placeholder="João da Silva"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSit()}
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="guest-phone">Telefone / WhatsApp</Label>
          <Input
            id="guest-phone"
            placeholder="(11) 99999-0000"
            value={phone}
            onChange={e => setPhone(maskPhone(e.target.value))}
            onKeyDown={e => e.key === 'Enter' && handleSit()}
            inputMode="tel"
          />
        </div>

        <Button
          onClick={handleSit}
          disabled={loading || !name.trim() || !phone.trim()}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-base"
        >
          {loading
            ? <><Loader2 size={18} className="animate-spin mr-2" />Entrando...</>
            : 'Entrar na mesa'
          }
        </Button>

        <div className="flex items-center gap-2 justify-center text-xs text-gray-400">
          <ShieldCheck size={13} />
          Dados usados apenas para controle interno do restaurante.
        </div>
      </div>
    </div>
  )
}
