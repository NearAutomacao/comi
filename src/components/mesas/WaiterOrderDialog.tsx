'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Plus, Minus, Search, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { MenuItem } from '@/types'

interface CartEntry { item: MenuItem; qty: number }

interface Props {
  tableId: string
  restaurantId: string
  existingOrderId: string | null
  onClose: () => void
  onSent: (orderId: string, total: number) => void
}

export default function WaiterOrderDialog({ tableId, restaurantId, existingOrderId, onClose, onSent }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('menu_items')
      .select('*, category:menu_categories(name)')
      .eq('restaurant_id', restaurantId)
      .eq('available', true)
      .order('display_order')
      .then(({ data }) => setMenuItems(data ?? []))
  }, [restaurantId])

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(e => e.item.id === item.id)
      if (existing) return prev.map(e => e.item.id === item.id ? { ...e, qty: e.qty + 1 } : e)
      return [...prev, { item, qty: 1 }]
    })
  }

  function updateQty(itemId: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(e => e.item.id !== itemId))
    else setCart(prev => prev.map(e => e.item.id === itemId ? { ...e, qty } : e))
  }

  const total = cart.reduce((s, e) => s + e.item.price * e.qty, 0)

  const filtered = menuItems.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSend() {
    if (cart.length === 0) return
    setLoading(true)

    // Quando há pedido existente (adicionando itens), insere direto nos order_items
    if (existingOrderId) {
      const { error: itemsError } = await supabase.from('order_items').insert(
        cart.map(e => ({
          restaurant_id: restaurantId,
          order_id: existingOrderId,
          menu_item_id: e.item.id,
          quantity: e.qty,
          unit_price: e.item.price,
        }))
      )
      if (itemsError) {
        toast.error('Erro ao adicionar itens')
        setLoading(false)
        return
      }
      toast.success('Itens adicionados!')
      onSent(existingOrderId, total)
      onClose()
      return
    }

    // Novo pedido: usa a API para garantir order_code sequencial e print_jobs
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId,
        items: cart.map(e => ({
          menuItemId: e.item.id,
          quantity: e.qty,
          unitPrice: e.item.price,
        })),
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
      toast.error('Erro ao criar pedido: ' + data.error)
      setLoading(false)
      return
    }

    const { orderId } = await res.json()
    toast.success('Pedido lançado!')
    onSent(orderId, total)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Lançar pedido</DialogTitle>
        </DialogHeader>

        {/* Busca */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar item..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Lista de itens */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filtered.map(item => {
            const entry = cart.find(e => e.item.id === item.id)
            return (
              <div key={item.id} className="flex items-center justify-between py-2 px-1 border-b last:border-0">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-orange-600 font-semibold">{formatCurrency(item.price)}</p>
                </div>
                {entry ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateQty(item.id, entry.qty - 1)}
                      className="w-7 h-7 rounded-full border border-orange-300 text-orange-600 flex items-center justify-center"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-4 text-center text-sm font-bold">{entry.qty}</span>
                    <button
                      onClick={() => updateQty(item.id, entry.qty + 1)}
                      className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(item)}
                    className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center flex-shrink-0"
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Rodapé */}
        {cart.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm font-bold">
              <span>{cart.reduce((s, e) => s + e.qty, 0)} itens</span>
              <span className="text-orange-600">{formatCurrency(total)}</span>
            </div>
            <Button
              onClick={handleSend}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Send size={16} className="mr-2" />
              {loading ? 'Enviando...' : 'Enviar pedido'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
