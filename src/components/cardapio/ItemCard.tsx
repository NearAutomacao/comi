'use client'

import Image from 'next/image'
import { Plus, Minus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import type { MenuItem } from '@/types'
import { toast } from 'sonner'

interface Props {
  item: MenuItem
}

export default function ItemCard({ item }: Props) {
  const { items, addItem, removeItem, updateQuantity } = useCartStore()
  const cartItem = items.find(i => i.menu_item.id === item.id)
  const qty = cartItem?.quantity ?? 0

  function handleAdd() {
    addItem(item)
    toast.success(`${item.name} adicionado`)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {item.photo_url ? (
        <div className="relative h-40 w-full bg-gray-100">
          <Image
            src={item.photo_url}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
          />
        </div>
      ) : (
        <div className="h-32 bg-orange-50 flex items-center justify-center">
          <ShoppingCart size={32} className="text-orange-200" />
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-800">{item.name}</h3>
        {item.description && (
          <p className="text-sm text-gray-500 mt-1 flex-1">{item.description}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-bold text-orange-600">
            {formatCurrency(item.price)}
          </span>

          {qty === 0 ? (
            <Button
              onClick={handleAdd}
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4"
            >
              <Plus size={16} className="mr-1" /> Adicionar
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => updateQuantity(item.id, qty - 1)}
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full border-orange-300 text-orange-600"
              >
                <Minus size={14} />
              </Button>
              <Badge className="bg-orange-500 text-white px-3 py-1 text-sm">{qty}</Badge>
              <Button
                onClick={() => addItem(item)}
                size="icon"
                className="h-8 w-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus size={14} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
