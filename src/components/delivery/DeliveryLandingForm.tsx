'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShoppingBag } from 'lucide-react'

function maskPhone(v: string) {
  return v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2').slice(0, 15)
}

export default function DeliveryLandingForm({ slug }: { slug: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      router.push(`/delivery/${slug}/cardapio`)
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShoppingBag size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Delivery
          </h1>
          <p className="text-gray-500 text-sm mt-1">Informe seus dados para ver o cardápio</p>
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

        <div className="mt-6 flex justify-center">
          <Image src="/icomi-nobg.png" alt="comi" width={32} height={32} className="opacity-30" />
        </div>
      </div>
    </main>
  )
}
