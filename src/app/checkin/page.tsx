'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Suspense } from 'react'
import { createClient } from '@/lib/pb/client'
import { useCartStore } from '@/store/cartStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, UtensilsCrossed, Loader2, Lock, Users } from 'lucide-react'
import { toast } from 'sonner'

function maskPhone(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
    .slice(0, 15)
}

interface TableInfo {
  id: string
  number: number
  capacity: number
  status: string
  guest_name: string | null
}

function CheckinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tableId = searchParams.get('table')
  const { setTable, setGuest } = useCartStore()

  const [table, setTableData] = useState<TableInfo | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isJoining = table?.status === 'occupied'

  useEffect(() => {
    async function fetchTable() {
      if (!tableId) {
        setError('Mesa não informada')
        setLoading(false)
        return
      }
      try {
        const pb = createClient()
        const data = await pb.collection('tables').getOne(tableId)
        setTableData(data as unknown as TableInfo)
        setLoading(false)
      } catch {
        setError('Mesa não encontrada')
        setLoading(false)
      }
    }
    fetchTable()
  }, [tableId])

  async function handleCheckin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Informe seu nome'); return }
    if (!isJoining && (!phone.trim() || phone.replace(/\D/g, '').length < 10)) {
      toast.error('Informe um telefone válido'); return
    }
    if (!tableId) { toast.error('Mesa não informada'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/mesa/sit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, guestName: name.trim(), guestPhone: phone.trim() || '' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(data.error || 'Erro ao fazer check-in')
      }
      const data = await res.json()
      setTable(tableId, data.tableNumber)
      setGuest(name.trim(), phone.trim(), data.restaurantId, data.sessionId)
      if (data.isJoining) {
        toast.success(`Bem-vindo(a)! Sua comanda na Mesa ${data.tableNumber} foi aberta.`)
      } else {
        toast.success(`Mesa ${data.tableNumber} pronta! Bom apetite.`)
      }
      router.push('/cardapio')
    } catch (err) {
      toast.error(String(err))
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    )
  }

  if (error || !table) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertTriangle size={56} className="mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Erro</h2>
        <p className="text-gray-500 mt-2">{error || 'Mesa não encontrada'}</p>
        <Button onClick={() => router.push('/')} className="mt-6 bg-orange-500 hover:bg-orange-600">Voltar</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
            {isJoining ? <Users size={36} className="text-orange-500" /> : <UtensilsCrossed size={36} className="text-orange-500" />}
          </div>
          {isJoining ? (
            <>
              <h1 className="text-2xl font-bold text-gray-800">Olá! A mesa {table.number} já tem pessoas.</h1>
              <p className="text-gray-500 mt-2">Informe seu nome para abrir sua comanda separada.</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-800">Bem-vindo!</h1>
              <p className="text-gray-500 mt-2">Mesa {table.number}</p>
              <p className="text-sm text-gray-400 mt-1">Capacidade para {table.capacity} pessoas</p>
            </>
          )}
        </div>

        {isJoining && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex gap-3">
            <Users size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-700">
              <p className="font-medium">Mesa em uso</p>
              <p className="text-xs mt-1">Cada pessoa tem sua própria comanda. Você vê só o que pediu.</p>
            </div>
          </div>
        )}

        {!isJoining && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
            <Lock size={20} className="text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">Sessão segura</p>
              <p className="text-xs mt-1">Seu check-in expira em 8 horas</p>
            </div>
          </div>
        )}

        <form onSubmit={handleCheckin} className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <p className="text-sm text-gray-600 font-medium">
            {isJoining ? 'Como você se chama?' : 'Preencha seus dados para acessar o cardápio'}
          </p>
          <div className="space-y-2">
            <Label htmlFor="name" className="font-medium">Seu nome *</Label>
            <Input id="name" type="text" placeholder="João da Silva" value={name} onChange={e => setName(e.target.value)} disabled={submitting} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="font-medium">
              Telefone {isJoining ? <span className="text-gray-400 font-normal">(opcional)</span> : '*'}
            </Label>
            <Input id="phone" type="tel" placeholder="(11) 9 1234-5678" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} disabled={submitting} required={!isJoining} />
          </div>
          <Button
            type="submit"
            disabled={submitting || !name.trim() || (!isJoining && phone.replace(/\D/g, '').length < 10)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium h-12 mt-6"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin mr-2" />Entrando...</>
            ) : isJoining ? 'Abrir minha comanda' : 'Entrar na Mesa'}
          </Button>
          <p className="text-xs text-gray-400 text-center pt-2">
            {isJoining ? 'Sua comanda é separada das outras pessoas da mesa' : 'Você receberá uma sessão segura por 8 horas'}
          </p>
        </form>
      </div>
    </div>
  )
}

export default function CheckinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin text-orange-500" /></div>}>
      <CheckinContent />
    </Suspense>
  )
}
