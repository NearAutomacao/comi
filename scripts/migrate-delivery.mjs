#!/usr/bin/env node
/**
 * Migração: adiciona campos de delivery à collection orders.
 *
 * Uso:
 *   node scripts/migrate-delivery.mjs --email SEU_EMAIL --password SUA_SENHA
 *
 * Opcional:
 *   --url https://pocketbase-production-3f40.up.railway.app
 */

const args = process.argv.slice(2)
const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null }

const PB_URL = get('--url') ?? 'http://127.0.0.1:8090'
const email = get('--email')
const password = get('--password')

if (!email || !password) {
  console.error('Uso: node scripts/migrate-delivery.mjs --email SEU_EMAIL --password SUA_SENHA')
  process.exit(1)
}

async function main() {
  console.log(`\nConectando em ${PB_URL}...\n`)

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
  console.log('Autenticado.\n')

  // Busca a collection orders atual
  const colRes = await fetch(`${PB_URL}/api/collections/orders`, {
    headers: { Authorization: token },
  })

  if (!colRes.ok) {
    console.error('Erro ao buscar collection orders:', await colRes.text())
    process.exit(1)
  }

  const col = await colRes.json()
  const existingFields = (col.schema ?? []).map(f => f.name)

  const newFields = []

  if (!existingFields.includes('delivery_name')) {
    newFields.push({ name: 'delivery_name', type: 'text', required: false })
    console.log('  + delivery_name')
  } else {
    console.log('  — delivery_name (já existe)')
  }

  if (!existingFields.includes('delivery_phone')) {
    newFields.push({ name: 'delivery_phone', type: 'text', required: false })
    console.log('  + delivery_phone')
  } else {
    console.log('  — delivery_phone (já existe)')
  }

  if (newFields.length === 0) {
    console.log('\nNenhum campo novo para adicionar. Migração já aplicada.\n')
    return
  }

  const mergedSchema = [...(col.schema ?? []), ...newFields]

  const patchRes = await fetch(`${PB_URL}/api/collections/orders`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ schema: mergedSchema }),
  })

  if (!patchRes.ok) {
    const err = await patchRes.json()
    console.error('Erro ao atualizar collection:', JSON.stringify(err))
    process.exit(1)
  }

  console.log('\nMigração aplicada com sucesso!\n')
}

main().catch(err => {
  console.error('\nErro inesperado:', err.message)
  process.exit(1)
})
