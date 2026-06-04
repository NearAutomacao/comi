'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, UtensilsCrossed, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'

function maskPhone(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
    .slice(0, 15)
}

export default function CheckinPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tableId = searchParams.get('table')
  
  const [table, setTable] = useState<{ id: string; number: number; capacity: number } | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Verifica se mesa existe
  useEffect(() => {
    async function fetchTable() {
      if (!tableId) {
        setError('Mesa não informada')
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('tables')
          .select('id, number, capacity')
          .eq('id', tableId)
          .single()

        if (error || !data) {
          setError('Mesa não encontrada')
          setLoading(false)
          return
        }

        setTable(data)
        setLoading(false)
      } catch (err) {
        setError('Erro ao carregar mesa')
        setLoading(false)
      }
    }

    fetchTable()
  }, [tableId, supabase])

  async function handleCheckin(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Informe seu nome')
      return
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      toast.error('Informe um telefone válido')
      return
    }
    if (!tableId) {
      toast.error('Mesa não informada')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/mesa/sit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          guestName: name.trim(),
          guestPhone: phone.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(data.error || 'Erro ao fazer check-in')
      }

      const data = await res.json()
      toast.success(`Mesa ${data.tableNumber} pronta! Bom apetite.`)
      
      // Redireciona para cardápio (agora protegido e com sessão válida)
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
        <Button
          onClick={() => router.push('/')}
          className="mt-6 bg-orange-500 hover:bg-orange-600"
        >
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed size={36} className="text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Bem-vindo!</h1>
          <p className="text-gray-500 mt-2">Mesa {table.number}</p>
          <p className="text-sm text-gray-400 mt-1">Capacidade para {table.capacity} pessoas</p>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
          <Lock size={20} className="text-blue-600 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">Sessão segura</p>
            <p className="text-xs mt-1">Seu check-in expira em 8 horas</p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleCheckin} className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <p className="text-sm text-gray-600 font-medium">
            Preencha seus dados para acessar o cardápio
          </p>

          <div className="space-y-2">
            <Label htmlFor="name" className="font-medium">
              Seu nome *
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="João da Silva"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={submitting}
              autoFocus
              required
            />
            {name && <p className="text-xs text-gray-500">✓ Preenchido</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="font-medium">
              Seu telefone *
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 9 1234-5678"
              value={phone}
              onChange={e => setPhone(maskPhone(e.target.value))}
              disabled={submitting}
              required
            />
            {phone.replace(/\D/g, '').length >= 10 && (
              <p className="text-xs text-gray-500">✓ Válido</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting || !name.trim() || phone.replace(/\D/g, '').length < 10}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium h-12 mt-6"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Entrando...
              </>
            ) : (
              'Entrar na Mesa'
            )}
          </Button>

          <p className="text-xs text-gray-400 text-center pt-2">
            Você receberá uma sessão segura por 8 horas
          </p>
        </form>
      </div>
    </div>
  )
}
