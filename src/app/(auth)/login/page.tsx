'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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

    // Hard redirect — força reload completo sem cache do proxy
    window.location.href = result?.role === 'manager' ? '/admin/dashboard' : '/cardapio'
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl text-white font-bold">C</span>
          </div>
          <CardTitle className="text-2xl text-orange-600">Entrar</CardTitle>
          <CardDescription>Acesse seu cardápio e reservas</CardDescription>
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
            <Link href="/cadastro" className="text-orange-600 font-medium hover:underline">
              Cadastre-se
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
