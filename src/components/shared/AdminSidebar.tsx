'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, MapPin, UtensilsCrossed, ClipboardList,
  Calendar, Package, Settings, LogOut, RefreshCw, Menu,
  ChevronDown, ChevronLeft, ChevronRight, Truck,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { createClient } from '@/lib/pb/client'
import { toast } from 'sonner'
import { isElectron, electronAPI } from '@/lib/electron'
import { cn } from '@/lib/utils'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

interface Props {
  managerName: string
  restaurantName?: string
  restaurantId: string
}

const allNav = [
  { href: '/admin/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/admin/mesas',         label: 'Mapa de mesas', icon: MapPin },
  { href: '/admin/pedidos',       label: 'Pedidos',        icon: ClipboardList },
  { href: '/admin/delivery',      label: 'Delivery',       icon: Truck },
  { href: '/admin/cardapio',      label: 'Cardápio',       icon: UtensilsCrossed },
  { href: '/admin/reservas',      label: 'Reservas',       icon: Calendar },
  { href: '/admin/estoque',       label: 'Estoque/Custo',  icon: Package },
  { href: '/admin/configuracoes', label: 'Configurações',  icon: Settings },
]

const bottomItems = allNav.slice(0, 4)

export default function AdminSidebar({ managerName, restaurantName: initialRestaurantName, restaurantId }: Props) {
  const pathname = usePathname()
  const pbRef = useRef(createClient())
  const [restaurantName, setRestaurantName] = useState(initialRestaurantName ?? '')
  const [mesasBadge, setMesasBadge] = useState(0)
  const [ordersBadge, setOrdersBadge] = useState(0)
  const [deliveryBadge, setDeliveryBadge] = useState(0)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Busca nome do restaurante client-side (evita bloquear SSR do layout)
  useEffect(() => {
    if (!restaurantId || restaurantName) return
    pbRef.current.collection('restaurants').getOne(restaurantId, { fields: 'id,name' })
      .then(r => { if (r.name) setRestaurantName(r.name) })
      .catch(() => {})
  }, [restaurantId, restaurantName])

  // Ref para evitar closure desatualizado dentro dos callbacks de subscribe
  const pathnameRef = useRef(pathname)
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  // IDs de pedidos delivery já notificados (evita duplicatas entre realtime e polling)
  const seenDeliveryIdsRef = useRef<Set<string>>(new Set())

  const initials = managerName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    if (pathname === '/admin/mesas') setMesasBadge(0)
    if (pathname === '/admin/pedidos') setOrdersBadge(0)
    if (pathname === '/admin/delivery') setDeliveryBadge(0)
  }, [pathname])

  useEffect(() => {
    if (!isElectron()) return
    electronAPI()?.onUpdateDownloaded(version => setUpdateVersion(version))
  }, [])

  useEffect(() => {
    if (!restaurantId) return
    const pb = pbRef.current
    let unsubscribe: (() => void) | null = null
    pb.collection('tables').subscribe('*', event => {
      if (event.action !== 'update') return
      const updated = event.record
      if (updated.restaurant_id !== restaurantId) return
      if (updated.status === 'occupied' && pathnameRef.current !== '/admin/mesas') {
        toast(`Mesa ${updated.number} ocupada`, {
          description: updated.guest_name ? `Cliente: ${updated.guest_name}` : undefined,
          icon: '🪑',
        })
        setMesasBadge(n => n + 1)
      }
    }, { filter: `restaurant_id = "${restaurantId}"` })
      .then(unsub => { unsubscribe = unsub })
      .catch(() => {})
    return () => { unsubscribe?.() }
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return

    // Marca pedidos delivery já existentes como vistos (não notifica sobre eles)
    fetch(`/api/delivery/orders?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(data => (data.orders ?? []).forEach((o: any) => seenDeliveryIdsRef.current.add(o.id)))
      .catch(() => {})

    const pb = pbRef.current
    let unsubscribe: (() => void) | null = null

    const notifyDelivery = (order: any) => {
      if (seenDeliveryIdsRef.current.has(order.id)) return
      seenDeliveryIdsRef.current.add(order.id)
      const code = order.code != null ? `#${String(order.code).padStart(3, '0')}` : ''
      toast('🛵 Novo pedido delivery!', {
        description: [order.delivery_name, code].filter(Boolean).join(' · '),
        duration: 10000,
      })
      if (pathnameRef.current !== '/admin/delivery') setDeliveryBadge(n => n + 1)
    }

    pb.collection('orders').subscribe('*', async event => {
      if (event.action !== 'create') return
      const order = event.record as any
      if (order.restaurant_id !== restaurantId) return
      const isDelivery = Boolean(order.delivery_name)
      if (isDelivery) {
        notifyDelivery(order)
      } else {
        let tableNum: number | null = null
        let guestName: string | null = null
        if (order.table_id) {
          try { const t = await pb.collection('tables').getOne(order.table_id); tableNum = t.number } catch {}
        }
        if (order.session_id) {
          try { const s = await pb.collection('table_sessions').getOne(order.session_id); guestName = s.guest_name } catch {}
        }
        const code = order.code != null ? `#${String(order.code).padStart(3, '0')}` : ''
        toast('🍽️ Novo pedido!', {
          description: [tableNum && `Mesa ${tableNum}`, guestName, code].filter(Boolean).join(' · '),
          duration: 8000,
        })
        if (pathnameRef.current !== '/admin/pedidos') setOrdersBadge(n => n + 1)
      }
    }, { filter: `restaurant_id = "${restaurantId}"` })
      .then(unsub => { unsubscribe = unsub })
      .catch(() => {})

    // Polling a cada 20s — cobre casos onde o realtime não entrega o evento
    // seenDeliveryIdsRef garante que não notifica pedidos já conhecidos
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/delivery/orders?restaurantId=${restaurantId}`)
        if (!res.ok) return
        const data = await res.json()
        for (const order of (data.orders ?? [])) notifyDelivery(order)
      } catch {}
    }, 20_000)

    return () => { unsubscribe?.(); clearInterval(interval) }
  }, [restaurantId])

  function getBadge(href: string) {
    if (href === '/admin/mesas' && pathname !== '/admin/mesas') return mesasBadge
    if (href === '/admin/pedidos' && pathname !== '/admin/pedidos') return ordersBadge
    if (href === '/admin/delivery' && pathname !== '/admin/delivery') return deliveryBadge
    return 0
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <TooltipProvider delayDuration={0}>
      <>
        {/* ── Desktop sidebar ─────────────────────────────────── */}
        <aside
          className={cn(
            'hidden md:flex flex-col border-r border-white/10 bg-gray-900 text-white transition-all duration-300 ease-in-out h-screen sticky top-0 overflow-hidden',
            collapsed ? 'w-16' : 'w-60'
          )}
        >
          {/* Logo */}
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              className="flex items-center justify-center h-16 shrink-0 border-b border-white/10 hover:bg-white/5 transition-colors"
              aria-label="Expandir menu"
            >
              <Image src="/icon-32.png" alt="comi" width={32} height={32} className="rounded-xl" />
            </button>
          ) : (
            <div className="px-4 pt-5 pb-4 shrink-0 border-b border-white/10">
              <div className="flex items-center justify-between">
                <Link href="/admin/dashboard" className="flex items-center gap-3 group min-w-0">
                  <div className="relative shrink-0" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>
                    <Image src="/icon-32.png" alt="comi" width={40} height={40} className="rounded-xl" />
                  </div>
                  <div className="min-w-0">
                    <span
                      className="block font-bold text-white truncate max-w-[120px] group-hover:opacity-90 transition-opacity"
                      style={{ fontSize: '17px', letterSpacing: '-0.3px', lineHeight: 1.2 }}
                    >
                      {restaurantName ?? 'Comi'}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.06em] text-white/40">
                      Gestão de Restaurante
                    </span>
                  </div>
                </Link>
                <button
                  onClick={() => setCollapsed(true)}
                  className="shrink-0 ml-2 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                  aria-label="Recolher menu"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4" style={{ height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, transparent 100%)' }} />
            </div>
          )}

          {/* Nav */}
          <nav className={cn('flex-1 py-3 space-y-0.5 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
            {allNav.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              const badge = getBadge(href)

              const linkEl = (
                <Link
                  href={href}
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150',
                    collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
                    active ? 'text-white' : 'hover:text-white'
                  )}
                  style={
                    active
                      ? { background: 'rgba(255,255,255,0.12)', color: 'white' }
                      : { color: 'rgba(255,255,255,0.52)' }
                  }
                >
                  {active && !collapsed && (
                    <span
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 rounded-l-full bg-white"
                      style={{ height: '16px' }}
                    />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  {!collapsed && badge > 0 && (
                    <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                      {badge}
                    </span>
                  )}
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={href}>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        {linkEl}
                        {badge > 0 && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
                  </Tooltip>
                )
              }
              return <div key={href}>{linkEl}</div>
            })}
          </nav>

          {/* Update banner */}
          {updateVersion && (
            <button
              onClick={() => electronAPI()?.quitAndInstall()}
              className="mx-3 mb-2 flex items-center gap-2 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-2 transition-colors shrink-0"
            >
              <RefreshCw size={13} />
              {!collapsed && <span>v{updateVersion} — Reiniciar</span>}
            </button>
          )}

          {/* Footer */}
          <div className={cn('shrink-0 border-t border-white/10', collapsed ? 'p-2' : 'p-3')}>
            {collapsed ? (
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setCollapsed(false)}
                      className="w-full flex items-center justify-center py-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Expandir menu</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => signOut()}
                      className="w-full flex items-center justify-center py-2 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sair</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full transition-all text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sair</span>
              </button>
            )}
          </div>
        </aside>

        {/* ── Mobile header (topo fixo) ────────────────────────── */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-gray-900 border-b border-white/10 flex items-center px-4">
          <div className="w-1/4 flex items-center">
            <Link href="/admin/dashboard">
              <Image src="/icon-32.png" alt="comi" width={28} height={28} className="rounded-lg" />
            </Link>
          </div>
          <div className="flex-1 flex justify-center">
            <span className="font-bold text-white text-[15px] tracking-tight truncate max-w-[160px]">
              {restaurantName ?? 'Comi'}
            </span>
          </div>
          <div className="w-1/4 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 outline-none">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-orange-500 text-white text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3 w-3 text-white/50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{managerName}</p>
                  <p className="text-xs text-muted-foreground">Gerente</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/configuracoes" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-500 focus:text-red-500 focus:bg-red-50"
                  onClick={() => signOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ── Mobile bottom nav ────────────────────────────────── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-gray-900 border-t border-white/10 flex items-stretch"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {bottomItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            const badge = getBadge(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors relative',
                  active ? 'text-white' : 'text-white/45 hover:text-white/70'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]')} />
                {label}
                {badge > 0 && (
                  <span className="absolute top-2 right-[calc(50%-18px)] w-2 h-2 bg-red-500 rounded-full" />
                )}
              </Link>
            )
          })}

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-white/45 hover:text-white/70 transition-colors">
                <Menu className="h-5 w-5" />
                Menu
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-gray-900 border-white/10">
              <SheetHeader className="px-4 pt-5 pb-4 border-b border-white/10">
                <SheetTitle asChild>
                  <div className="flex items-center gap-3">
                    <Image src="/icon-32.png" alt="comi" width={36} height={36} className="rounded-xl flex-shrink-0" />
                    <div>
                      <p className="font-bold text-white text-base leading-tight truncate max-w-[180px]">
                        {restaurantName ?? 'Comi'}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.06em] text-white/40">Gestão de Restaurante</p>
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto py-3" style={{ height: 'calc(100vh - 80px)' }}>
                <ul className="space-y-0.5 px-3">
                  {allNav.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href)
                    const badge = getBadge(href)
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => setSheetOpen(false)}
                          className={cn(
                            'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                            active ? 'text-white' : 'hover:text-white'
                          )}
                          style={
                            active
                              ? { background: 'rgba(255,255,255,0.12)', color: 'white' }
                              : { color: 'rgba(255,255,255,0.52)' }
                          }
                        >
                          {active && (
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-l-full bg-white" />
                          )}
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{label}</span>
                          {badge > 0 && (
                            <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                              {badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-4 mx-3 pt-4 border-t border-white/10">
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all w-full"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Sair
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </>
    </TooltipProvider>
  )
}
