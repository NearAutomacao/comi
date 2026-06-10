'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Plus, Minus, X, Loader2, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  photo_url: string | null
}

interface CartItem {
  item: MenuItem
  quantity: number
}

interface Group {
  category: { id: string; name: string }
  items: MenuItem[]
}

interface Props {
  slug: string
  restaurantName: string
  guestName: string
  guestPhone: string
  grouped: Group[]
}

type Step = 'menu' | 'checkout'

export default function DeliveryMenu({ slug, restaurantName, guestName, grouped }: Props) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [step, setStep] = useState<Step>('menu')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})

  const total = cart.reduce((s, i) => s + i.item.price * i.quantity, 0)
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0)

  function addItem(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === item.id)
      if (ex) return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { item, quantity: 1 }]
    })
  }

  function removeItem(itemId: string) {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === itemId)
      if (!ex) return prev
      if (ex.quantity === 1) return prev.filter(c => c.item.id !== itemId)
      return prev.map(c => c.item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  function getQty(itemId: string) {
    return cart.find(c => c.item.id === itemId)?.quantity ?? 0
  }

  function scrollToCategory(catId: string) {
    categoryRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function placeOrder() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/delivery/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(c => ({
            menuItemId: c.item.id,
            quantity: c.quantity,
            unitPrice: c.item.price,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao enviar pedido')
        setLoading(false)
        return
      }
      router.push(`/delivery/${slug}/acompanhar`)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ── TELA DE CHECKOUT ───────────────────────────────────────
  if (step === 'checkout') {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 bg-white border-b px-4 h-14 flex items-center gap-3">
          <button onClick={() => setStep('menu')} className="text-gray-500 hover:text-gray-800">
            <X size={20} />
          </button>
          <h1 className="font-bold text-base flex-1">Confirmar pedido</h1>
        </header>

        <div className="max-w-lg mx-auto px-4 py-6 pb-32">
          <div className="bg-white rounded-2xl border shadow-sm p-4 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Seus dados</p>
            <p className="text-sm font-medium">{guestName}</p>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Itens do pedido</p>
            <ul className="space-y-3">
              {cart.map(c => (
                <li key={c.item.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button onClick={() => removeItem(c.item.id)} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-900">
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-bold w-5 text-center">{c.quantity}</span>
                    <button onClick={() => addItem(c.item)} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-900">
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="flex-1 text-sm">{c.item.name}</span>
                  <span className="text-sm font-medium">{formatCurrency(c.item.price * c.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t mt-4 pt-4 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-orange-600 text-lg">{formatCurrency(total)}</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <Button
            onClick={placeOrder}
            disabled={loading || cart.length === 0}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 font-semibold text-base max-w-lg mx-auto flex"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin mr-2" />Enviando...</>
              : `Confirmar pedido · ${formatCurrency(total)}`
            }
          </Button>
        </div>
      </main>
    )
  }

  // ── TELA DO CARDÁPIO ───────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <ShoppingBag size={20} className="text-orange-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{restaurantName}</p>
            <p className="text-xs text-gray-400">Delivery · {guestName.split(' ')[0]}</p>
          </div>
          {itemCount > 0 && (
            <button
              onClick={() => setStep('checkout')}
              className="flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold px-3 py-1.5 rounded-full hover:bg-orange-600 transition-colors"
            >
              <ShoppingBag size={14} />
              {itemCount}
            </button>
          )}
        </div>

        {/* Category tabs */}
        {grouped.length > 1 && (
          <div className="flex gap-1 px-4 pb-3 overflow-x-auto scrollbar-none">
            {grouped.map(({ category }) => (
              <button
                key={category.id}
                onClick={() => scrollToCategory(category.id)}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 hover:bg-orange-100 hover:text-orange-600 transition-colors whitespace-nowrap"
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Menu */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-32 space-y-8">
        {grouped.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <ShoppingBag size={48} className="mx-auto mb-3 text-gray-200" />
            <p>Cardápio em breve</p>
          </div>
        )}

        {grouped.map(({ category, items }) => (
          <section
            key={category.id}
            ref={el => { categoryRefs.current[category.id] = el }}
          >
            <h2 className="text-base font-bold text-gray-800 mb-3 pb-2 border-b">{category.name}</h2>
            <div className="space-y-3">
              {items.map((item: MenuItem) => {
                const qty = getQty(item.id)
                return (
                  <div key={item.id} className="bg-white rounded-xl border shadow-sm p-4 flex gap-4 items-start">
                    {item.photo_url && (
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className="w-20 h-20 rounded-lg object-cover shrink-0 bg-gray-100"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-orange-600 font-bold text-sm mt-2">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="shrink-0 flex items-center">
                      {qty === 0 ? (
                        <button
                          onClick={() => addItem(item)}
                          className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors shadow-sm"
                        >
                          <Plus size={16} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-1">
                          <button onClick={() => removeItem(item.id)} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-900">
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-bold w-4 text-center">{qty}</span>
                          <button onClick={() => addItem(item)} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-900">
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Bottom bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={() => setStep('checkout')}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 font-semibold text-base"
            >
              <ShoppingBag size={18} className="mr-2" />
              Ver pedido · {itemCount} {itemCount === 1 ? 'item' : 'itens'} · {formatCurrency(total)}
              <ChevronRight size={16} className="ml-auto" />
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
