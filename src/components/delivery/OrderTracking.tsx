'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/pb/client'
import { formatCurrency } from '@/lib/utils'
import Image from 'next/image'
import { CheckCircle, ChefHat, Clock, PackageCheck, Truck, XCircle } from 'lucide-react'

const STEPS = [
  { key: 'open',      label: 'Pedido recebido',   icon: Clock },
  { key: 'preparing', label: 'Em preparo',         icon: ChefHat },
  { key: 'served',    label: 'Saiu para entrega',  icon: Truck },
  { key: 'closed',    label: 'Entregue',           icon: PackageCheck },
] as const

type OrderStatus = 'open' | 'preparing' | 'served' | 'closed' | 'cancelled'

const statusMeta: Record<OrderStatus, { label: string; icon: React.ElementType; color: string; bg: string; ring: string }> = {
  open:      { label: 'Pedido recebido',   icon: Clock,        color: 'text-blue-500',   bg: 'bg-blue-50',   ring: 'ring-blue-200' },
  preparing: { label: 'Em preparo',        icon: ChefHat,      color: 'text-yellow-500', bg: 'bg-yellow-50', ring: 'ring-yellow-200' },
  served:    { label: 'Saiu para entrega', icon: Truck,        color: 'text-purple-500', bg: 'bg-purple-50', ring: 'ring-purple-200' },
  closed:    { label: 'Pedido entregue!',  icon: PackageCheck, color: 'text-green-500',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  cancelled: { label: 'Pedido cancelado',  icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-50',    ring: 'ring-red-200' },
}

interface OrderItem {
  quantity: number
  unit_price: number
  menu_item: { name: string } | null
}

interface Props {
  slug: string
  guestName: string
  orderId: string
  orderCode: number | null
  initialStatus: string
  total: number
  orderItems: OrderItem[]
}

export default function OrderTracking({ slug, guestName, orderId, orderCode, initialStatus, total, orderItems }: Props) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus as OrderStatus)
  const pbRef = useRef(createClient())

  const meta = statusMeta[status] ?? statusMeta.open
  const Icon = meta.icon
  const stepIndex = STEPS.findIndex(s => s.key === status)
  const isDone = status === 'closed' || status === 'cancelled'

  // Polling: atualiza status conforme o admin avança o pedido
  useEffect(() => {
    if (isDone) return
    const pb = pbRef.current

    async function poll() {
      try {
        const order = await pb.collection('orders').getOne(orderId, { fields: 'id,status' })
        setStatus(order.status as OrderStatus)
      } catch {}
    }

    poll()
    const interval = setInterval(poll, 4_000)
    return () => clearInterval(interval)
  }, [orderId, isDone])

  // Quando entregue/cancelado: espera 3s e faz logout
  useEffect(() => {
    if (!isDone) return
    const t = setTimeout(() => {
      fetch('/api/delivery/logout', { method: 'POST' })
        .finally(() => { window.location.href = `/delivery/${slug}` })
    }, 3000)
    return () => clearTimeout(t)
  }, [isDone, slug])

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image src="/icomi-nobg.png" alt="comi" width={56} height={56} className="drop-shadow-sm" />
        </div>

        {/* Status principal */}
        <div className="text-center mb-8">
          <div className={`w-24 h-24 rounded-full ${meta.bg} ring-4 ${meta.ring} flex items-center justify-center mx-auto mb-4 transition-all duration-500`}>
            <Icon size={48} className={`${meta.color} transition-colors duration-500`} />
          </div>
          <h1 className="text-2xl font-black text-gray-800">{meta.label}</h1>
          {orderCode != null && (
            <p className="text-lg font-bold text-orange-500 mt-1">
              Pedido #{String(orderCode).padStart(3, '0')}
            </p>
          )}
          <p className="text-gray-500 text-sm mt-1">
            Olá, <strong>{guestName.split(' ')[0]}</strong>!
          </p>
          {isDone && (
            <p className="text-xs text-gray-400 mt-2 animate-pulse">Redirecionando em instantes...</p>
          )}
        </div>

        {/* Timeline de progresso */}
        {status !== 'cancelled' && (
          <div className="bg-white rounded-2xl border shadow-sm p-5 mb-5">
            <div className="space-y-4">
              {STEPS.map(({ key, label, icon: StepIcon }, i) => {
                const done = stepIndex > i || status === 'closed'
                const current = stepIndex === i && status !== 'closed'
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${done ? 'bg-green-500 text-white' : current ? 'bg-orange-500 text-white ring-4 ring-orange-100' : 'bg-gray-100 text-gray-400'}`}>
                      <StepIcon size={16} />
                    </div>
                    <span className={`text-sm font-medium ${done || current ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
                    {current && (
                      <span className="ml-auto text-xs text-orange-500 font-semibold animate-pulse">Agora</span>
                    )}
                    {done && (
                      <span className="ml-auto">
                        <CheckCircle size={14} className="text-green-500" />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Resumo do pedido */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Resumo do pedido</p>
          <ul className="space-y-2">
            {orderItems.map((oi, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">{oi.quantity}× {oi.menu_item?.name ?? 'Item'}</span>
                <span className="font-medium">{formatCurrency(oi.unit_price * oi.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t mt-3 pt-3 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-orange-600">{formatCurrency(total)}</span>
          </div>
        </div>

      </div>
    </main>
  )
}
