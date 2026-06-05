'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Filter } from 'lucide-react'

export default function EstoqueFilter({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const router = useRouter()
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)

  function handleFilter() {
    const params = new URLSearchParams({ from, to })
    router.push(`/admin/estoque?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-gray-50 rounded-xl border">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">De</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Até</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            const v = e.target.value
            if (v >= from) setTo(v)
          }}
          min={from}
          className="w-40"
        />
      </div>
      <Button onClick={handleFilter} className="bg-orange-500 hover:bg-orange-600 text-white">
        <Filter size={16} className="mr-1" />
        Filtrar
      </Button>
    </div>
  )
}
