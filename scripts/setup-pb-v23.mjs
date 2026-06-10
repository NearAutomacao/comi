#!/usr/bin/env node
/**
 * Setup PocketBase v0.23 para COMI.
 * PocketBase v0.23 usa "fields" (não "schema") para definir colunas.
 *
 * Uso:
 *   node scripts/setup-pb-v23.mjs
 */

const PB      = 'https://pocketbase-production-a80c.up.railway.app'
const SU_MAIL = 'contato@nearautomacao.com'
const SU_PASS = 'Cvale@2018'

// Usuário gerente do app
const MGR_EMAIL = 'luan3d@hotmail.com'
const MGR_PASS  = 'LLww1993.'
const MGR_NAME  = 'Luan'

// Dados do restaurante
const REST_NAME = 'Restaurante Luan'
const REST_SLUG = 'restaurante-luan'

// ─── helpers de campo (v0.23 flat format) ─────────────────────────────────────
const f = {
  text:   (name, required = false) => ({ name, type: 'text',   required }),
  num:    (name, required = false) => ({ name, type: 'number', required }),
  bool:   (name)                   => ({ name, type: 'bool',   required: false }),
  date:   (name)                   => ({ name, type: 'date',   required: false }),
  json:   (name)                   => ({ name, type: 'json',   required: false }),
  file:   (name, maxSelect = 1)    => ({ name, type: 'file',   required: false, maxSelect }),
  select: (name, values, required = false) =>
    ({ name, type: 'select', required, values, maxSelect: 1 }),
}

// ─── Definição das coleções (format v0.23) ────────────────────────────────────
const COLLECTIONS = [
  {
    name: 'restaurants', type: 'base',
    fields: [
      f.text('owner_id',             true),
      f.text('name',                 true),
      f.text('slug'),
      f.text('logo_url'),
      f.text('address'),
      f.text('mp_access_token'),
      f.text('mp_public_key'),
      f.text('mp_refresh_token'),
      f.text('mp_user_id'),
      f.text('printer_kitchen_host'),
      f.num('printer_kitchen_port'),
      f.text('printer_bar_host'),
      f.num('printer_bar_port'),
      f.text('whatsapp_contact'),
    ],
  },
  {
    name: 'working_hours', type: 'base',
    fields: [
      f.text('restaurant_id', true),
      f.num('day_of_week'),
      f.text('open_time'),
      f.text('close_time'),
      f.bool('is_open'),
    ],
  },
  {
    name: 'closed_dates', type: 'base',
    fields: [
      f.text('restaurant_id', true),
      f.text('date',          true),
      f.text('reason'),
    ],
  },
  {
    name: 'tables', type: 'base',
    fields: [
      f.text('restaurant_id', true),
      f.num('number',         true),
      f.num('capacity'),
      f.num('pos_x'),
      f.num('pos_y'),
      f.select('status', ['empty','reserved','occupied'], true),
      f.text('guest_name'),
      f.text('guest_phone'),
    ],
  },
  {
    name: 'table_sessions', type: 'base',
    fields: [
      f.text('restaurant_id', true),
      f.text('table_id',      true),
      f.text('guest_name'),
      f.text('guest_phone'),
      f.date('sat_at'),
      f.date('left_at'),
    ],
  },
  {
    name: 'menu_categories', type: 'base',
    fields: [
      f.text('restaurant_id', true),
      f.text('name',          true),
      f.text('slug'),
      f.num('display_order'),
      f.select('printer', ['kitchen','bar']),
    ],
  },
  {
    name: 'menu_items', type: 'base',
    fields: [
      f.text('restaurant_id', true),
      f.text('category_id',   true),
      f.text('name',          true),
      f.text('description'),
      f.num('price',          true),
      f.text('photo_url'),
      f.file('photo'),
      f.bool('available'),
      f.num('display_order'),
    ],
  },
  {
    name: 'cost_items', type: 'base',
    fields: [
      f.text('restaurant_id', true),
      f.text('menu_item_id',  true),
      f.text('ingredient',    true),
      f.text('quantity'),
      f.num('unit_cost'),
    ],
  },
  {
    name: 'orders', type: 'base',
    fields: [
      f.text('restaurant_id',  true),
      f.text('table_id'),
      f.text('customer_id'),
      f.text('session_id'),
      f.num('code'),
      f.select('status', ['open','preparing','served','closed','cancelled'], true),
      f.num('total'),
      f.select('payment_status', ['pending','paid','refunded']),
      f.text('delivery_name'),
      f.text('delivery_phone'),
      f.text('mp_payment_id'),
      f.text('placed_at'),
    ],
  },
  {
    name: 'order_items', type: 'base',
    fields: [
      f.text('restaurant_id'),
      f.text('order_id',     true),
      f.text('menu_item_id', true),
      f.num('quantity',      true),
      f.num('unit_price',    true),
      f.text('notes'),
      f.select('status', ['pending','preparing','ready','served']),
    ],
  },
  {
    name: 'order_sequences', type: 'base',
    fields: [
      f.text('restaurant_id', true),
      f.num('last_code'),
    ],
  },
  {
    name: 'payments', type: 'base',
    fields: [
      f.text('restaurant_id',  true),
      f.text('order_id'),
      f.text('reservation_id'),
      f.select('method', ['credit_card','debit_card','pix','cash'], true),
      f.num('amount',          true),
      f.select('status', ['pending','paid','refunded']),
      f.text('mercadopago_id'),
      f.num('installments'),
    ],
  },
  {
    name: 'print_jobs', type: 'base',
    fields: [
      f.text('restaurant_id', true),
      f.text('order_id'),
      f.select('printer', ['kitchen','bar'], true),
      f.json('items'),
      f.num('table_number'),
      f.text('guest_name'),
      f.num('order_code'),
      f.date('printed_at'),
    ],
  },
  {
    name: 'reservations', type: 'base',
    fields: [
      f.text('restaurant_id',  true),
      f.text('table_id'),
      f.text('customer_id'),
      f.text('date',           true),
      f.text('time',           true),
      f.num('guest_count'),
      f.select('status', ['pending','confirmed','cancelled','completed'], true),
      f.select('payment_status', ['unpaid','paid','refunded']),
      f.text('payment_id'),
      f.text('notes'),
    ],
  },
  {
    name: 'subscriptions', type: 'base',
    fields: [
      f.text('restaurant_id',     true),
      f.select('plan',   ['trial','basic','pro'],                     true),
      f.select('status', ['trial','active','suspended','cancelled'],  true),
      f.date('starts_at'),
      f.date('expires_at'),
      f.text('mp_preapproval_id'),
    ],
  },
]

