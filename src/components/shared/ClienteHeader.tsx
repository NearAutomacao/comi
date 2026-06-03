'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, BookOpen, Calendar, ClipboardList, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/store/cartStore'
import { signOut } from '@/app/actions/auth'

interface Props {
  userName: string
}

export default function ClienteHeader({ userName }: Props) {
  const pathname = usePathname()
  const itemCount = useCartStore(s => s.itemCount())

  const links = [
    { href: '/cardapio', label: 'Cardápio', icon: BookOpen },
    { href: '/reservas', label: 'Reservas', icon: Calendar },
    { href: '/pedidos', label: 'Meus pedidos', icon: ClipboardList },
  ]

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/cardapio" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-bold text-orange-600 hidden sm:block">Comi</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-sm text-gray-600">Olá, {userName.split(' ')[0]}</span>
          <Link href="/carrinho" className="relative">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-orange-500">
                  {itemCount}
                </Badge>
              )}
            </Button>
          </Link>
          <form action={signOut}>
            <Button variant="ghost" size="icon" type="submit" title="Sair">
              <LogOut size={18} />
            </Button>
          </form>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden border-t flex">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
              pathname.startsWith(href)
                ? 'text-orange-600'
                : 'text-gray-500'
            }`}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
        <Link
          href="/carrinho"
          className="flex-1 flex flex-col items-center py-2 text-xs font-medium text-gray-500 relative"
        >
          <div className="relative">
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-xs bg-orange-500">
                {itemCount}
              </Badge>
            )}
          </div>
          Carrinho
        </Link>
      </nav>
    </header>
  )
}
