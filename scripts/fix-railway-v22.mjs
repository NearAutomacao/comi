#!/usr/bin/env node
/**
 * Corrige o schema do Railway PocketBase v0.22.
 * Usa o formato correto de `fields` (não `schema`) do v0.22.
 */
const PB = 'https://pocketbase-production-3f40.up.railway.app'
const ADMIN_EMAIL = 'contato@nearautomacao.com'
const ADMIN_PASS  = 'Cvale@2018'
const USER_ID     = '4njqu0i4drgozw9' // luan3d@hotmail.com

// Helpers para montar field no formato v0.22
const tf  = (name, req = false) => ({ id: `text_${name}`,   name, type: 'text',   required: req, hidden: false, presentable: false, min: null, max: null, pattern: '', autogeneratePattern: '' })
const nf  = (name, req = false) => ({ id: `num_${name}`,    name, type: 'number', required: req, hidden: false, presentable: false, min: null, max: null, noDecimal: false })
const bf  = (name)              => ({ id: `bool_${name}`,   name, type: 'bool',   required: false, hidden: false, presentable: false })
const sf  = (name, vals, req)   => ({ id: `sel_${name}`,    name, type: 'select', required: !!req, hidden: false, presentable: false, maxSelect: 1, values: vals })
const jf  = (name)              => ({ id: `json_${name}`,   name, type: 'json',   required: false, hidden: false, presentable: false, maxSize: 2000000 })
const df  = (name)              => ({ id: `date_${name}`,   name, type: 'date',   required: false, hidden: false, presentable: false, min: '', max: '' })

const FIELDS = {
  users: [
    tf('phone'), tf('cpf'),
    sf('role', ['manager','customer'], true),
    tf('restaurant_id'),
  ],
  restaurants: [
    tf('owner_id', true), tf('name', true), tf('slug'),
    tf('logo_url'), tf('address'),
    tf('mp_access_token'), tf('mp_public_key'), tf('mp_refresh_token'), tf('mp_user_id'),
    tf('printer_kitchen_host'), nf('printer_kitchen_port'),
    tf('printer_bar_host'), nf('printer_bar_port'),
  ],
  tables: [
    tf('restaurant_id', true), nf('number', true), nf('capacity'), nf('pos_x'), nf('pos_y'),
    sf('status', ['empty','reserved','occupied'], true),
    tf('guest_name'), tf('guest_phone'),
  ],
  table_sessions: [
    tf('restaurant_id', true), tf('table_id', true),
    tf('guest_name'), tf('guest_phone'), df('sat_at'), df('left_at'),
  ],
  menu_categories: [
    tf('restaurant_id', true), tf('name', true), tf('slug'), nf('display_order'),
    sf('printer', ['kitchen','bar']),
  ],
  menu_items: [
    tf('restaurant_id', true), tf('category_id', true), tf('name', true),
    tf('description'), nf('price', true), tf('photo_url'),
    bf('available'), nf('display_order'),
  ],
  cost_items: [
    tf('restaurant_id', true), tf('menu_item_id', true), tf('ingredient', true),
    tf('quantity'), nf('unit_cost'),
  ],
  orders: [
    tf('restaurant_id', true), tf('table_id'), tf('customer_id'), tf('session_id'),
    nf('code'),
    sf('status', ['open','preparing','served','closed','cancelled'], true),
    nf('total'),
    sf('payment_status', ['pending','paid','refunded']),
    tf('delivery_name'), tf('delivery_phone'),
  ],
  order_items: [
    tf('restaurant_id'), tf('order_id', true), tf('menu_item_id', true),
    nf('quantity', true), nf('unit_price', true), tf('notes'),
    sf('status', ['pending','preparing','ready','served']),
  ],
  payments: [
    tf('restaurant_id', true), tf('order_id'), tf('reservation_id'),
    sf('method', ['credit_card','debit_card','pix','cash'], true),
    nf('amount', true),
    sf('status', ['pending','paid','refunded']),
    tf('mercadopago_id'), nf('installments'),
  ],
  print_jobs: [
    tf('restaurant_id', true), tf('order_id'),
    sf('printer', ['kitchen','bar'], true),
    jf('items'),
    nf('table_number'), tf('guest_name'), nf('order_code'), df('printed_at'),
  ],
  order_sequences: [
    tf('restaurant_id', true), nf('last_code'),
  ],
  working_hours: [
    tf('restaurant_id', true), nf('day_of_week'), tf('open_time'), tf('close_time'), bf('is_open'),
  ],
  closed_dates: [
    tf('restaurant_id', true), tf('date', true), tf('reason'),
  ],
  reservations: [
    tf('restaurant_id', true), tf('table_id'), tf('customer_id'),
    tf('date', true), tf('time', true), nf('guest_count'),
    sf('status', ['pending','confirmed','cancelled','completed'], true),
    sf('payment_status', ['unpaid','paid','refunded']),
    tf('payment_id'), tf('notes'),
  ],
  subscriptions: [
    tf('restaurant_id', true),
    sf('plan', ['trial','basic','pro'], true),
    sf('status', ['trial','active','suspended','cancelled'], true),
    df('starts_at'), df('expires_at'), tf('mp_preapproval_id'),
  ],
}

