'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
}

export default function TableMapAdmin({ restaurantId, initialTables }: Props) {
  const [tables, setTables] = useState<Table[]>(initialTables)
  const [selected, setSelected] = useState<Table | null>(null)
  const [qrTable, setQrTable] = useState<Table | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const mapRef = useRef<HTMLDivElement>(null)
  const dragMovedRef = useRef(false)
  const supabase = createClient()

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('tables-realtime')
      .on('postgres_changes', { event: '*', schema: 'comi', table: 'tables' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setTables(prev => prev.map(t =>
            t.id === (payload.new as Table).id ? { ...t, ...(payload.new as Table) } : t
          ))
        }
        if (payload.eventType === 'INSERT') {
          setTables(prev => [...prev, { ...(payload.new as Table), current_order: null }])
        }
        if (payload.eventType === 'DELETE') {
          setTables(prev => prev.filter(t => t.id !== (payload.old as Table).id))
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'comi', table: 'orders' }, async payload => {
        const newOrder = payload.new as { id: string; table_id: string; total: number; status: string; restaurant_id: string; customer_id?: string; payment_status: string; created_at: string }
        toast('🍽️ Novo pedido!', { description: `Mesa sendo atendida` })
        // Busca o pedido completo com itens
        const { data: completeOrder } = await supabase
          .from('orders')
          .select('id, total, status, restaurant_id, table_id, customer_id, payment_status, created_at, order_items(id, quantity, menu_item:menu_items(name))')
          .eq('id', newOrder.id)
          .single()
        // Atualiza mesa com current_order
        setTables(prev => prev.map(t =>
          t.id === newOrder.table_id
            ? { ...t, status: 'occupied' as const, current_order: completeOrder as any }
            : t
        ))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'comi', table: 'orders' }, payload => {
        const updated = payload.new as { id: string; table_id: string; total: number; status: string }
        setTables(prev => prev.map(t => {
          if (t.id !== updated.table_id) return t
          if (!t.current_order) return t
          return { ...t, current_order: { ...t.current_order, total: updated.total } }
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleMouseDown(e: React.MouseEvent, tableId: string) {
    if ((e.target as HTMLElement).closest('button')) return
    dragMovedRef.current = false
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
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
      await supabase.from('tables').update({ pos_x: table.pos_x, pos_y: table.pos_y }).eq('id', table.id)
    }
    setDragging(null)
  }

  async function addTable() {
    const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0)
    const { data, error } = await supabase
      .from('tables')
      .insert({ restaurant_id: restaurantId, number: maxNum + 1, capacity: 4, pos_x: 10, pos_y: 10, status: 'empty' })
      .select()
      .single()
    if (error) { toast.error('Erro: ' + error.message); return }
    if (data) {
      setTables(prev => [...prev, data as Table])
      toast.success(`Mesa ${data.number} adicionada`)
    }
  }

  async function deleteTable(id: string) {
    const { error } = await supabase.from('tables').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') {
        toast.error('Mesa tem pedidos vinculados. Libere a mesa antes de remover.')
      } else {
        toast.error('Não foi possível remover: ' + error.message)
      }
      return
    }
    setTables(prev => prev.filter(t => t.id !== id))
    toast.success('Mesa removida')
  }

  // Usa a origem real do browser para o QR code funcionar em qualquer ambiente
  const appUrl = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://comi.awplabs.com.br')

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

      {/* QR Code dialog */}
      <Dialog open={!!qrTable} onOpenChange={() => setQrTable(null)}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>QR Code — Mesa {qrTable?.number}</DialogTitle>
          </DialogHeader>
          {qrTable && (
            <div className="flex flex-col items-center gap-4 py-2">
              <QRCode value={`${appUrl}/mesa/${qrTable.id}`} size={200} />
              <p className="text-xs text-gray-400 break-all">{appUrl}/mesa/{qrTable.id}</p>
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
