'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ShoppingCart, BookOpen, Calendar, ClipboardList, LogOut, MapPin, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/store/cartStore'
import { signOut } from '@/app/actions/auth'
import { createClient } from '@/lib/pb/client'
import { toast } from 'sonner'

interface Props {
  userName: string
}

export default function ClienteHeader({ userName }: Props) {
  const pathname = usePathname()
  const itemCount = useCartStore(s => s.itemCount())
  const tableNumber = useCartStore(s => s.tableNumber)
  const tableId = useCartStore(s => s.tableId)
  const sessionId = useCartStore(s => s.sessionId)
  const clearSession = useCartStore(s => s.clearSession)
  const setTable = useCartStore(s => s.setTable)
  const guestName = useCartStore(s => s.guestName)
  const displayName = userName || guestName || ''
  const pbRef = useRef(createClient())

  // Polling: monitora status da mesa e transferências (substitui realtime SSE)
  useEffect(() => {
    if (!tableId && !sessionId) return
    const pb = pbRef.current
    let prevTableStatus = ''
    let prevSessionTableId = ''

    async function poll() {
      try {
        if (tableId) {
          const table = await pb.collection('tables').getOne(tableId, { fields: 'id,status' })
          if (prevTableStatus && prevTableStatus !== 'empty' && table.status === 'empty') {
            setTimeout(() => {
              const cur = useCartStore.getState().tableId
              if (!cur || cur !== tableId) return
              clearSession()
              toast.info('Sua mesa foi liberada pelo restaurante.')
              window.location.href = '/'
            }, 800)
          }
          prevTableStatus = table.status
        }

        if (sessionId) {
          const session = await pb.collection('table_sessions').getOne(sessionId, { fields: 'id,table_id' })
          if (prevSessionTableId && session.table_id && session.table_id !== prevSessionTableId) {
            try {
              const newTable = await pb.collection('tables').getOne(session.table_id, { fields: 'id,number' })
              setTable(session.table_id, newTable.number)
              toast.success(`Você foi transferido para a Mesa ${newTable.number}.`)
            } catch {}
          }
          if (!prevSessionTableId) prevSessionTableId = session.table_id
          else prevSessionTableId = session.table_id
        }
      } catch {}
    }

    poll()
    const interval = setInterval(poll, 6_000)
    return () => clearInterval(interval)
  }, [tableId, sessionId])

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isGuest = !userName && !!guestName

  const links = isGuest
    ? [
        { href: '/cardapio',    label: 'Cardápio',   icon: BookOpen },
        ...(tableId ? [{ href: '/minha-mesa', label: 'Minha mesa', icon: ClipboardList }] : []),
      ]
    : [
        { href: '/cardapio', label: 'Cardápio',      icon: BookOpen },
        { href: '/reservas', label: 'Reservas',       icon: Calendar },
        { href: '/pedidos',  label: 'Meus pedidos',   icon: ClipboardList },
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
                pathname.startsWith(href) ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {tableNumber && (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
                <MapPin size={13} className="text-orange-500" />
                <span className="text-xs font-semibold text-orange-600">Mesa {tableNumber}</span>
              </div>
              <Link href="/conta">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-green-300 text-green-700 hover:bg-green-50 gap-1">
                  <Receipt size={12} />
                  Fechar conta
                </Button>
              </Link>
            </div>
          )}

          {displayName && (
            <span className="hidden sm:block text-sm text-gray-600">Olá, {displayName.split(' ')[0]}</span>
          )}

          <Link href="/carrinho" className="relative">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart size={20} />
              {mounted && itemCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-orange-500">
                  {itemCount}
                </Badge>
              )}
            </Button>
          </Link>

          {isGuest ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-red-500 gap-1.5"
              onClick={() => {
                clearSession()
                document.cookie = 'comi_restaurant_id=; Max-Age=0; path=/'
                window.location.href = '/'
              }}
            >
              <LogOut size={15} />
              <span className="text-xs">Sair</span>
            </Button>
          ) : (
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit" className="text-gray-500 hover:text-red-500 gap-1.5">
                <LogOut size={15} />
                <span className="text-xs">Sair</span>
              </Button>
            </form>
          )}
        </div>
      </div>

      <nav className="md:hidden border-t flex">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
              pathname.startsWith(href) ? 'text-orange-600' : 'text-gray-500'
            }`}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
        <Link href="/carrinho" className="flex-1 flex flex-col items-center py-2 text-xs font-medium text-gray-500 relative">
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
        {isGuest ? (
          <button
            onClick={() => { clearSession(); document.cookie = 'comi_restaurant_id=; Max-Age=0; path=/'; window.location.href = '/' }}
            className="flex-1 flex flex-col items-center py-2 text-xs font-medium text-gray-500"
          >
            <LogOut size={20} />
            Sair
          </button>
        ) : (
          <form action={signOut} className="flex-1">
            <button type="submit" className="w-full flex flex-col items-center py-2 text-xs font-medium text-gray-500">
              <LogOut size={20} />
              Sair
            </button>
          </form>
        )}
      </nav>

      {tableNumber && (
        <div className="md:hidden bg-orange-50 border-b border-orange-100 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-orange-500" />
            <span className="text-xs font-medium text-orange-600">Você está na Mesa {tableNumber}</span>
          </div>
          <Link href="/conta" className="flex items-center gap-1 text-xs font-semibold text-green-700">
            <Receipt size={12} />
            Fechar conta
          </Link>
        </div>
      )}
    </header>
  )
}
