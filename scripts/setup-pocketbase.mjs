#!/usr/bin/env node
/**
 * Script de setup do PocketBase para COMI.
 * Cria todas as coleções necessárias usando credenciais de admin.
 *
 * Uso:
 *   node scripts/setup-pocketbase.mjs --email SEU_EMAIL --password SUA_SENHA
 *
 * Opcional:
 *   --url http://127.0.0.1:8090  (padrão)
 */

const args = process.argv.slice(2)
const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null }

const PB_URL = get('--url') ?? 'http://127.0.0.1:8090'
const email = get('--email')
const password = get('--password')

if (!email || !password) {
  console.error('Uso: node scripts/setup-pocketbase.mjs --email SEU_EMAIL --password SUA_SENHA')
  process.exit(1)
}

// ─── Coleções ─────────────────────────────────────────────────────────────────

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
      { name: 'owner_id',              type: 'text',   required: true  },
      { name: 'name',                  type: 'text',   required: true  },
      { name: 'slug',                  type: 'text',   required: false },
      { name: 'logo_url',              type: 'text',   required: false },
      { name: 'address',               type: 'text',   required: false },
      { name: 'mp_access_token',       type: 'text',   required: false },
      { name: 'mp_public_key',         type: 'text',   required: false },
      { name: 'mp_refresh_token',      type: 'text',   required: false },
      { name: 'mp_user_id',            type: 'text',   required: false },
      { name: 'printer_kitchen_host',  type: 'text',   required: false },
      { name: 'printer_kitchen_port',  type: 'number', required: false },
      { name: 'printer_bar_host',      type: 'text',   required: false },
      { name: 'printer_bar_port',      type: 'number', required: false },
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
    name: 'order_sequences',
    type: 'base',
    schema: [
      { name: 'restaurant_id', type: 'text',   required: true  },
      { name: 'last_code',     type: 'number', required: false },
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nConectando em ${PB_URL} como ${email}...\n`)

  // Autentica
  const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  })

  if (!authRes.ok) {
    const err = await authRes.json()
    console.error('Falha na autenticação:', err.message)
    process.exit(1)
  }

  const { token } = await authRes.json()
  console.log('Autenticado com sucesso.\n')

  // Cria cada coleção (users usa PATCH pois já existe por padrão)
  let created = 0, skipped = 0, errors = 0

  for (const col of COLLECTIONS) {
    let res

    if (col.name === 'users') {
      // users já existe no PocketBase — atualiza via PATCH preservando campos avatar/name
      const existing = await fetch(`${PB_URL}/api/collections/users`, {
        headers: { 'Authorization': token },
      }).then(r => r.json())

      const existingFieldNames = (existing.schema ?? []).map(f => f.name)
      const newFields = col.schema.filter(f => !existingFieldNames.includes(f.name))
      const mergedSchema = [...(existing.schema ?? []), ...newFields]

      res = await fetch(`${PB_URL}/api/collections/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ schema: mergedSchema }),
      })
    } else {
      res = await fetch(`${PB_URL}/api/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify(col),
      })
    }

    if (res.ok) {
      console.log(`  ✓ ${col.name}`)
      created++
    } else {
      const err = await res.json()
      if (err?.data?.name?.code === 'validation_collection_name_exists') {
        console.log(`  — ${col.name} (já existe)`)
        skipped++
      } else {
        console.error(`  ✗ ${col.name}: ${JSON.stringify(err)}`)
        errors++
      }
    }
  }

  console.log(`\nConcluído: ${created} criadas, ${skipped} já existiam, ${errors} erros.\n`)

  if (errors > 0) process.exit(1)
}

main().catch(err => {
  console.error('\nErro inesperado:', err.message)
  process.exit(1)
})
