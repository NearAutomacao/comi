'use client'

import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

export default function CarrinhoPage() {
  const { items, updateQuantity, removeItem, clearCart, total, tableId, tableNumber } = useCartStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleFinalizar() {
    if (!tableId) {
      toast.error('Selecione uma mesa antes de finalizar o pedido')
      router.push('/cardapio')
      return
    }
    if (items.length === 0) return

    setLoading(true)

    // Usa API route com admin client — funciona para convidados sem sessão Supabase
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId,
        items: items.map(i => ({
          menuItemId: i.menu_item.id,
          quantity: i.quantity,
          unitPrice: i.menu_item.price,
          notes: i.notes || undefined,
        })),
      }),
    })

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
      toast.error('Erro ao criar pedido: ' + error)
      setLoading(false)
      return
    }

    clearCart()
    toast.success('Pedido enviado! Acompanhe em Minha Mesa.')
    router.push('/minha-mesa')
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <ShoppingBag size={64} className="mx-auto text-gray-200 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600">Carrinho vazio</h2>
        <p className="text-gray-400 mt-2">Adicione itens do cardápio</p>
        <Link href="/cardapio">
          <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white">
            Ver cardápio
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 pb-20 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cardapio">
          <Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button>
        </Link>
        <h1 className="text-xl font-bold">Carrinho</h1>
      </div>

      {tableId && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm text-orange-700">
          Mesa selecionada — o pedido será enviado ao restaurante
        </div>
      )}

      <div className="space-y-3">
        {items.map(({ menu_item, quantity, notes }) => (
          <div key={menu_item.id} className="bg-white rounded-xl shadow-sm border p-4 flex gap-3">
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{menu_item.name}</p>
              {notes && <p className="text-xs text-gray-400 mt-0.5">{notes}</p>}
              <p className="text-orange-600 font-bold mt-1">
                {formatCurrency(menu_item.price * quantity)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button onClick={() => removeItem(menu_item.id)} className="text-gray-300 hover:text-red-500">
                <Trash2 size={16} />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(menu_item.id, quantity - 1)}
                  className="w-7 h-7 rounded-full border border-orange-300 text-orange-600 flex items-center justify-center hover:bg-orange-50"
                >
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center font-semibold">{quantity}</span>
                <button
                  onClick={() => updateQuantity(menu_item.id, quantity + 1)}
                  className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="max-w-xl mx-auto flex items-center justify-between mb-3">
          <span className="text-gray-600 font-medium">Total</span>
          <span className="text-2xl font-bold text-orange-600">{formatCurrency(total())}</span>
        </div>
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href="/cardapio" className="flex-1">
            <Button variant="outline" className="w-full border-orange-300 text-orange-600">
              Continuar comprando
            </Button>
          </Link>
          <Button
            onClick={handleFinalizar}
            disabled={loading}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            {loading ? 'Enviando...' : 'Finalizar pedido'}
          </Button>
        </div>
      </div>
    </div>
  )
}
