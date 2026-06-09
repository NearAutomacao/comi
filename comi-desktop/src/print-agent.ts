// @ts-nocheck
import PocketBase from 'pocketbase'
import * as net from 'net'
import log from 'electron-log'
import { PB_URL } from './env'

let pollTimer = null
let currentRestaurantId = null
let printerConfig = { kitchenHost: '', kitchenPort: 9100, barHost: '', barPort: 9100 }

// ─── ESC/POS ──────────────────────────────────────────────────────────────────

function esc(...bytes) { return Buffer.from(bytes) }
function text(s) { return Buffer.from(s, 'latin1') }

function buildTicket(job) {
  const parts = []
  const br = () => parts.push(text('\n'))

  parts.push(esc(0x1b, 0x40))
  parts.push(esc(0x1b, 0x61, 0x01))
  parts.push(esc(0x1b, 0x45, 0x01))
  parts.push(text(`MESA ${job.table_number ?? '?'}`)); br()
  parts.push(esc(0x1b, 0x45, 0x00))

  if (job.guest_name) { parts.push(text(job.guest_name)); br() }

  if (job.order_code) {
    parts.push(esc(0x1b, 0x45, 0x01))
    parts.push(text(`#${String(job.order_code).padStart(4, '0')}`))
    parts.push(esc(0x1b, 0x45, 0x00)); br()
  }

  parts.push(text(`-- ${job.printer === 'kitchen' ? 'COZINHA' : 'BAR'} --`)); br()
  parts.push(esc(0x1b, 0x61, 0x00))
  parts.push(text('--------------------------------')); br()

  for (const item of job.items) {
    const line = `${item.quantity}x ${item.name}`
    const price = `R$${(item.unit_price * item.quantity).toFixed(2)}`
    parts.push(text(line + ' '.repeat(Math.max(1, 32 - line.length - price.length)) + price)); br()
    if (item.notes) { parts.push(text(`   > ${item.notes}`)); br() }
  }

  parts.push(text('--------------------------------')); br(); br(); br()
  parts.push(esc(0x1d, 0x56, 0x42, 0x10))
  return Buffer.concat(parts)
}

async function sendToPrinter(host, port, data) {
  return new Promise((resolve, reject) => {
    if (!host) {
      log.warn('[printer] Host não configurado — modo teste')
      log.info('[printer] Ticket:\n' + data.toString('latin1'))
      resolve()
      return
    }
    const socket = net.createConnection({ host, port }, () => {
      socket.write(data, () => { socket.destroy(); resolve() })
    })
    socket.setTimeout(5000)
    socket.on('timeout', () => { socket.destroy(); reject(new Error(`Timeout ${host}:${port}`)) })
    socket.on('error', reject)
  })
}

async function processJob(pb, job) {
  log.info(`[print-agent] Processando job ${job.id} → ${job.printer}`)
  const host = job.printer === 'kitchen' ? printerConfig.kitchenHost : printerConfig.barHost
  const port = job.printer === 'kitchen' ? printerConfig.kitchenPort : printerConfig.barPort
  await sendToPrinter(host, port, buildTicket(job))
  await pb.collection('print_jobs').update(job.id, { printed_at: new Date().toISOString() })
  log.info(`[print-agent] Job ${job.id} impresso`)
}

async function processPendingJobs(pb, restaurantId) {
  try {
    const { items: jobs } = await pb.collection('print_jobs').getList(1, 50, {
      filter: `restaurant_id = "${restaurantId}" && printed_at = null`,
      sort: 'created',
    })
    if (!jobs.length) return
    log.info(`[print-agent] ${jobs.length} job(s) pendente(s)`)
    for (const job of jobs) {
      await processJob(pb, job).catch(err =>
        log.error(`[print-agent] Erro job ${job.id}:`, err)
      )
    }
  } catch (err) {
    log.warn('[print-agent] Erro ao buscar jobs:', err?.message)
  }
}

async function loadPrinterConfig(pb, restaurantId) {
  try {
    const data = await pb.collection('restaurants').getOne(restaurantId)
    printerConfig = {
      kitchenHost: data.printer_kitchen_host ?? '',
      kitchenPort: data.printer_kitchen_port ?? 9100,
      barHost: data.printer_bar_host ?? '',
      barPort: data.printer_bar_port ?? 9100,
    }
    log.info('[print-agent] Config:', printerConfig)
  } catch (err) {
    log.warn('[print-agent] Erro ao carregar config de impressora:', err?.message)
  }
}

export function stopPrintAgent() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  currentRestaurantId = null
  log.info('[print-agent] Parado')
}

export async function startPrintAgent(restaurantId) {
  if (currentRestaurantId === restaurantId) return
  stopPrintAgent()
  currentRestaurantId = restaurantId
  log.info('[print-agent] Iniciando para', restaurantId)

  const pb = new PocketBase(PB_URL)
  pb.autoCancellation(false)

  await loadPrinterConfig(pb, restaurantId)

  // Processa jobs pendentes imediatamente na inicialização
  await processPendingJobs(pb, restaurantId)

  // Polling a cada 3 segundos para novos jobs não impressos
  pollTimer = setInterval(async () => {
    if (currentRestaurantId !== restaurantId) return
    await processPendingJobs(pb, restaurantId)
  }, 3000)
}

export function updatePrinterConfig(config) {
  printerConfig = { ...printerConfig, ...config }
  log.info('[print-agent] Config atualizada:', printerConfig)
}
