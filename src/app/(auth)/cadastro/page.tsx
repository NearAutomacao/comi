'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { signUp } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

function maskCPF(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14)
}

function maskPhone(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
    .slice(0, 15)
}

export default function CadastroPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const searchParams = useSearchParams()
  const next = searchParams.get('next')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)
    form.set('cpf', cpf)
    form.set('phone', phone)
    if (next) form.set('next', next)
    const result = await signUp(form)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <Image src="/icomi-nobg.png" alt="comi" width={72} height={72} className="mx-auto mb-2" priority />
          <CardTitle className="text-2xl font-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
            com<span className="text-orange-500">i</span>
          </CardTitle>
          <CardDescription>Cadastre-se para fazer pedidos e reservas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" name="name" required placeholder="João da Silva" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                name="cpf"
                required
                placeholder="000.000.000-00"
                value={cpf}
                onChange={e => setCpf(maskCPF(e.target.value))}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input
                id="phone"
                name="phone"
                required
                placeholder="(11) 99999-0000"
                value={phone}
                onChange={e => setPhone(maskPhone(e.target.value))}
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5"
            >
              {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              Criar conta
            </Button>
          </form>
          <p className="text-center text-sm text-gray-600 mt-4">
            Já tem conta?{' '}
            <Link href="/login" className="text-orange-600 font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
