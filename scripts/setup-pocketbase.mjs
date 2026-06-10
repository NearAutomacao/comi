#!/usr/bin/env node
/**
 * Setup completo do PocketBase para COMI.
 * Cria todas as coleções e dados iniciais.
 *
 * Uso:
 *   node scripts/setup-pocketbase.mjs --url URL --email EMAIL --password SENHA
 *   node scripts/setup-pocketbase.mjs --url URL --email EMAIL --password SENHA --seed
 */

const args = process.argv.slice(2)
const get  = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }
const flag = f => args.includes(f)

const PB_URL  = get('--url')      ?? 'http://127.0.0.1:8090'
const email   = get('--email')
const password= get('--password')
const doSeed  = flag('--seed')

if (!email || !password) {
  console.error('Uso: node scripts/setup-pocketbase.mjs --url URL --email EMAIL --password SENHA [--seed]')
  process.exit(1)
}

// ─── Definição das coleções ────────────────────────────────────────────────────

const COLLECTIONS = [
  {
    name: 'users',
    type: 'auth',
    schema: [
      { name: 'name',          type: 'text',   required: true  },
      { name: 'phone',         type: 'text',   required: false },
      { name: 'cpf',           type: 'text',   required: false },
      { name: 'role',          type: 'select', required: true,  options: { maxSelect: 1, values: ['manager','customer'] } },
      { name: 'restaurant_id', type: 'text',   required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'restaurants',
    type: 'base',
    schema: [
      { name: 'owner_id',             type: 'text',   required: true  },
      { name: 'name',                 type: 'text',   required: true  },
      { name: 'slug',                 type: 'text',   required: false },
      { name: 'logo_url',             type: 'text',   required: false },
      { name: 'address',              type: 'text',   required: false },
      { name: 'mp_access_token',      type: 'text',   required: false },
      { name: 'mp_public_key',        type: 'text',   required: false },
      { name: 'mp_refresh_token',     type: 'text',   required: false },
      { name: 'mp_user_id',           type: 'text',   required: false },
      { name: 'printer_kitchen_host', type: 'text',   required: false },
      { name: 'printer_kitchen_port', type: 'number', required: false },
      { name: 'printer_bar_host',     type: 'text',   required: false },
      { name: 'printer_bar_port',     type: 'number', required: false },
      { name: 'whatsapp_contact',     type: 'text',   required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'working_hours',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text',   required: true  },
      { name: 'day_of_week',   type: 'number', required: false },
      { name: 'open_time',     type: 'text',   required: false },
      { name: 'close_time',    type: 'text',   required: false },
      { name: 'is_open',       type: 'bool',   required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'closed_dates',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text', required: true  },
      { name: 'date',          type: 'text', required: true  },
      { name: 'reason',        type: 'text', required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'tables',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text',   required: true  },
      { name: 'number',        type: 'number', required: true  },
      { name: 'capacity',      type: 'number', required: false },
      { name: 'pos_x',         type: 'number', required: false },
      { name: 'pos_y',         type: 'number', required: false },
      { name: 'status',        type: 'select', required: true,  options: { maxSelect: 1, values: ['empty','reserved','occupied'] } },
      { name: 'guest_name',    type: 'text',   required: false },
      { name: 'guest_phone',   type: 'text',   required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'table_sessions',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text', required: true  },
      { name: 'table_id',      type: 'text', required: true  },
      { name: 'guest_name',    type: 'text', required: false },
      { name: 'guest_phone',   type: 'text', required: false },
      { name: 'sat_at',        type: 'date', required: false },
      { name: 'left_at',       type: 'date', required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'menu_categories',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text',   required: true  },
      { name: 'name',          type: 'text',   required: true  },
      { name: 'slug',          type: 'text',   required: false },
      { name: 'display_order', type: 'number', required: false },
      { name: 'printer',       type: 'select', required: false, options: { maxSelect: 1, values: ['kitchen','bar'] } },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'menu_items',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text',   required: true  },
      { name: 'category_id',   type: 'text',   required: true  },
      { name: 'name',          type: 'text',   required: true  },
      { name: 'description',   type: 'text',   required: false },
      { name: 'price',         type: 'number', required: true  },
      { name: 'photo_url',     type: 'text',   required: false },
      { name: 'photo',         type: 'file',   required: false, options: { maxSelect: 1, maxSize: 5242880 } },
      { name: 'available',     type: 'bool',   required: false },
      { name: 'display_order', type: 'number', required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'cost_items',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text',   required: true  },
      { name: 'menu_item_id',  type: 'text',   required: true  },
      { name: 'ingredient',    type: 'text',   required: true  },
      { name: 'quantity',      type: 'text',   required: false },
      { name: 'unit_cost',     type: 'number', required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'orders',
    type: 'base',
    schema: [
      { name: 'restaurant_id',  type: 'text',   required: true  },
      { name: 'table_id',       type: 'text',   required: false },
      { name: 'customer_id',    type: 'text',   required: false },
      { name: 'session_id',     type: 'text',   required: false },
      { name: 'code',           type: 'number', required: false },
      { name: 'status',         type: 'select', required: true,  options: { maxSelect: 1, values: ['open','preparing','served','closed','cancelled'] } },
      { name: 'total',          type: 'number', required: false },
      { name: 'payment_status', type: 'select', required: false, options: { maxSelect: 1, values: ['pending','paid','refunded'] } },
      { name: 'delivery_name',  type: 'text',   required: false },
      { name: 'delivery_phone', type: 'text',   required: false },
      { name: 'mp_payment_id',  type: 'text',   required: false },
      { name: 'placed_at',      type: 'text',   required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'order_items',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text',   required: false },
      { name: 'order_id',      type: 'text',   required: true  },
      { name: 'menu_item_id',  type: 'text',   required: true  },
      { name: 'quantity',      type: 'number', required: true  },
      { name: 'unit_price',    type: 'number', required: true  },
      { name: 'notes',         type: 'text',   required: false },
      { name: 'status',        type: 'select', required: false, options: { maxSelect: 1, values: ['pending','preparing','ready','served'] } },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'order_sequences',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text',   required: true  },
      { name: 'last_code',     type: 'number', required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'payments',
    type: 'base',
    schema: [
      { name: 'restaurant_id',  type: 'text',   required: true  },
      { name: 'order_id',       type: 'text',   required: false },
      { name: 'reservation_id', type: 'text',   required: false },
      { name: 'method',         type: 'select', required: true,  options: { maxSelect: 1, values: ['credit_card','debit_card','pix','cash'] } },
      { name: 'amount',         type: 'number', required: true  },
      { name: 'status',         type: 'select', required: false, options: { maxSelect: 1, values: ['pending','paid','refunded'] } },
      { name: 'mercadopago_id', type: 'text',   required: false },
      { name: 'installments',   type: 'number', required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'print_jobs',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text',   required: true  },
      { name: 'order_id',      type: 'text',   required: false },
      { name: 'printer',       type: 'select', required: true,  options: { maxSelect: 1, values: ['kitchen','bar'] } },
      { name: 'items',         type: 'json',   required: false, options: { maxSize: 2000000 } },
      { name: 'table_number',  type: 'number', required: false },
      { name: 'guest_name',    type: 'text',   required: false },
      { name: 'order_code',    type: 'number', required: false },
      { name: 'printed_at',    type: 'date',   required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'reservations',
    type: 'base',
    schema: [
      { name: 'restaurant_id',  type: 'text',   required: true  },
      { name: 'table_id',       type: 'text',   required: false },
      { name: 'customer_id',    type: 'text',   required: false },
      { name: 'date',           type: 'text',   required: true  },
      { name: 'time',           type: 'text',   required: true  },
      { name: 'guest_count',    type: 'number', required: false },
      { name: 'status',         type: 'select', required: true,  options: { maxSelect: 1, values: ['pending','confirmed','cancelled','completed'] } },
      { name: 'payment_status', type: 'select', required: false, options: { maxSelect: 1, values: ['unpaid','paid','refunded'] } },
      { name: 'payment_id',     type: 'text',   required: false },
      { name: 'notes',          type: 'text',   required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
  {
    name: 'subscriptions',
    type: 'base',
    schema: [
      { name: 'restaurant_id',     type: 'text',   required: true  },
      { name: 'plan',              type: 'select', required: true,  options: { maxSelect: 1, values: ['trial','basic','pro'] } },
      { name: 'status',            type: 'select', required: true,  options: { maxSelect: 1, values: ['trial','active','suspended','cancelled'] } },
      { name: 'starts_at',         type: 'date',   required: false },
      { name: 'expires_at',        type: 'date',   required: false },
      { name: 'mp_preapproval_id', type: 'text',   required: false },
    ],
    listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function api(token, method, path, body) {
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📦 COMI — Setup PocketBase`)
  console.log(`   URL: ${PB_URL}`)
  console.log(`   Usuário: ${email}\n`)

  // 1. Autenticar como superusuário
  const authRes = await api(null, 'POST', '/api/collections/_superusers/auth-with-password', {
    identity: email, password,
  })
  if (!authRes.ok) {
    console.error('❌ Autenticação falhou:', authRes.data?.message)
    process.exit(1)
  }
  const token = authRes.data.token
  console.log('✅ Autenticado\n')

  // 2. Criar coleções
  console.log('── Criando coleções ─────────────────────────────')
  let created = 0, skipped = 0, errors = 0

  for (const col of COLLECTIONS) {
    if (col.name === 'users') {
      // users já existe como auth collection padrão — adiciona campos faltantes
      const existing = await api(token, 'GET', '/api/collections/users', null)
      if (!existing.ok) {
        // Não existe — cria normalmente
        const r = await api(token, 'POST', '/api/collections', col)
        if (r.ok) { console.log(`  ✓ ${col.name} (criado)`); created++ }
        else { console.error(`  ✗ ${col.name}: ${JSON.stringify(r.data)}`); errors++ }
        continue
      }

      const existingNames = new Set((existing.data.schema ?? []).map(f => f.name))
      const newFields = col.schema.filter(f => !existingNames.has(f.name))
      if (newFields.length === 0) {
        console.log(`  — ${col.name} (já configurado)`)
        skipped++
        continue
      }
      const merged = [...(existing.data.schema ?? []), ...newFields]
      const r = await api(token, 'PATCH', '/api/collections/users', { schema: merged })
      if (r.ok) { console.log(`  ✓ ${col.name} (+${newFields.length} campos)`); created++ }
      else { console.error(`  ✗ ${col.name}: ${JSON.stringify(r.data)}`); errors++ }
      continue
    }

    const r = await api(token, 'POST', '/api/collections', col)
    if (r.ok) {
      console.log(`  ✓ ${col.name}`)
      created++
    } else if (r.data?.data?.name?.code === 'validation_collection_name_exists') {
      console.log(`  — ${col.name} (já existe)`)
      skipped++
    } else {
      console.error(`  ✗ ${col.name}: ${JSON.stringify(r.data)}`)
      errors++
    }
  }

  console.log(`\n   ${created} criadas | ${skipped} já existiam | ${errors} erros\n`)

  if (errors > 0) {
    console.error('❌ Houve erros na criação das coleções.')
    process.exit(1)
  }

  // 3. Seed de dados iniciais
  if (doSeed) {
    console.log('── Criando dados iniciais ───────────────────────')

    const MANAGER_EMAIL    = 'contato@nearautomacao.com'
    const MANAGER_PASSWORD = 'Cvale@2018'
    const MANAGER_NAME     = 'Luan'
    const RESTAURANT_NAME  = 'Restaurante Luan'
    const RESTAURANT_SLUG  = 'restaurante-luan'

    // Cria usuário manager
    let userId, restaurantId

    const userRes = await api(token, 'POST', '/api/collections/users/records', {
      email: MANAGER_EMAIL,
      password: MANAGER_PASSWORD,
      passwordConfirm: MANAGER_PASSWORD,
      name: MANAGER_NAME,
      phone: '',
      cpf: '',
      role: 'manager',
    })

    if (userRes.ok) {
      userId = userRes.data.id
      console.log(`  ✓ Usuário criado: ${MANAGER_EMAIL} (id: ${userId})`)
    } else if (userRes.data?.data?.email?.code === 'validation_not_unique') {
      // Busca o usuário existente
      const listRes = await api(token, 'GET', `/api/collections/users/records?filter=(email="${MANAGER_EMAIL}")`, null)
      userId = listRes.data?.items?.[0]?.id
      console.log(`  — Usuário já existe (id: ${userId})`)
    } else {
      console.error(`  ✗ Usuário: ${JSON.stringify(userRes.data)}`)
    }

    // Cria restaurante
    if (userId) {
      const restRes = await api(token, 'POST', '/api/collections/restaurants/records', {
        owner_id: userId,
        name: RESTAURANT_NAME,
        slug: RESTAURANT_SLUG,
      })
      if (restRes.ok) {
        restaurantId = restRes.data.id
        console.log(`  ✓ Restaurante: "${RESTAURANT_NAME}" slug="${RESTAURANT_SLUG}" (id: ${restaurantId})`)
      } else {
        console.error(`  ✗ Restaurante: ${JSON.stringify(restRes.data)}`)
      }
    }

    // Vincula restaurant_id ao usuário
    if (userId && restaurantId) {
      await api(token, 'PATCH', `/api/collections/users/records/${userId}`, { restaurant_id: restaurantId })
      console.log(`  ✓ restaurant_id vinculado ao usuário`)
    }

    // Cria horários padrão (7 dias, 11h–23h abertos)
    if (restaurantId) {
      for (let day = 0; day <= 6; day++) {
        await api(token, 'POST', '/api/collections/working_hours/records', {
          restaurant_id: restaurantId,
          day_of_week: day,
          open_time: '11:00',
          close_time: '23:00',
          is_open: true,
        })
      }
      console.log(`  ✓ 7 horários de funcionamento criados (11h–23h, todos os dias)`)

      // Cria categorias padrão
      const cats = [
        { name: 'Porções',    slug: `porcoes-${restaurantId.slice(0,6)}`,    display_order: 1 },
        { name: 'Lanches',    slug: `lanches-${restaurantId.slice(0,6)}`,    display_order: 2 },
        { name: 'Bebidas',    slug: `bebidas-${restaurantId.slice(0,6)}`,    display_order: 3 },
        { name: 'Sobremesas', slug: `sobremesas-${restaurantId.slice(0,6)}`, display_order: 4 },
      ]
      for (const cat of cats) {
        await api(token, 'POST', '/api/collections/menu_categories/records', {
          restaurant_id: restaurantId, ...cat,
        })
      }
      console.log(`  ✓ 4 categorias padrão criadas`)

      // Cria subscription trial (30 dias)
      const now     = new Date()
      const expires = new Date(); expires.setDate(expires.getDate() + 30)
      await api(token, 'POST', '/api/collections/subscriptions/records', {
        restaurant_id: restaurantId,
        plan: 'trial',
        status: 'trial',
        starts_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })
      console.log(`  ✓ Subscription trial criada (30 dias)`)
    }

    console.log(`\n✅ Seed concluído!`)
    console.log(`\n   Login no app:`)
    console.log(`   Email:    ${MANAGER_EMAIL}`)
    console.log(`   Senha:    ${MANAGER_PASSWORD}`)
    console.log(`   Link delivery: /delivery/${RESTAURANT_SLUG}`)
  }

  console.log('\n🎉 Setup completo!\n')
}

main().catch(err => {
  console.error('\n❌ Erro inesperado:', err.message)
  process.exit(1)
})
