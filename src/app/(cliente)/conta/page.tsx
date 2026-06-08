'use client'

import { useEffect, useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, CheckCircle2, Receipt } from 'lucide-react'

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  menu_item?: { name: string }
}

interface Order {
  id: string
  total: number
  order_items: OrderItem[]
}

interface ReceiptLine {
  name: string
  qty: number
  price: number
}

const SITE_URL = 'https://comi.awplabs.com.br/'

export default function ContaPage() {
  const { tableId, tableNumber, clearSession } = useCartStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [receipt, setReceipt] = useState<{ lines: ReceiptLine[]; total: number; tableNumber: number | null } | null>(null)

  useEffect(() => {
    if (!tableId) { window.location.href = SITE_URL; return }

    fetch(`/api/conta?tableId=${tableId}`)
      .then(r => r.json())
      .then(({ orders: fetched }) => {
        setOrders(fetched ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tableId])

  const allItems = orders
    .flatMap(o => o.order_items ?? [])
    .reduce<Record<string, ReceiptLine>>((acc, item) => {
      const name = item.menu_item?.name ?? 'Item'
      if (!acc[name]) acc[name] = { name, qty: 0, price: item.unit_price }
      acc[name].qty += item.quantity
      return acc
    }, {})

  const grandTotal = orders.reduce((s, o) => s + (o.total ?? 0), 0)

  async function handleClose() {
    setClosing(true)
    const lines = Object.values(allItems)
    const total = grandTotal

    // Fecha pedidos e libera mesa no servidor (pagamento ocorre no caixa)
    await fetch('/api/conta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, skipPayment: true }),
    })

    clearSession()
    document.cookie = 'mesa_session=; Max-Age=0; path=/'
    document.cookie = 'comi_restaurant_id=; Max-Age=0; path=/'
    setReceipt({ lines, total, tableNumber })
  }

  // Tela de comprovante (após fechar aba)
  if (receipt) {
    return (
      <div className="max-w-sm mx-auto px-4 py-10 text-center">
        <CheckCircle2 size={52} className="mx-auto text-green-500 mb-3" />
        <h2 className="text-xl font-bold text-gray-800">Resumo do consumo</h2>
        {receipt.tableNumber && (
          <p className="text-sm text-gray-500 mt-1 mb-6">Mesa {receipt.tableNumber}</p>
        )}

        <div className="bg-white rounded-xl border shadow-sm p-4 text-left mb-6">
          <ul className="space-y-2">
            {receipt.lines.map(item => (
              <li key={item.name} className="flex justify-between text-sm text-gray-700">
                <span>{item.qty}× {item.name}</span>
                <span className="font-medium">{formatCurrency(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <Separator className="my-3" />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-orange-600">{formatCurrency(receipt.total)}</span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-6">Dirija-se ao caixa para efetuar o pagamento.</p>
        <Button
          onClick={() => { window.location.href = SITE_URL }}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          Voltar ao site
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
        <Button onClick={() => { window.location.href = SITE_URL }} className="mt-6 bg-orange-500 hover:bg-orange-600 text-white">
          Ir para o site
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Receipt size={22} className="text-orange-500" />
        <h1 className="text-xl font-bold">Conta — Mesa {tableNumber}</h1>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Consumo</p>
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

      <p className="text-sm text-gray-500 text-center mb-6">
        O pagamento é realizado no caixa.
      </p>

      <Button
        onClick={handleClose}
        disabled={closing}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 text-base"
      >
        {closing ? <><Loader2 size={16} className="animate-spin mr-2" /> Fechando...</> : 'Fechar aba'}
      </Button>
    </div>
  )
}
