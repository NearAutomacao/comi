export type UserRole = 'customer' | 'manager'

export interface Profile {
  id: string
  name: string
  phone: string | null
  cpf: string | null
  role: UserRole
  created_at: string
}

export type MenuCategorySlug = 'porcoes' | 'lanches' | 'bebidas' | 'sobremesas' | 'outros'

export interface MenuCategory {
  id: string
  name: string
  slug: string
  display_order: number
  created_at: string
}

export interface CostItem {
  id: string
  menu_item_id: string
  ingredient: string
  quantity: string
  unit_cost: number
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  photo_url: string | null
  available: boolean
  display_order: number
  created_at: string
  category?: MenuCategory
  cost_items?: CostItem[]
}

export type TableStatus = 'empty' | 'reserved' | 'occupied'

export interface Table {
  id: string
  number: number
  capacity: number
  pos_x: number
  pos_y: number
  status: TableStatus
  created_at: string
  current_order?: Order | null
}

export interface WorkingHours {
  id: string
  day_of_week: number // 0=Sunday, 6=Saturday
  open_time: string | null
  close_time: string | null
  is_open: boolean
}

export interface ClosedDate {
  id: string
  date: string
  reason: string | null
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'

export interface Reservation {
  id: string
  table_id: string
  customer_id: string
  date: string
  time: string
  guest_count: number
  status: ReservationStatus
  payment_status: PaymentStatus
  payment_id: string | null
  notes: string | null
  created_at: string
  table?: Table
  customer?: Profile
}

export type OrderStatus = 'open' | 'preparing' | 'served' | 'closed' | 'cancelled'
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served'

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  unit_price: number
  notes: string | null
  status: OrderItemStatus
  menu_item?: MenuItem
}

export interface Order {
  id: string
  table_id: string
  customer_id: string | null
  status: OrderStatus
  total: number
  payment_status: PaymentStatus
  created_at: string
  table?: Table
  customer?: Profile
  order_items?: OrderItem[]
}

export type PaymentMethod = 'credit_card' | 'debit_card' | 'pix'

export interface Payment {
  id: string
  order_id: string | null
  reservation_id: string | null
  method: PaymentMethod
  amount: number
  status: PaymentStatus
  mercadopago_id: string | null
  installments: number
  created_at: string
}

export interface PaymentPerson {
  name: string
  amount: number
  method: PaymentMethod
}

export interface RestaurantSettings {
  id: string
  mercadopago_access_token: string | null
  mercadopago_public_key: string | null
  restaurant_name: string
  address: string | null
}

export interface TableColor {
  bg: string
  border: string
  text: string
  label: string
}

export function getTableColor(table: Table): TableColor {
  if (table.status === 'empty') {
    return { bg: 'bg-gray-200', border: 'border-gray-400', text: 'text-gray-700', label: 'Livre' }
  }
  if (table.status === 'reserved') {
    return { bg: 'bg-blue-200', border: 'border-blue-500', text: 'text-blue-800', label: 'Reservada' }
  }
  const total = table.current_order?.total ?? 0
  if (total === 0) {
    return { bg: 'bg-gray-200', border: 'border-gray-400', text: 'text-gray-700', label: 'Ocupada' }
  }
  if (total <= 100) {
    return { bg: 'bg-yellow-200', border: 'border-yellow-500', text: 'text-yellow-800', label: `R$ ${total.toFixed(2)}` }
  }
  if (total <= 500) {
    return { bg: 'bg-orange-200', border: 'border-orange-500', text: 'text-orange-800', label: `R$ ${total.toFixed(2)}` }
  }
  return { bg: 'bg-green-200', border: 'border-green-500', text: 'text-green-800', label: `R$ ${total.toFixed(2)}` }
}

export interface CartItem {
  menu_item: MenuItem
  quantity: number
  notes: string
}
