'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/pb/client'
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
import { Plus, Pencil, Trash2, ImagePlus, X, UtensilsCrossed, Wine, ChevronDown, FolderPlus } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories)
  const [items, setItems] = useState(initialItems)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<ItemForm>(emptyForm())
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeCategory, setActiveCategory] = useState(initialCategories[0]?.id ?? '')
  const [catDialog, setCatDialog] = useState<{ mode: 'new' | 'rename'; catId?: string; value: string } | null>(null)
  const pbRef = useRef(createClient())

  async function handleSaveCategory() {
    const name = catDialog?.value.trim()
    if (!name) return
    const pb = pbRef.current
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    if (catDialog?.mode === 'new') {
      const display_order = categories.length
      try {
        const data = await pb.collection('menu_categories').create({
          restaurant_id: restaurantId, name, slug, display_order,
        })
        setCategories(prev => [...prev, data as unknown as MenuCategory])
        setActiveCategory((data as any).id)
      } catch (err: any) {
        toast.error('Erro ao criar categoria: ' + (err?.message ?? 'Desconhecido'))
        return
      }
    } else {
      const catId = catDialog?.catId!
      try {
        await pb.collection('menu_categories').update(catId, { name, slug })
        setCategories(prev => prev.map(c => c.id === catId ? { ...c, name, slug } : c))
      } catch (err: any) {
        toast.error('Erro ao renomear: ' + (err?.message ?? 'Desconhecido'))
        return
      }
    }
    setCatDialog(null)
  }

  async function deleteCategory(catId: string) {
    const hasItems = items.some(i => i.category_id === catId)
    if (hasItems) {
      toast.error('Remova todos os itens desta categoria antes de excluí-la')
      return
    }
    try {
      await pbRef.current.collection('menu_categories').delete(catId)
      const next = categories.filter(c => c.id !== catId)
      setCategories(next)
      if (activeCategory === catId) setActiveCategory(next[0]?.id ?? '')
      toast.success('Categoria removida')
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err?.message ?? 'Desconhecido'))
    }
  }

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm(), category_id: activeCategory })
    setPendingPhotoFile(null)
    setPhotoPreview('')
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
    setPendingPhotoFile(null)
    setPhotoPreview(item.photo_url ?? '')
    setOpen(true)
  }

  function handlePhotoSelect(file: File) {
    setPendingPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setForm(f => ({ ...f, photo_url: '' }))
  }

  async function handleSave() {
    const price = parseFloat(form.price)
    if (!form.name || !form.category_id || isNaN(price)) {
      toast.error('Preencha nome, categoria e preço')
      return
    }

    const pb = pbRef.current
    setUploading(true)

    const payload = {
      restaurant_id: restaurantId,
      name: form.name,
      description: form.description || null,
      price,
      category_id: form.category_id,
      available: form.available,
      photo_url: form.photo_url || null,
    }

    let savedRecord: any = null

    try {
      if (editing) {
        savedRecord = await pb.collection('menu_items').update(editing.id, payload)
      } else {
        savedRecord = await pb.collection('menu_items').create(payload)
      }
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message ?? 'Desconhecido'))
      setUploading(false)
      return
    }

    const itemId = savedRecord.id

    // Upload photo if a new file was selected
    if (pendingPhotoFile) {
      try {
        const fd = new FormData()
        fd.append('photo', pendingPhotoFile)
        const photoRecord = await pb.collection('menu_items').update(itemId, fd)
        const filename = Array.isArray(photoRecord.photo) ? photoRecord.photo[0] : photoRecord.photo
        if (filename) {
          const photoUrl = `${pb.baseURL}/api/files/menu_items/${itemId}/${filename}`
          savedRecord = await pb.collection('menu_items').update(itemId, { photo_url: photoUrl })
        }
      } catch {}
    }

    // Delete old cost_items then recreate
    try {
      const { items: oldCosts } = await pb.collection('cost_items').getList(1, 50, {
        filter: `menu_item_id = "${itemId}"`,
      })
      for (const c of oldCosts) {
        await pb.collection('cost_items').delete(c.id)
      }
    } catch {}

    const validCosts = form.cost_items.filter(c => c.ingredient)
    const newCostItems: CostItem[] = []
    for (const c of validCosts) {
      try {
        const created = await pb.collection('cost_items').create({
          restaurant_id: restaurantId,
          menu_item_id: itemId,
          ingredient: c.ingredient,
          quantity: c.quantity || null,
          unit_cost: parseFloat(c.unit_cost) || 0,
        })
        newCostItems.push(created as unknown as CostItem)
      } catch {}
    }

    setUploading(false)

    const finalItem: MenuItem = {
      ...(savedRecord as any),
      cost_items: newCostItems,
    }

    if (editing) setItems(prev => prev.map(i => i.id === itemId ? finalItem : i))
    else setItems(prev => [...prev, finalItem])

    toast.success(editing ? 'Item atualizado' : 'Item adicionado')
    setOpen(false)
    setPendingPhotoFile(null)
    setPhotoPreview('')
  }

  async function deleteItem(id: string) {
    const pb = pbRef.current
    try {
      await pb.collection('menu_items').delete(id)
      setItems(prev => prev.filter(i => i.id !== id))
      toast.success('Item removido')
    } catch (err: any) {
      if (err?.status === 400) {
        // Has referenced records — disable instead
        await pb.collection('menu_items').update(id, { available: false })
        setItems(prev => prev.map(i => i.id === id ? { ...i, available: false } : i))
        toast.warning('Item tem pedidos vinculados. Foi desativado em vez de excluído.')
        return
      }
      toast.error('Não foi possível remover: ' + (err?.message ?? 'Desconhecido'))
    }
  }

  async function setCategoryPrinter(categoryId: string, printer: 'kitchen' | 'bar' | null) {
    try {
      await pbRef.current.collection('menu_categories').update(categoryId, { printer })
      setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, printer } : c))
      toast.success(printer ? `Impressora: ${printer === 'kitchen' ? 'Cozinha' : 'Bar'}` : 'Impressora removida')
    } catch {
      toast.error('Erro ao salvar impressora')
    }
  }

  async function toggleAvailable(item: MenuItem) {
    await pbRef.current.collection('menu_items').update(item.id, { available: !item.available })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
  }

  const filteredItems = items.filter(i => i.category_id === activeCategory)

  return (
    <>
      {/* Category tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 items-center">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-l-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.printer === 'kitchen' && <UtensilsCrossed size={11} className="inline mr-1 opacity-70" />}
              {cat.printer === 'bar' && <Wine size={11} className="inline mr-1 opacity-70" />}
              {cat.name}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`px-1.5 py-1.5 rounded-r-full text-sm transition-colors ${
                    activeCategory === cat.id ? 'bg-orange-400 text-white hover:bg-orange-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  title="Opções da categoria"
                >
                  <ChevronDown size={11} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="text-sm">
                <div className="px-2 py-1 text-xs text-gray-400 font-medium">Impressora</div>
                <DropdownMenuItem
                  onClick={() => setCategoryPrinter(cat.id, 'kitchen')}
                  className={cat.printer === 'kitchen' ? 'bg-orange-50 text-orange-700' : ''}
                >
                  <UtensilsCrossed size={13} className="mr-2" /> Cozinha
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCategoryPrinter(cat.id, 'bar')}
                  className={cat.printer === 'bar' ? 'bg-orange-50 text-orange-700' : ''}
                >
                  <Wine size={13} className="mr-2" /> Bar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCategoryPrinter(cat.id, null)}
                  className={!cat.printer ? 'bg-gray-50 text-gray-500' : ''}
                >
                  Não definido
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCatDialog({ mode: 'rename', catId: cat.id, value: cat.name })}>
                  <Pencil size={13} className="mr-2" /> Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => deleteCategory(cat.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 size={13} className="mr-2" /> Excluir categoria
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        <button
          onClick={() => setCatDialog({ mode: 'new', value: '' })}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
        >
          <FolderPlus size={14} /> Nova categoria
        </button>
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Crie uma categoria para começar a cadastrar itens</p>
        </div>
      )}

      {categories.length > 0 && (
        <Button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white mb-4">
          <Plus size={16} className="mr-1" /> Novo item
        </Button>
      )}

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

      {/* Dialog: nova/renomear categoria */}
      <Dialog open={!!catDialog} onOpenChange={v => { if (!v) setCatDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{catDialog?.mode === 'new' ? 'Nova categoria' : 'Renomear categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome da categoria</Label>
              <Input
                autoFocus
                value={catDialog?.value ?? ''}
                onChange={e => setCatDialog(d => d ? { ...d, value: e.target.value } : d)}
                onKeyDown={e => e.key === 'Enter' && handleSaveCategory()}
                placeholder="Ex: Lanches, Bebidas, Sobremesas..."
              />
            </div>
            <Button onClick={handleSaveCategory} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              {catDialog?.mode === 'new' ? 'Criar categoria' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setPendingPhotoFile(null); setPhotoPreview('') } }}>
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
              {(photoPreview || form.photo_url) && (
                <div className="relative h-28 w-full rounded-lg overflow-hidden">
                  <Image src={photoPreview || form.photo_url} alt="preview" fill className="object-cover" sizes="400px" />
                  <button
                    className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow"
                    onClick={() => { setForm(f => ({ ...f, photo_url: '' })); setPendingPhotoFile(null); setPhotoPreview('') }}
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
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handlePhotoSelect(file)
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

            <Button onClick={handleSave} disabled={uploading} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              {uploading ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
