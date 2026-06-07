import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, MenuItem } from '@/types'

interface CartStore {
  items: CartItem[]
  tableId: string | null
  tableNumber: number | null
  restaurantId: string | null
  sessionId: string | null
  guestName: string | null
  guestPhone: string | null
  addItem: (item: MenuItem, notes?: string) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  clearCart: () => void
  clearSession: () => void
  setTable: (tableId: string, tableNumber: number) => void
  setGuest: (name: string, phone: string, restaurantId: string, sessionId: string) => void
  total: () => number
  itemCount: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      tableId: null,
      tableNumber: null,
      restaurantId: null,
      sessionId: null,
      guestName: null,
      guestPhone: null,

      addItem: (menuItem, notes = '') => {
        set(state => {
          const existing = state.items.find(i => i.menu_item.id === menuItem.id)
          if (existing) {
            return {
              items: state.items.map(i =>
                i.menu_item.id === menuItem.id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            }
          }
          return { items: [...state.items, { menu_item: menuItem, quantity: 1, notes }] }
        })
      },

      removeItem: (menuItemId) => {
        set(state => ({ items: state.items.filter(i => i.menu_item.id !== menuItemId) }))
      },

      updateQuantity: (menuItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId)
          return
        }
        set(state => ({
          items: state.items.map(i =>
            i.menu_item.id === menuItemId ? { ...i, quantity } : i
          ),
        }))
      },

      clearCart: () => set({ items: [] }),
      clearSession: () => set({
        items: [],
        tableId: null,
        tableNumber: null,
        restaurantId: null,
        sessionId: null,
        guestName: null,
        guestPhone: null,
      }),
      setTable: (tableId, tableNumber) => set({ tableId, tableNumber }),
      setGuest: (guestName, guestPhone, restaurantId, sessionId) =>
        set({ guestName, guestPhone, restaurantId, sessionId }),

      total: () => get().items.reduce((sum, i) => sum + i.menu_item.price * i.quantity, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'comi-cart' }
  )
)
