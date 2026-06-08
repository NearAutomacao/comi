'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ShoppingCart, BookOpen, Calendar, ClipboardList, LogOut, MapPin, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/store/cartStore'
import { signOut } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  userName: string
}

export default function ClienteHeader({ userName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const itemCount = useCartStore(s => s.itemCount())
  const tableNumber = useCartStore(s => s.tableNumber)
  const tableId = useCartStore(s => s.tableId)
  const sessionId = useCartStore(s => s.sessionId)
  const clearSession = useCartStore(s => s.clearSession)
  const setTable = useCartStore(s => s.setTable)
  const guestName = useCartStore(s => s.guestName)
  const displayName = userName || guestName || ''
  const supabase = useRef(createClient()).current

  // Escuta status da mesa (ex: liberada pelo garçom)
  useEffect(() => {
    if (!tableId) return

    const channel = supabase
      .channel(`table-status-${tableId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'comi', table: 'tables', filter: `id=eq.${tableId}` },
        payload => {
          const updated = payload.new as { status: string }
          if (updated.status === 'empty') {
            // Aguarda 800ms antes de expulsar: se foi uma troca de mesa, o evento
            // session-transfer chega nesse intervalo e atualiza tableId no store.
            // Se tableId no store mudou = transferência → não expulsa.
            // Se tableId no store ainda é o mesmo = mesa genuinamente liberada → expulsa.
            setTimeout(() => {
              const currentTableId = useCartStore.getState().tableId
              if (!currentTableId || currentTableId !== tableId) return
              clearSession()
              if (pathname !== '/conta') {
                toast.info('Sua mesa foi liberada pelo restaurante.')
                router.push('/cardapio')
              }
            }, 800)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tableId])

  // Escuta transferência de mesa: atualiza tableId/tableNumber no store
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`session-transfer-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'comi', table: 'table_sessions', filter: `id=eq.${sessionId}` },
        async payload => {
          const updated = payload.new as { table_id: string }
          if (updated.table_id && updated.table_id !== tableId) {
            const { data: newTable } = await supabase
              .from('tables')
              .select('number')
              .eq('id', updated.table_id)
              .single()
            if (newTable) {
              setTable(updated.table_id, newTable.number)
              toast.success(`Você foi transferido para a Mesa ${newTable.number}.`)
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

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
          {/* Indicador de mesa + Fechar conta */}
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
              {itemCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-orange-500">
                  {itemCount}
                </Badge>
              )}
            </Button>
          </Link>

          {isGuest ? (
            <Button
              variant="ghost"
              size="icon"
              title="Sair da mesa"
              onClick={() => {
                clearSession()
                document.cookie = 'comi_restaurant_id=; Max-Age=0; path=/'
                window.location.href = '/'
              }}
            >
              <LogOut size={18} />
            </Button>
          ) : (
            <form action={signOut}>
              <Button variant="ghost" size="icon" type="submit" title="Sair">
                <LogOut size={18} />
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Mobile nav */}
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
      </nav>

      {/* Banner de mesa no mobile */}
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