// Campos extras a adicionar na coleção auth 'users' (que já existe)
const USERS_EXTRA_FIELDS = [
  f.text('name',          true),
  f.text('phone'),
  f.text('cpf'),
  f.select('role', ['manager','customer'], true),
  f.text('restaurant_id'),
]

// ─── API helper ───────────────────────────────────────────────────────────────
async function api(token, method, path, body) {
  const res = await fetch(PB + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    ...(body !== undefined && body !== null ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📦 COMI — Setup PocketBase v0.23`)
  console.log(`   ${PB}\n`)

  // 1. Autentica superuser
  const auth = await api(null, 'POST', '/api/collections/_superusers/auth-with-password', {
    identity: SU_MAIL, password: SU_PASS,
  })
  if (!auth.ok) { console.error('❌ Auth falhou:', auth.data.message); process.exit(1) }
  const T = auth.data.token
  console.log('✅ Autenticado\n')

  // 2. Atualiza coleção 'users' com campos extras
  console.log('── Atualizando users ─────────────────────────────')
  const usersCol = await api(T, 'GET', '/api/collections/users', null)
  if (usersCol.ok) {
    const sysFields = (usersCol.data.fields ?? []).filter(fld => fld.system)
    const existingNames = new Set((usersCol.data.fields ?? []).map(fld => fld.name))
    const toAdd = USERS_EXTRA_FIELDS.filter(fld => !existingNames.has(fld.name))
    const allFields = [...(usersCol.data.fields ?? []), ...toAdd]
    const r = await api(T, 'PATCH', '/api/collections/users', { fields: allFields })
    if (r.ok) console.log(`  ✓ users (+${toAdd.length} campos)`)
    else { console.error('  ✗ users:', JSON.stringify(r.data)); process.exit(1) }
  }

  // 3. Apaga coleções antigas (vazias) e recria com fields corretos
  console.log('\n── Recriando coleções ────────────────────────────')
  for (const col of COLLECTIONS) {
    // Apaga se existir
    const del = await api(T, 'DELETE', `/api/collections/${col.name}`, null)
    if (del.ok) console.log(`  🗑  ${col.name} (apagada)`)

    // Recria com formato v0.23
    const create = await api(T, 'POST', '/api/collections', {
      name:        col.name,
      type:        col.type,
      fields:      col.fields,
      listRule:   '',
      viewRule:   '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
    })
    if (create.ok) console.log(`  ✓ ${col.name}`)
    else { console.error(`  ✗ ${col.name}: ${JSON.stringify(create.data)}`); process.exit(1) }
  }

  // 4. Seed: usuário, restaurante, horários, categorias
  console.log('\n── Seed de dados ─────────────────────────────────')

  // Cria/atualiza usuário manager
  let userId, restaurantId

  // Verifica se usuário já existe
  const listUsers = await api(T, 'GET', `/api/collections/users/records?filter=(email="${MGR_EMAIL}")`, null)
  const existingUser = listUsers.data?.items?.[0]

  if (existingUser) {
    userId = existingUser.id
    // Atualiza campos
    await api(T, 'PATCH', `/api/collections/users/records/${userId}`, {
      name: MGR_NAME, role: 'manager',
    })
    console.log(`  — Usuário ${MGR_EMAIL} já existe (id: ${userId}) — atualizado`)
  } else {
    const u = await api(T, 'POST', '/api/collections/users/records', {
      email:           MGR_EMAIL,
      password:        MGR_PASS,
      passwordConfirm: MGR_PASS,
      name:            MGR_NAME,
      phone:           '',
      cpf:             '',
      role:            'manager',
    })
    if (!u.ok) { console.error('  ✗ Usuário:', JSON.stringify(u.data)); process.exit(1) }
    userId = u.data.id
    console.log(`  ✓ Usuário criado: ${MGR_EMAIL} (id: ${userId})`)
  }

  // Cria restaurante
  const r = await api(T, 'POST', '/api/collections/restaurants/records', {
    owner_id: userId,
    name:     REST_NAME,
    slug:     REST_SLUG,
  })
  if (!r.ok) { console.error('  ✗ Restaurante:', JSON.stringify(r.data)); process.exit(1) }
  restaurantId = r.data.id
  console.log(`  ✓ Restaurante "${REST_NAME}" slug="${REST_SLUG}" (id: ${restaurantId})`)

  // Vincula restaurant_id ao usuário
  await api(T, 'PATCH', `/api/collections/users/records/${userId}`, { restaurant_id: restaurantId })
  console.log(`  ✓ restaurant_id vinculado`)

  // Horários padrão (0=dom … 6=sab)
  for (let d = 0; d <= 6; d++) {
    await api(T, 'POST', '/api/collections/working_hours/records', {
      restaurant_id: restaurantId, day_of_week: d,
      open_time: '11:00', close_time: '23:00', is_open: true,
    })
  }
  console.log(`  ✓ 7 horários (11h–23h, todos os dias)`)

  // Categorias
  const cats = [
    { name: 'Porções',    slug: `porcoes-${restaurantId.slice(0,6)}`,    display_order: 1 },
    { name: 'Lanches',    slug: `lanches-${restaurantId.slice(0,6)}`,    display_order: 2 },
    { name: 'Bebidas',    slug: `bebidas-${restaurantId.slice(0,6)}`,    display_order: 3 },
    { name: 'Sobremesas', slug: `sobremesas-${restaurantId.slice(0,6)}`, display_order: 4 },
  ]
  for (const cat of cats) {
    await api(T, 'POST', '/api/collections/menu_categories/records', { restaurant_id: restaurantId, ...cat })
  }
  console.log(`  ✓ 4 categorias padrão`)

  // Subscription trial
  const now = new Date(); const exp = new Date(); exp.setDate(exp.getDate() + 30)
  await api(T, 'POST', '/api/collections/subscriptions/records', {
    restaurant_id: restaurantId, plan: 'trial', status: 'trial',
    starts_at: now.toISOString(), expires_at: exp.toISOString(),
  })
  console.log(`  ✓ Subscription trial (30 dias)`)

  console.log(`
🎉 Setup completo!

   Login no app
   ─────────────────────────────
   URL:   https://comi.awplabs.com.br/login
   Email: ${MGR_EMAIL}
   Senha: ${MGR_PASS}

   Delivery
   ─────────────────────────────
   /delivery/${REST_SLUG}
`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
