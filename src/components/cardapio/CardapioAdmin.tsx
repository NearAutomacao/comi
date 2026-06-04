'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Pencil, Trash2, ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { MenuCategory, MenuItem, CostItem } from '@/types'
import Image from 'next/image'

interface Props {
  restaurantId: string
  initialCategories: MenuCategory[]
  initialItems: MenuItem[]
}

interface ItemForm {
  name: string
  description: string
  price: string
  category_id: string
  available: boolean
  photo_url: string
  cost_items: { ingredient: string; quantity: string; unit_cost: string }[]
}

const emptyForm = (): ItemForm => ({
  name: '', description: '', price: '', category_id: '', available: true, photo_url: '',
  cost_items: [{ ingredient: '', quantity: '', unit_cost: '0' }],
})

export default function CardapioAdmin({ restaurantId, initialCategories, initialItems }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<ItemForm>(emptyForm())
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeCategory, setActiveCategory] = useState(initialCategories[0]?.id ?? '')
  const supabase = createClient()

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm(), category_id: activeCategory })
    setOpen(true)
  }

  function openEdit(item: MenuItem) {
    setEditing(item)
    setForm({
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      category_id: item.category_id,
      available: item.available,
      photo_url: item.photo_url ?? '',
      cost_items: item.cost_items?.length
        ? item.cost_items.map(c => ({ ingredient: c.ingredient, quantity: c.quantity ?? '', unit_cost: String(c.unit_cost) }))
        : [{ ingredient: '', quantity: '', unit_cost: '0' }],
    })
    setOpen(true)
  }

  async function uploadPhoto(file: File): Promise<string> {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-photos').upload(path, file)
    if (error) { toast.error('Erro ao fazer upload'); setUploading(false); return '' }
    const { data: { publicUrl } } = supabase.storage.from('menu-photos').getPublicUrl(path)
    setUploading(false)
    return publicUrl
  }

  async function handleSave() {
    const price = parseFloat(form.price)
    if (!form.name || !form.category_id || isNaN(price)) {
      toast.error('Preencha nome, categoria e preço')
      return
    }

    const payload = {
      restaurant_id: restaurantId,
      name: form.name,
      description: form.description || null,
      price,
      category_id: form.category_id,
      available: form.available,
      photo_url: form.photo_url || null,
    }

    let itemId = editing?.id

    if (editing) {
      const { error } = await supabase.from('menu_items').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return }
      await supabase.from('cost_items').delete().eq('menu_item_id', editing.id)
    } else {
      const { data, error } = await supabase.from('menu_items').insert(payload).select().single()
      if (error) { toast.error('Erro ao salvar: ' + error.message); return }
      itemId = data?.id
    }

    if (itemId) {
      const costPayloads = form.cost_items
        .filter(c => c.ingredient)
        .map(c => ({ restaurant_id: restaurantId, menu_item_id: itemId!, ingredient: c.ingredient, quantity: c.quantity || null, unit_cost: parseFloat(c.unit_cost) || 0 }))
      if (costPayloads.length) await supabase.from('cost_items').insert(costPayloads)
    }

    const { data: fresh } = await supabase.from('menu_items').select('*, cost_items(*)').eq('id', itemId!).single()
    if (fresh) {
      if (editing) setItems(prev => prev.map(i => i.id === fresh.id ? fresh as MenuItem : i))
      else setItems(prev => [...prev, fresh as MenuItem])
    }

    toast.success(editing ? 'Item atualizado' : 'Item adicionado')
    setOpen(false)
  }

  async function deleteItem(id: string) {
    await supabase.from('menu_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    toast.success('Item removido')
  }

  async function toggleAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
  }

  const filteredItems = items.filter(i => i.category_id === activeCategory)

  return (
    <>
      {/* Category tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <Button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white mb-4">
        <Plus size={16} className="mr-1" /> Novo item
      </Button>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map(item => (
          <Card key={item.id} className="shadow-sm overflow-hidden">
            {item.photo_url && (
              <div className="relative h-32 w-full bg-gray-100">
                <Image src={item.photo_url} alt={item.name} fill className="object-cover" sizes="300px" />
              </div>
            )}
            <CardContent className="pt-3 pb-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="text-orange-600 font-bold text-sm">{formatCurrency(item.price)}</p>
                  {item.cost_items && item.cost_items.length > 0 && (
                    <p className="text-xs text-gray-400">
                      Custo: {formatCurrency(item.cost_items.reduce((s, c) => s + c.unit_cost, 0))}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Switch
                    checked={item.available}
                    onCheckedChange={() => toggleAvailable(item)}
                    className="scale-75"
                  />
                  <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-blue-500">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {!item.available && <Badge variant="outline" className="text-xs text-red-500 border-red-300">Indisponível</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar item' : 'Novo item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
            </div>

            {/* Photo upload */}
            <div className="space-y-2">
              <Label>Foto</Label>
              {form.photo_url && (
                <div className="relative h-28 w-full rounded-lg overflow-hidden">
                  <Image src={form.photo_url} alt="preview" fill className="object-cover" sizes="400px" />
                  <button
                    className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow"
                    onClick={() => setForm(f => ({ ...f, photo_url: '' }))}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 rounded-lg p-3 hover:bg-gray-50 text-sm text-gray-500">
                <ImagePlus size={18} />
                {uploading ? 'Enviando...' : 'Escolher foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const url = await uploadPhoto(file)
                      if (url) setForm(f => ({ ...f, photo_url: url }))
                    }
                  }}
                />
              </label>
            </div>

            {/* Cost items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingredientes / Custo</Label>
                <button
                  onClick={() => setForm(f => ({ ...f, cost_items: [...f.cost_items, { ingredient: '', quantity: '', unit_cost: '0' }] }))}
                  className="text-orange-500 text-sm flex items-center gap-1"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              {form.cost_items.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Ingrediente"
                    value={c.ingredient}
                    onChange={e => setForm(f => ({ ...f, cost_items: f.cost_items.map((ci, idx) => idx === i ? { ...ci, ingredient: e.target.value } : ci) }))}
                    className="flex-1 text-sm"
                  />
                  <Input
                    placeholder="Qtd"
                    value={c.quantity}
                    onChange={e => setForm(f => ({ ...f, cost_items: f.cost_items.map((ci, idx) => idx === i ? { ...ci, quantity: e.target.value } : ci) }))}
                    className="w-20 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="R$"
                    value={c.unit_cost}
                    onChange={e => setForm(f => ({ ...f, cost_items: f.cost_items.map((ci, idx) => idx === i ? { ...ci, unit_cost: e.target.value } : ci) }))}
                    className="w-20 text-sm"
                    step="0.01"
                  />
                  <button
                    onClick={() => setForm(f => ({ ...f, cost_items: f.cost_items.filter((_, idx) => idx !== i) }))}
                    className="text-gray-300 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.available} onCheckedChange={v => setForm(f => ({ ...f, available: v }))} />
              <Label>Disponível no cardápio</Label>
            </div>

            <Button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              {editing ? 'Salvar alterações' : 'Criar item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
