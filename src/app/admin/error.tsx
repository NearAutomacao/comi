'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[admin error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <AlertTriangle size={48} className="text-red-400 mb-4" />
      <h2 className="text-xl font-bold text-gray-800 mb-2">Erro ao carregar página</h2>
      <p className="text-sm text-gray-500 mb-1">{error.message || 'Ocorreu um erro inesperado'}</p>
      {error.digest && <p className="text-xs text-gray-400 mb-4">Código: {error.digest}</p>}
      <Button onClick={unstable_retry} className="bg-orange-500 hover:bg-orange-600 text-white">
        Tentar novamente
      </Button>
    </div>
  )
}
