#!/usr/bin/env node
const PB = 'https://pocketbase-production-a80c.up.railway.app'

const SCHEMAS = {
  restaurants: [
    { name: 'owner_id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: false },
    { name: 'logo_url', type: 'text', required: false },
    { name: 'address', type: 'text', required: false },
    { name: 'mp_access_token', type: 'text', required: false },
    { name: 'mp_public_key', type: 'text', required: false },
    { name: 'mp_refresh_token', type: 'text', required: false },
    { name: 'mp_user_id', type: 'text', required: false },
    { name: 'printer_kitchen_host', type: 'text', required: false },
    { name: 'printer_kitchen_port', type: 'number', required: false },
    { name: 'printer_bar_host', type: 'text', required: false },
    { name: 'printer_bar_port', type: 'number', required: false },
  ],
  tables: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'number', type: 'number', required: true },
    { name: 'capacity', type: 'number', required: false },
    { name: 'pos_x', type: 'number', required: false },
    { name: 'pos_y', type: 'number', required: false },
    { name: 'status', type: 'select', required: true, options: { maxSelect: 1, values: ['empty','reserved','occupied'] } },
    { name: 'guest_name', type: 'text', required: false },
    { name: 'guest_phone', type: 'text', required: false },
  ],
  table_sessions: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'table_id', type: 'text', required: true },
    { name: 'guest_name', type: 'text', required: false },
    { name: 'guest_phone', type: 'text', required: false },
    { name: 'sat_at', type: 'date', required: false },
    { name: 'left_at', type: 'date', required: false },
  ],
  menu_categories: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: false },
    { name: 'display_order', type: 'number', required: false },
    { name: 'printer', type: 'select', required: false, options: { maxSelect: 1, values: ['kitchen','bar'] } },
  ],
  menu_items: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'category_id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'text', required: false },
    { name: 'price', type: 'number', required: true },
    { name: 'photo_url', type: 'text', required: false },
    { name: 'available', type: 'bool', required: false },
    { name: 'display_order', type: 'number', required: false },
  ],
  cost_items: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'menu_item_id', type: 'text', required: true },
    { name: 'ingredient', type: 'text', required: true },
    { name: 'quantity', type: 'text', required: false },
    { name: 'unit_cost', type: 'number', required: false },
  ],
  orders: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'table_id', type: 'text', required: false },
    { name: 'customer_id', type: 'text', required: false },
    { name: 'session_id', type: 'text', required: false },
    { name: 'code', type: 'number', required: false },
    { name: 'status', type: 'select', required: true, options: { maxSelect: 1, values: ['open','preparing','served','closed','cancelled'] } },
    { name: 'total', type: 'number', required: false },
    { name: 'payment_status', type: 'select', required: false, options: { maxSelect: 1, values: ['pending','paid','refunded'] } },
    { name: 'delivery_name', type: 'text', required: false },
    { name: 'delivery_phone', type: 'text', required: false },
  ],
  order_items: [
    { name: 'restaurant_id', type: 'text', required: false },
    { name: 'order_id', type: 'text', required: true },
    { name: 'menu_item_id', type: 'text', required: true },
    { name: 'quantity', type: 'number', required: true },
    { name: 'unit_price', type: 'number', required: true },
    { name: 'notes', type: 'text', required: false },
    { name: 'status', type: 'select', required: false, options: { maxSelect: 1, values: ['pending','preparing','ready','served'] } },
  ],
  payments: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'order_id', type: 'text', required: false },
    { name: 'reservation_id', type: 'text', required: false },
    { name: 'method', type: 'select', required: true, options: { maxSelect: 1, values: ['credit_card','debit_card','pix','cash'] } },
    { name: 'amount', type: 'number', required: true },
    { name: 'status', type: 'select', required: false, options: { maxSelect: 1, values: ['pending','paid','refunded'] } },
    { name: 'mercadopago_id', type: 'text', required: false },
    { name: 'installments', type: 'number', required: false },
  ],
  print_jobs: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'order_id', type: 'text', required: false },
    { name: 'printer', type: 'select', required: true, options: { maxSelect: 1, values: ['kitchen','bar'] } },
    { name: 'items', type: 'json', required: false, options: { maxSize: 2000000 } },
    { name: 'table_number', type: 'number', required: false },
    { name: 'guest_name', type: 'text', required: false },
    { name: 'order_code', type: 'number', required: false },
    { name: 'printed_at', type: 'date', required: false },
  ],
  order_sequences: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'last_code', type: 'number', required: false },
  ],
  working_hours: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'day_of_week', type: 'number', required: false },
    { name: 'open_time', type: 'text', required: false },
    { name: 'close_time', type: 'text', required: false },
    { name: 'is_open', type: 'bool', required: false },
  ],
  closed_dates: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'date', type: 'text', required: true },
    { name: 'reason', type: 'text', required: false },
  ],
  reservations: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'table_id', type: 'text', required: false },
    { name: 'customer_id', type: 'text', required: false },
    { name: 'date', type: 'text', required: true },
    { name: 'time', type: 'text', required: true },
    { name: 'guest_count', type: 'number', required: false },
    { name: 'status', type: 'select', required: true, options: { maxSelect: 1, values: ['pending','confirmed','cancelled','completed'] } },
    { name: 'payment_status', type: 'select', required: false, options: { maxSelect: 1, values: ['unpaid','paid','refunded'] } },
    { name: 'payment_id', type: 'text', required: false },
    { name: 'notes', type: 'text', required: false },
  ],
  subscriptions: [
    { name: 'restaurant_id', type: 'text', required: true },
    { name: 'plan', type: 'select', required: true, options: { maxSelect: 1, values: ['trial','basic','pro'] } },
    { name: 'status', type: 'select', required: true, options: { maxSelect: 1, values: ['trial','active','suspended','cancelled'] } },
    { name: 'starts_at', type: 'date', required: false },
    { name: 'expires_at', type: 'date', required: false },
    { name: 'mp_preapproval_id', type: 'text', required: false },
  ],
}

