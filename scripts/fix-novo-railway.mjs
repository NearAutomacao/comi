#!/usr/bin/env node
/**
 * Script de correção pós-migração para o novo Railway.
 * Limpa duplicatas e configura estado correto do PocketBase.
 *
 * Uso: node scripts/fix-novo-railway.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)

const PB_URL = env.PB_URL ?? 'http://127.0.0.1:8090'
const EMAIL  = 'contato@nearautomacao.com'
const PASS   = 'Cvale@2018'

async function api(token, method, path, body) {
  const r = await fetch(`${PB_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await r.json().catch(() => null)
  return { ok: r.ok || r.status === 204, status: r.status, data }
}

async function deleteAll(token, collection, filter) {
  let deleted = 0
  let page = 1
  while (true) {
    const r = await api(token, 'GET', `/api/collections/${collection}/records?page=${page}&perPage=50${filter ? `&filter=${encodeURIComponent(filter)}` : ''}`, null)
    const items = r.data?.items ?? []
    if (items.length === 0) break
    for (const item of items) {
      const d = await api(token, 'DELETE', `/api/collections/${collection}/records/${item.id}`, null)
      if (d.ok) deleted++
    }
    if (items.length < 50) break
    page++
  }
  return deleted
}

async function main() {
  console.log(`\n🔧 Fix pós-migração Railway — ${PB_URL}\n`)

  // Autenticar
  const authRes = await api(null, 'POST', '/api/collections/_superusers/auth-with-password', {
    identity: EMAIL, password: PASS,
  })
  if (!authRes.ok) { console.error('❌ Auth falhou:', authRes.data?.message); process.exit(1) }
  const token = authRes.data.token
  console.log('✓ Autenticado\n')

  const RID = '31avya0se7g7oe6'
  console.log(`✓ Restaurante ID: ${RID}\n`)

  // 1. Deletar todos os menu_items (todos são dados de teste)
  console.log('── Limpando menu_items ─────────────────────────────')
  const delItems = await deleteAll(token, 'menu_items', `restaurant_id = "${RID}"`)
  console.log(`  ✓ ${delItems} item(s) deletado(s)`)

  // 2. Categorias: manter as 4 corretas, deletar as duplicatas
  console.log('\n── Limpando categorias duplicadas ──────────────────')
  // "POrcao" (vti5mh98qtbgzzh) e "bebida" (owx61krbj705b4e) são duplicatas criadas manualmente
  const dupCatIds = ['vti5mh98qtbgzzh', 'owx61krbj705b4e']
  let delCats = 0
  for (const id of dupCatIds) {
    const r = await api(token, 'DELETE', `/api/collections/menu_categories/records/${id}`, null)
    if (r.ok) { delCats++; console.log(`  ✓ Deletado categoria id=${id}`) }
    else console.warn(`  ✗ Falha ao deletar ${id}: ${r.status}`)
  }
  console.log(`  ✓ ${delCats} categoria(s) duplicada(s) removida(s)`)

  // 3. working_hours: manter apenas 7 (um por dia), deletar excedentes
  console.log('\n── Corrigindo working_hours duplicados ─────────────')
  const whRes = await api(token, 'GET', `/api/collections/working_hours/records?page=1&perPage=100&filter=(restaurant_id%3D"${RID}")&sort=day_of_week`, null)
  const allWH = whRes.data?.items ?? []
  console.log(`  Total atual: ${allWH.length}`)

  // Agrupa por day_of_week e mantém o primeiro de cada grupo
  const byDay = {}
  const whToDelete = []
  for (const wh of allWH) {
    const d = wh.day_of_week
    if (!byDay[d]) { byDay[d] = wh }
    else { whToDelete.push(wh) }
  }

  let delWH = 0
  for (const wh of whToDelete) {
    const r = await api(token, 'DELETE', `/api/collections/working_hours/records/${wh.id}`, null)
    if (r.ok) delWH++
  }
  // Verificar se todos os 7 dias existem; criar os que faltam
  let createdWH = 0
  for (let day = 0; day <= 6; day++) {
    if (!byDay[day]) {
      const r = await api(token, 'POST', '/api/collections/working_hours/records', {
        restaurant_id: RID, day_of_week: day,
        open_time: '11:00', close_time: '23:00', is_open: true,
      })
      if (r.ok) createdWH++
    }
  }
  console.log(`  ✓ ${delWH} duplicado(s) removido(s)${createdWH > 0 ? `, ${createdWH} dia(s) criado(s)` : ''}`)

  // 4. Mesas — já criadas pelo run anterior
  console.log('\n── Verificando mesas ───────────────────────────────')
  const tabRes = await api(token, 'GET', `/api/collections/tables/records?page=1&perPage=1&filter=(restaurant_id="${RID}")`, null)
  console.log(`  ✓ ${tabRes.data?.totalItems ?? 0} mesa(s) ativas`)

  // 5. Estado final
  const fc = await api(token, 'GET', `/api/collections/menu_categories/records?page=1&perPage=100&filter=(restaurant_id="${RID}")`, null)
  const ft = await api(token, 'GET', `/api/collections/tables/records?page=1&perPage=1&filter=(restaurant_id="${RID}")`, null)
  const fwh = await api(token, 'GET', `/api/collections/working_hours/records?page=1&perPage=1&filter=(restaurant_id="${RID}")`, null)

  console.log('\n── Estado final ────────────────────────────────────')
  console.log(`  Mesas:             ${ft.data?.totalItems ?? '?'}`)
  console.log(`  Categorias:        ${fc.data?.totalItems ?? '?'} — ${fc.data?.items?.map(c => `"${c.name}"`).join(', ')}`)
  console.log(`  Itens no cardápio: 0 (limpos — recadastre pelo admin)`)
  console.log(`  Horários:          ${fwh.data?.totalItems ?? '?'} dias configurados`)
  console.log('\n🎉 Correção concluída!')
  console.log('\n📋 Próximos passos:')
  console.log('   1. Acesse /admin/cardapio para recadastrar itens do cardápio')
  console.log('   2. Acesse /admin/mesas para organizar o mapa de mesas')
  console.log('   3. Acesse /admin/configuracoes para ajustar horários se necessário\n')
}

main().catch(err => {
  console.error('\n❌ Erro inesperado:', err.message)
  process.exit(1)
})
