'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MapPin, UtensilsCrossed, ClipboardList,
  Calendar, Package, Settings, LogOut, ChevronRight
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

const nav = [
  { href: '/admin/dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/admin/mesas',         label: 'Mapa de mesas', icon: MapPin },
  { href: '/admin/pedidos',       label: 'Pedidos',       icon: ClipboardList },
  { href: '/admin/cardapio',      label: 'Cardápio',      icon: UtensilsCrossed },
  { href: '/admin/reservas',      label: 'Reservas',      icon: Calendar },
  { href: '/admin/estoque',       label: 'Estoque/Custo', icon: Package },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
]

export default function AdminSidebar({ managerName, restaurantName }: { managerName: string; restaurantName?: string }) {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-gray-900 text-white min-h-screen">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
              <span className="text-sm font-bold">{(restaurantName ?? 'C')[0].toUpperCase()}</span>
            </div>
            <div>
              <p className="font-bold text-sm truncate max-w-[120px]">{restaurantName ?? 'Comi'}</p>
              <p className="text-xs text-gray-400">{managerName.split(' ')[0]}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
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
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center">
            <span className="text-xs font-bold">C</span>
          </div>
          <span className="font-bold text-sm">Admin</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {nav.slice(0, 4).map(({ href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`p-2 rounded-lg ${pathname === href ? 'bg-orange-500' : 'text-gray-400'}`}
            >
              <Icon size={18} />
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