async function main() {
  const auth = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
  }).then(r => r.json())

  const token = auth.token
  if (!token) { console.error('Auth falhou:', JSON.stringify(auth)); process.exit(1) }
  console.log('Autenticado.\n')

  // 1. Patch fields de todas as collections
  for (const [colName, newFields] of Object.entries(FIELDS)) {
    const existing = await fetch(`${PB}/api/collections/${colName}`, {
      headers: { Authorization: token },
    }).then(r => r.json())

    const existingNames = (existing.fields ?? []).map(f => f.name)
    const toAdd = newFields.filter(f => !existingNames.includes(f.name))

    if (toAdd.length === 0) { console.log(`  — ${colName} (já ok)`); continue }

    const merged = [...(existing.fields ?? []), ...toAdd]
    const res = await fetch(`${PB}/api/collections/${colName}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ fields: merged }),
    }).then(r => r.json())

    if (res.id) {
      console.log(`  ✓ ${colName} (+${toAdd.map(f => f.name).join(', ')})`)
    } else {
      console.log(`  ✗ ${colName}: ${JSON.stringify(res).slice(0, 300)}`)
    }
  }

  console.log('\nCorrigindo usuário e restaurante...')

  // 2. Limpar restaurantes sem owner_id (os criados pelo script antigo)
  const rests = await fetch(`${PB}/api/collections/restaurants/records?perPage=50`, {
    headers: { Authorization: token },
  }).then(r => r.json())

  for (const r of rests.items ?? []) {
    if (!r.owner_id || r.owner_id === 'TEST') {
      await fetch(`${PB}/api/collections/restaurants/records/${r.id}`, {
        method: 'DELETE', headers: { Authorization: token },
      })
      console.log(`  deletado restaurante inválido: ${r.id}`)
    }
  }

  // 3. Criar restaurante correto
  const restRes = await fetch(`${PB}/api/collections/restaurants/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ owner_id: USER_ID, name: 'Restaurante de Luan', slug: 'restaurante-luan' }),
  }).then(r => r.json())

  if (!restRes.id) { console.error('Falha ao criar restaurante:', JSON.stringify(restRes)); process.exit(1) }
  const restId = restRes.id
  console.log(`  restaurante criado: ${restId} — ${restRes.name}`)

  // 4. Atualizar usuário
  const userRes = await fetch(`${PB}/api/collections/users/records/${USER_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ role: 'manager', restaurant_id: restId }),
  }).then(r => r.json())

  console.log(`  usuário: role=${userRes.role} restaurant_id=${userRes.restaurant_id}`)

  // 5. Horários padrão
  for (let d = 0; d <= 6; d++) {
    await fetch(`${PB}/api/collections/working_hours/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ restaurant_id: restId, day_of_week: d, open_time: '11:00', close_time: '23:00', is_open: true }),
    })
  }
  console.log('  horários criados')

  // 6. Categorias padrão
  const cats = [
    { name: 'Porções',    slug: 'porcoes',    display_order: 1 },
    { name: 'Lanches',    slug: 'lanches',    display_order: 2 },
    { name: 'Bebidas',    slug: 'bebidas',    display_order: 3 },
    { name: 'Sobremesas', slug: 'sobremesas', display_order: 4 },
  ]
  for (const cat of cats) {
    await fetch(`${PB}/api/collections/menu_categories/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ restaurant_id: restId, ...cat }),
    })
  }
  console.log('  categorias criadas')

  // 7. Subscription trial
  const now = new Date()
  const exp = new Date(); exp.setDate(exp.getDate() + 30)
  await fetch(`${PB}/api/collections/subscriptions/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ restaurant_id: restId, plan: 'trial', status: 'trial', starts_at: now.toISOString(), expires_at: exp.toISOString() }),
  })
  console.log('  subscription trial criada')

  console.log('\n✓ Pronto! luan3d@hotmail.com pode fazer login em comi.awplabs.com.br')
}

main().catch(err => { console.error(err); process.exit(1) })
