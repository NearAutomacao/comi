'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, MapPin, UtensilsCrossed, ClipboardList,
  Calendar, Package, Settings, LogOut,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  managerName: string
  restaurantName?: string
  restaurantId: string
}

const baseNav = [
  { href: '/admin/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/admin/mesas',         label: 'Mapa de mesas', icon: MapPin },
  { href: '/admin/pedidos',       label: 'Pedidos',        icon: ClipboardList },
  { href: '/admin/cardapio',      label: 'Cardápio',       icon: UtensilsCrossed },
  { href: '/admin/reservas',      label: 'Reservas',       icon: Calendar },
  { href: '/admin/estoque',       label: 'Estoque/Custo',  icon: Package },
  { href: '/admin/configuracoes', label: 'Configurações',  icon: Settings },
]

export default function AdminSidebar({ managerName, restaurantName, restaurantId }: Props) {
  const pathname = usePathname()
  const supabase = useRef(createClient()).current
  const [mesasBadge, setMesasBadge] = useState(0)

  // Limpa badge ao entrar em /admin/mesas
  useEffect(() => {
    if (pathname === '/admin/mesas') setMesasBadge(0)
  }, [pathname])

  // Realtime: notifica quando cliente senta (status → occupied)
  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`sidebar-tables-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'comi',
          table: 'tables',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        payload => {
          const updated = payload.new as { status: string; number: number; guest_name?: string }
          if (updated.status === 'occupied') {
            toast(`Mesa ${updated.number} ocupada`, {
              description: updated.guest_name ? `Cliente: ${updated.guest_name}` : undefined,
              icon: '🪑',
            })
            // Só mostra badge se o gerente não estiver já na tela de mesas
            if (pathname !== '/admin/mesas') {
              setMesasBadge(n => n + 1)
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [restaurantId])

  const nav = baseNav.map(item => ({
    ...item,
    badge: item.href === '/admin/mesas' && pathname !== '/admin/mesas' ? mesasBadge : 0,
  }))

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-gray-900 text-white min-h-screen">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Image src="/icon-32.png" alt="comi" width={32} height={32} className="rounded-lg" />
            <div>
              <p className="font-bold text-sm truncate max-w-[120px]">{restaurantName ?? 'Comi'}</p>
              <p className="text-xs text-gray-400">{managerName.split(' ')[0]}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={17} />
                <span className="flex-1">{label}</span>
                {badge > 0 && (
                  <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-700">
          <form action={signOut}>
            <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white w-full px-3 py-2">
              <LogOut size={16} /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white flex items-center justify-between px-4 py-3">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <Image src="/icon-32.png" alt="comi" width={28} height={28} className="rounded-lg" />
          <span className="font-bold text-sm">Admin</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {nav.slice(0, 4).map(({ href, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={`relative p-2 rounded-lg ${pathname === href ? 'bg-orange-500' : 'text-gray-400'}`}
            >
              <Icon size={18} />
              {badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
