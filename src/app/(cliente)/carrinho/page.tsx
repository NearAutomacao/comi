'use client'

import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { toast } from 'sonner'

export default function CarrinhoPage() {
  const { items, updateQuantity, removeItem, clearCart, total, tableId } = useCartStore()
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
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Busca o restaurant_id da mesa
    const { data: table } = await supabase
      .from('tables')
      .select('restaurant_id')
      .eq('id', tableId)
      .single()

    const restaurantId = table?.restaurant_id
    if (!restaurantId) {
      toast.error('Mesa inválida')
      setLoading(false)
      return
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ restaurant_id: restaurantId, table_id: tableId, customer_id: user?.id ?? null, status: 'open' })
      .select()
      .single()

    if (orderError || !order) {
      toast.error('Erro ao criar pedido: ' + orderError?.message)
      setLoading(false)
      return
    }

    const orderItems = items.map(i => ({
      restaurant_id: restaurantId,
      order_id: order.id,
      menu_item_id: i.menu_item.id,
      quantity: i.quantity,
      unit_price: i.menu_item.price,
      notes: i.notes || null,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

    if (itemsError) {
      toast.error('Erro ao registrar itens')
      setLoading(false)
      return
    }

    // Notify via Supabase Realtime (trigger on tables update)
    await supabase
      .from('tables')
      .update({ status: 'occupied' })
      .eq('id', tableId)

    clearCart()
    toast.success('Pedido enviado! O restaurante foi notificado.')
    router.push('/pedidos')
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
