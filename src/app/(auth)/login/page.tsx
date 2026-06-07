'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'

function LoginForm() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn(new FormData(e.currentTarget))

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Se veio de uma URL específica (ex: /mesa/uuid via QR code), volta pra lá
    if (next) {
      window.location.href = next
      return
    }

    // Hard redirect — força reload completo sem cache do proxy
    window.location.href = result?.role === 'manager' ? '/admin/dashboard' : '/cardapio'
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <Image src="/icomi-nobg.png" alt="comi" width={72} height={72} className="mx-auto mb-2" priority />
          <CardTitle className="text-2xl font-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
            com<span className="text-orange-500">i</span>
          </CardTitle>
          <CardDescription>Acesse o painel do seu restaurante</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
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
              Entrar
            </Button>
          </form>
          <p className="text-center text-sm text-gray-600 mt-4">
            Não tem conta?{' '}
            <Link href="/cadastro-restaurante" className="text-orange-600 font-medium hover:underline">
              Cadastrar restaurante
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
