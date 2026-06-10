'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/pb/client'
import { getTableColor } from '@/types'
import type { Table } from '@/types'
import TablePopup from './TablePopup'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  restaurantId: string
  initialTables: Table[]
  localIP?: string
}

export default function TableMapAdmin({ restaurantId, initialTables, localIP }: Props) {
  const [tables, setTables] = useState<Table[]>(initialTables)
  const [loading, setLoading] = useState(initialTables.length === 0)
  const [selected, setSelected] = useState<Table | null>(null)
  const [qrTable, setQrTable] = useState<Table | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const mapRef = useRef<HTMLDivElement>(null)
  const dragMovedRef = useRef(false)
  const pbRef = useRef(createClient())

  useEffect(() => {
    if (initialTables.length > 0) return
    fetch('/api/mesas')
      .then(r => r.json())
      .then(data => { if (data.tables) setTables(data.tables) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Busca o pedido aberto mais recente de uma mesa (para caso de transferência)
  async function fetchCurrentOrderForTable(tableId: string) {
    const pb = pbRef.current
    try {
      const { items: orders } = await pb.collection('orders').getList(1, 1, {
        filter: `table_id = "${tableId}" && (status = "open" || status = "preparing" || status = "served")`,
        sort: '-code',
      })
      if (!orders.length) return
      const order = orders[0]
      const { items: orderItems } = await pb.collection('order_items').getList(1, 100, {
        filter: `order_id = "${order.id}"`,
      })
      const items = await Promise.all(
        orderItems.map(async (item: any) => {
          let menuItem: any = null
          try { menuItem = await pb.collection('menu_items').getOne(item.menu_item_id) } catch {}
          return { ...item, menu_item: menuItem ? { name: menuItem.name } : null }
        })
      )
      setTables(prev => prev.map(t =>
        t.id === tableId ? { ...t, status: 'occupied' as const, current_order: { ...order, order_items: items } as any } : t
      ))
    } catch {}
  }

  // Realtime subscriptions
  useEffect(() => {
    const pb = pbRef.current
    const unsubs: (() => void)[] = []

    pb.collection('tables').subscribe('*', event => {
      if (event.action === 'update') {
        const newTable = event.record as unknown as Table
        setTables(prev => {
          const existing = prev.find(t => t.id === newTable.id)
          if (existing && existing.status !== newTable.status) {
            if (newTable.status === 'occupied') {
              toast.success(`Mesa ${newTable.number} — ocupada`)
              if (!existing.current_order) fetchCurrentOrderForTable(newTable.id)
            } else if (newTable.status === 'empty') {
              toast.info(`Mesa ${newTable.number} — comanda fechada`)
            }
          }
          return prev.map(t => t.id === newTable.id ? { ...t, ...newTable } : t)
        })
      }
      if (event.action === 'create') {
        setTables(prev => [...prev, { ...(event.record as unknown as Table), current_order: null }])
      }
      if (event.action === 'delete') {
        setTables(prev => prev.filter(t => t.id !== event.record.id))
      }
    }, { filter: `restaurant_id = "${restaurantId}"` })
      .then(unsub => unsubs.push(unsub))
      .catch(() => {})

    pb.collection('orders').subscribe('*', async event => {
      if (event.action === 'create') {
        const order = event.record
        if (order.restaurant_id !== restaurantId) return
        try {
          const { items: orderItems } = await pb.collection('order_items').getList(1, 100, {
            filter: `order_id = "${order.id}"`,
          })
          const items = await Promise.all(
            orderItems.map(async (item: any) => {
              let menuItem: any = null
              try { menuItem = await pb.collection('menu_items').getOne(item.menu_item_id) } catch {}
              return { ...item, menu_item: menuItem ? { name: menuItem.name } : null }
            })
          )
          setTables(prev => prev.map(t =>
            t.id === order.table_id
              ? { ...t, status: 'occupied' as const, current_order: { ...order, order_items: items } as any }
              : t
          ))
        } catch {}
      }
      if (event.action === 'update') {
        const updated = event.record
        if (['closed', 'cancelled'].includes(updated.status)) return
        setTables(prev => prev.map(t => {
          if (t.id !== updated.table_id) return t
          if (!t.current_order) return t
          return { ...t, current_order: { ...t.current_order, total: updated.total } }
        }))
      }
    }, { filter: `restaurant_id = "${restaurantId}"` })
      .then(unsub => unsubs.push(unsub))
      .catch(() => {})

    return () => { unsubs.forEach(u => u()) }
  }, [])

  function handleMouseDown(e: React.MouseEvent, tableId: string) {
    if ((e.target as HTMLElement).closest('button')) return
    dragMovedRef.current = false
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setDragging(tableId)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !mapRef.current) return
    dragMovedRef.current = true
    const mapRect = mapRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(95, ((e.clientX - mapRect.left - dragOffset.x) / mapRect.width) * 100))
    const y = Math.max(0, Math.min(95, ((e.clientY - mapRect.top - dragOffset.y) / mapRect.height) * 100))
    setTables(prev => prev.map(t => t.id === dragging ? { ...t, pos_x: x, pos_y: y } : t))
  }

  async function handleMouseUp() {
    if (!dragging) return
    const table = tables.find(t => t.id === dragging)
    if (table) {
      await pbRef.current.collection('tables').update(table.id, { pos_x: table.pos_x, pos_y: table.pos_y })
    }
    setDragging(null)
  }

  async function addTable() {
    const pb = pbRef.current
    const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0)
    try {
      const data = await pb.collection('tables').create({
        restaurant_id: restaurantId,
        number: maxNum + 1,
        capacity: 4,
        pos_x: 10,
        pos_y: 10,
        status: 'empty',
      })
      // Realtime 'create' event atualiza o estado — não atualizar localmente para evitar duplicata
      toast.success(`Mesa ${(data as any).number} adicionada`)
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message ?? 'Desconhecido'))
    }
  }

  async function deleteTable(id: string) {
    try {
      await pbRef.current.collection('tables').delete(id)
      // Realtime 'delete' event atualiza o estado — não atualizar localmente para evitar duplicata
      toast.success('Mesa removida')
    } catch (err: any) {
      toast.error('Erro ao remover: ' + (err?.message ?? 'Desconhecido'))
    }
  }

  const appUrl = localIP && localIP !== '127.0.0.1'
    ? `http://${localIP}:3100`
    : (typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? ''))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-sm">Carregando mesas...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button onClick={addTable} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus size={16} className="mr-1" /> Nova mesa
        </Button>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {[
            { color: 'bg-gray-300',   label: 'Livre' },
            { color: 'bg-blue-300',   label: 'Reservada' },
            { color: 'bg-yellow-200', label: 'Ocupada' },
            { color: 'bg-orange-300', label: 'R$100–500' },
            { color: 'bg-green-300',  label: 'acima R$500' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded-full ${color}`} />
              <span className="text-gray-600">{label}</span>
            </span>
          ))}
        </div>
      </div>

      <div
        ref={mapRef}
        className="relative w-full bg-white border rounded-xl table-map-container select-none"
        style={{ height: '65vh', minHeight: 400 }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {tables.map(table => {
          const colors = getTableColor(table)
          return (
            <div
              key={table.id}
              className={`absolute w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing shadow-sm transition-shadow hover:shadow-md ${colors.bg} ${colors.border}`}
              style={{ left: `${table.pos_x}%`, top: `${table.pos_y}%`, transform: 'translate(-50%,-50%)' }}
              onMouseDown={e => handleMouseDown(e, table.id)}
              onClick={() => !dragMovedRef.current && setSelected(table)}
            >
              <span className={`text-xs font-bold ${colors.text}`}>{table.number}</span>
              <span className={`text-xs ${colors.text} leading-none`}>{colors.label}</span>
              <div className="absolute -top-2 -right-2 flex gap-0.5">
                <button
                  onClick={e => { e.stopPropagation(); setQrTable(table) }}
                  className="w-5 h-5 bg-white rounded-full border shadow flex items-center justify-center hover:bg-gray-50"
                >
                  <QrCode size={10} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteTable(table.id) }}
                  className="w-5 h-5 bg-white rounded-full border shadow flex items-center justify-center hover:bg-red-50 text-red-400"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <TablePopup
          table={tables.find(t => t.id === selected.id) || selected}
          onClose={() => setSelected(null)}
          onUpdate={updated => setTables(prev => prev.map(t => t.id === updated.id ? updated : t))}
        />
      )}

      <Dialog open={!!qrTable} onOpenChange={() => setQrTable(null)}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>QR Code — Mesa {qrTable?.number}</DialogTitle>
          </DialogHeader>
          {qrTable && (
            <div className="flex flex-col items-center gap-4 py-2">
              <QRCode value={`${appUrl}/checkin?table=${qrTable.id}`} size={200} />
              <p className="text-xs text-gray-400 break-all">{appUrl}/checkin?table={qrTable.id}</p>
              <Button
                variant="outline"
                onClick={() => {
                  const canvas = document.querySelector('canvas')
                  if (!canvas) return
                  const a = document.createElement('a')
                  a.download = `mesa-${qrTable.number}.png`
                  a.href = canvas.toDataURL()
                  a.click()
                }}
              >
                Baixar QR Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
