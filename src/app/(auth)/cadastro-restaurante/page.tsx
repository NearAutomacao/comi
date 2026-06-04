'use client'

import { useState } from 'react'
import Image from 'next/image'
import { signUpManager } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { Loader2, Store, CheckCircle } from 'lucide-react'

function maskCPF(value: string) {
  return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14)
}
function maskPhone(value: string) {
  return value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2').slice(0, 15)
}

const benefits = [
  'Cardápio digital com QR Code',
  'Mapa de mesas em tempo real',
  'Pedidos e pagamentos integrados',
  'Relatório de custos e estoque',
  'Reservas com pagamento automático',
]

export default function CadastroRestaurantePage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)
    form.set('cpf', cpf)
    form.set('phone', phone)
    const result = await signUpManager(form)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        {/* Benefícios */}
        <div className="hidden md:block">
          <div className="flex items-center gap-3 mb-6">
            <Image src="/icomi-nobg.png" alt="comi" width={52} height={52} />
            <div>
              <h1 className="text-2xl font-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
                com<span className="text-orange-500">i</span>
              </h1>
              <p className="text-sm text-gray-500">Sistema para restaurantes</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Gerencie seu restaurante de qualquer lugar
          </h2>
          <ul className="space-y-3">
            {benefits.map(b => (
              <li key={b} className="flex items-center gap-2 text-gray-600">
                <CheckCircle size={18} className="text-orange-500 flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Formulário */}
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <Image src="/icomi-nobg.png" alt="comi" width={52} height={52} className="mx-auto mb-1 md:hidden" />
            <CardTitle className="text-xl font-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Cadastrar restaurante
            </CardTitle>
            <CardDescription>Crie sua conta de gerente gratuitamente</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">Seu nome</Label>
                <Input id="name" name="name" required placeholder="João da Silva" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" required placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(maskCPF(e.target.value))} inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" required placeholder="(11) 99999-0000" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} inputMode="tel" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" required minLength={6} />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 mt-2">
                {loading ? <><Loader2 className="animate-spin mr-2" size={16} /> Criando conta...</> : 'Criar conta grátis'}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-4">
              Já tem conta?{' '}
              <Link href="/login" className="text-orange-600 font-medium hover:underline">Entrar</Link>
            </p>
            <p className="text-center text-xs text-gray-400 mt-2">
              É cliente?{' '}
              <Link href="/cadastro" className="hover:underline">Cadastro de cliente</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
