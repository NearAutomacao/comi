'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { CreditCard, Loader2, Smartphone, Users, CheckCircle2, Banknote, Receipt, User } from 'lucide-react'

type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash'

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  notes?: string | null
  menu_item?: { name: string }
}

interface Order {
  id: string
  total: number
  status: string
  restaurant_id: string
  code: number | null
  session_id: string | null
  order_items: OrderItem[]
}

interface Session {
  id: string
  guest_name: string
}

interface PersonPayment {
  name: string
  amount: number
  method: PaymentMethod
}

const methodLabels: Record<PaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  cash: 'Dinheiro',
}

const methodIcon = (m: PaymentMethod) => {
  if (m === 'pix') return <Smartphone size={12} />
  if (m === 'cash') return <Banknote size={12} />
  return <CreditCard size={12} />
}

type SplitMode = 'custom' | 'by_session'

export default function ContaPage() {
  const router = useRouter()
  const { tableId, tableNumber, sessionId, clearSession } = useCartStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [paid, setPaid] = useState(false)
  const [splitMode, setSplitMode] = useState<SplitMode>('custom')
  const [splitCount, setSplitCount] = useState(1)
  const [persons, setPersons] = useState<PersonPayment[]>([{ name: '', amount: 0, method: 'pix' }])
  const [sessionPayments, setSessionPayments] = useState<Record<string, PaymentMethod>>({})

  useEffect(() => {
    if (!tableId) { router.replace('/pedidos'); return }

    fetch(`/api/conta?tableId=${tableId}`)
      .then(r => r.json())
      .then(({ orders: fetched, sessions: fetchedSessions }) => {
        const fetchedOrders: Order[] = fetched ?? []
        const fetchedSessionsList: Session[] = fetchedSessions ?? []

        setOrders(fetchedOrders)
        setSessions(fetchedSessionsList)

        const total = fetchedOrders.reduce((s: number, o: Order) => s + (o.total ?? 0), 0)
        setPersons([{ name: '', amount: total, method: 'pix' }])

        // Inicializa método de pagamento por sessão
        const initMethods: Record<string, PaymentMethod> = {}
        fetchedSessionsList.forEach(s => { initMethods[s.id] = 'pix' })
        setSessionPayments(initMethods)

        // Se tem múltiplas sessões, sugere modo por comanda
        if (fetchedSessionsList.length > 1) setSplitMode('by_session')
      })
      .finally(() => setLoading(false))
  }, [tableId])

  const grandTotal = orders.reduce((s, o) => s + (o.total ?? 0), 0)

  // Agrupa pedidos por sessão
  const ordersBySession = sessions.map(session => {
    const sessionOrders = orders.filter(o => o.session_id === session.id)
    const total = sessionOrders.reduce((s, o) => s + (o.total ?? 0), 0)
    const items = sessionOrders.flatMap(o => o.order_items ?? [])
    return { session, orders: sessionOrders, total, items }
  })

  // Pedidos sem sessão (legados ou do caixa)
  const ordersWithoutSession = orders.filter(o => !o.session_id)
  const totalWithoutSession = ordersWithoutSession.reduce((s, o) => s + (o.total ?? 0), 0)

  function updateSplit(count: number) {
    const n = Math.max(1, count)
    setSplitCount(n)
    const perPerson = Math.floor((grandTotal / n) * 100) / 100
    const remainder = Math.round((grandTotal - perPerson * n) * 100) / 100
    setPersons(Array.from({ length: n }, (_, i) => ({
      name: persons[i]?.name ?? '',
      amount: i === 0 ? perPerson + remainder : perPerson,
      method: persons[i]?.method ?? 'pix',
    })))
  }

  function updatePerson(i: number, field: keyof PersonPayment, value: string | number) {
    setPersons(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  const sumPersons = persons.reduce((s, p) => s + p.amount, 0)
  const balanced = Math.abs(sumPersons - grandTotal) <= 0.01

  async function handlePay() {
    if (!tableId) return
    setSubmitting(true)

    const restaurantId = orders[0]?.restaurant_id ?? ''
    let payments: { order_id: string; restaurant_id: string; method: string; amount: number }[] = []

    if (splitMode === 'by_session') {
      // Cada sessão paga seus próprios pedidos
      for (const { session, orders: sessionOrders } of ordersBySession) {
        const method = sessionPayments[session.id] ?? 'pix'
        for (const order of sessionOrders) {
          payments.push({ order_id: order.id, restaurant_id: restaurantId, method, amount: order.total })
        }
      }
      // Pedidos sem sessão divididos entre todos
      if (ordersWithoutSession.length > 0 && grandTotal > 0) {
        for (const order of ordersWithoutSession) {
          payments.push({ order_id: order.id, restaurant_id: restaurantId, method: 'pix', amount: order.total })
        }
      }
    } else {
      // Divisão customizada
      if (!balanced) { toast.error('A soma dos valores não bate com o total'); setSubmitting(false); return }
      payments = orders.flatMap(order =>
        persons.map(p => ({
          order_id: order.id,
          restaurant_id: restaurantId,
          method: p.method,
          amount: p.amount / orders.length,
        }))
      )
    }

    const res = await fetch('/api/conta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, payments }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      toast.error('Erro: ' + error)
      setSubmitting(false)
      return
    }

    clearSession()
    setPaid(true)
  }

  const allItems = orders
    .flatMap(o => o.order_items ?? [])
    .reduce<Record<string, { name: string; qty: number; price: number }>>((acc, item) => {
      const name = item.menu_item?.name ?? 'Item'
      if (!acc[name]) acc[name] = { name, qty: 0, price: item.unit_price }
      acc[name].qty += item.quantity
      return acc
    }, {})

  if (paid) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <CheckCircle2 size={64} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">Conta paga!</h2>
        <p className="text-gray-500 mt-2">Obrigado pela visita. Volte sempre!</p>
        <Button onClick={() => router.push('/')} className="mt-8 bg-orange-500 hover:bg-orange-600 text-white w-full">
          Voltar ao início
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-orange-400" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-gray-400 text-lg">Nenhum pedido em aberto para esta mesa.</p>
        <Button onClick={() => router.push('/cardapio')} className="mt-6 bg-orange-500 hover:bg-orange-600 text-white">
          Ver cardápio
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-32">
      <h1 className="text-2xl font-bold mb-1">Fechar conta</h1>
      <p className="text-sm text-gray-500 mb-6">Mesa {tableNumber}</p>

      {/* Resumo do consumo */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Resumo do consumo</p>
        <ul className="space-y-2">
          {Object.values(allItems).map(item => (
            <li key={item.name} className="flex justify-between text-sm text-gray-700">
              <span>{item.qty}× {item.name}</span>
              <span className="font-medium">{formatCurrency(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <Separator className="my-3" />
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span className="text-orange-600">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      {/* Abas de divisão */}
      {sessions.length > 1 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSplitMode('by_session')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              splitMode === 'by_session'
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            <User size={14} className="inline mr-1" />
            Por comanda
          </button>
          <button
            onClick={() => setSplitMode('custom')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              splitMode === 'custom'
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            <Users size={14} className="inline mr-1" />
            Dividir
          </button>
        </div>
      )}

      {/* Modo: por comanda (sessão) */}
      {splitMode === 'by_session' && sessions.length > 0 && (
        <div className="space-y-3 mb-4">
          {ordersBySession.map(({ session, items, total }) => (
            <div key={session.id} className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                    <User size={14} className="text-orange-600" />
                  </div>
                  <span className="font-medium text-sm text-gray-800">{session.guest_name}</span>
                  {session.id === sessionId && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">você</span>
                  )}
                </div>
                <span className="font-bold text-orange-600 text-sm">{formatCurrency(total)}</span>
              </div>
              <ul className="text-xs text-gray-500 space-y-1 mb-3">
                {items.map((item, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{item.quantity}× {item.menu_item?.name ?? 'Item'}</span>
                    <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <Select
                value={sessionPayments[session.id] ?? 'pix'}
                onValueChange={v => setSessionPayments(prev => ({ ...prev, [session.id]: v as PaymentMethod }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <div className="flex items-center gap-1">
                    {methodIcon(sessionPayments[session.id] ?? 'pix')}
                    <span>{methodLabels[sessionPayments[session.id] ?? 'pix']}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit_card">Crédito</SelectItem>
                  <SelectItem value="debit_card">Débito</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}

          {ordersWithoutSession.length > 0 && (
            <div className="bg-gray-50 rounded-xl border p-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span className="flex items-center gap-1">
                  <Receipt size={14} />
                  Consumo geral
                </span>
                <span className="font-medium">{formatCurrency(totalWithoutSession)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modo: divisão customizada */}
      {splitMode === 'custom' && (
        <div className="bg-white rounded-xl border shadow-sm p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Users size={18} className="text-gray-500" />
            <span className="text-sm font-medium">Dividir entre</span>
            <Input
              type="number"
              min="1"
              max="20"
              value={splitCount}
              onChange={e => updateSplit(parseInt(e.target.value) || 1)}
              className="w-20 h-8 text-sm"
            />
            <span className="text-sm text-gray-500">pessoa(s)</span>
          </div>

          <div className="space-y-3">
            {persons.map((person, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600 flex-shrink-0">
                  {i + 1}
                </div>
                <Input
                  placeholder="Nome (opcional)"
                  value={person.name}
                  onChange={e => updatePerson(i, 'name', e.target.value)}
                  className="flex-1 h-8 text-sm"
                />
                <Input
                  type="number"
                  value={person.amount}
                  onChange={e => updatePerson(i, 'amount', parseFloat(e.target.value) || 0)}
                  className="w-24 h-8 text-sm"
                  step="0.01"
                />
                <Select value={person.method} onValueChange={v => updatePerson(i, 'method', v as PaymentMethod)}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <div className="flex items-center gap-1">
                      {methodIcon(person.method)}
                      <span>{methodLabels[person.method]}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credit_card">Crédito</SelectItem>
                    <SelectItem value="debit_card">Débito</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {!balanced && (
            <p className="text-xs text-red-500 mt-2">
              Soma: {formatCurrency(sumPersons)} · Faltam: {formatCurrency(grandTotal - sumPersons)}
            </p>
          )}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handlePay}
            disabled={submitting || (splitMode === 'custom' && !balanced)}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-base"
          >
            {submitting ? (
              <><Loader2 size={18} className="animate-spin mr-2" /> Processando...</>
            ) : (
              `Confirmar pagamento — ${formatCurrency(grandTotal)}`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