async function main() {
  const auth = await fetch(PB + '/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'contato@nearautomacao.com', password: 'Cvale@2018' }),
  }).then(r => r.json())
  const token = auth.token
  if (!token) { console.error('Auth falhou:', JSON.stringify(auth)); process.exit(1) }
  console.log('Autenticado.\n')

  // Patch schemas
  for (const [colName, fields] of Object.entries(SCHEMAS)) {
    const existing = await fetch(PB + '/api/collections/' + colName, { headers: { Authorization: token } }).then(r => r.json())
    const existingNames = (existing.schema ?? []).map(f => f.name)
    const newFields = fields.filter(f => !existingNames.includes(f.name))
    if (newFields.length === 0) { console.log('  — ' + colName + ' (já ok)'); continue }
    const merged = [...(existing.schema ?? []), ...newFields]
    const res = await fetch(PB + '/api/collections/' + colName, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ schema: merged }),
    }).then(r => r.json())
    if (res.id) console.log('  ✓ ' + colName + ' (+' + newFields.map(f => f.name).join(', ') + ')')
    else console.log('  ✗ ' + colName + ':', JSON.stringify(res).slice(0, 300))
  }

  console.log('\nCorrigindo usuario e restaurante...')

  // Limpa restaurantes duplicados vazios e cria correto
  const rests = await fetch(PB + '/api/collections/restaurants/records?perPage=50', { headers: { Authorization: token } }).then(r => r.json())
  for (const r of rests.items ?? []) {
    await fetch(PB + '/api/collections/restaurants/records/' + r.id, { method: 'DELETE', headers: { Authorization: token } })
    console.log('  deletado restaurante vazio:', r.id)
  }

  // Cria restaurante correto
  const rest = await fetch(PB + '/api/collections/restaurants/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ owner_id: '4njqu0i4drgozw9', name: 'Restaurante de Luan', slug: 'restaurante-luan' }),
  }).then(r => r.json())
  console.log('  restaurante criado:', rest.id, rest.name)

  // Atualiza usuario
  const user = await fetch(PB + '/api/collections/users/records/4njqu0i4drgozw9', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ role: 'manager', restaurant_id: rest.id }),
  }).then(r => r.json())
  console.log('  usuario: role=' + user.role + ' restaurant_id=' + user.restaurant_id)

  // Horários padrão
  for (let d = 0; d <= 6; d++) {
    await fetch(PB + '/api/collections/working_hours/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ restaurant_id: rest.id, day_of_week: d, open_time: '11:00', close_time: '23:00', is_open: true }),
    })
  }
  console.log('  horarios criados')

  // Categorias padrão
  const cats = [
    { name: 'Porcoes', slug: 'porcoes', display_order: 1 },
    { name: 'Lanches', slug: 'lanches', display_order: 2 },
    { name: 'Bebidas', slug: 'bebidas', display_order: 3 },
    { name: 'Sobremesas', slug: 'sobremesas', display_order: 4 },
  ]
  for (const cat of cats) {
    await fetch(PB + '/api/collections/menu_categories/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ restaurant_id: rest.id, ...cat }),
    })
  }
  console.log('  categorias criadas')

  // Subscription trial
  const now = new Date()
  const exp = new Date(); exp.setDate(exp.getDate() + 30)
  await fetch(PB + '/api/collections/subscriptions/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ restaurant_id: rest.id, plan: 'trial', status: 'trial', starts_at: now.toISOString(), expires_at: exp.toISOString() }),
  })
  console.log('  subscription trial criada')

  console.log('\nPronto! luan3d@hotmail.com pode fazer login em comi.awplabs.com.br')
}

main().catch(err => { console.error(err); process.exit(1) })
