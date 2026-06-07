import { createClient, RealtimeChannel } from '@supabase/supabase-js'
import * as net from 'net'
import log from 'electron-log'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

interface PrintJobItem {
  name: string
  quantity: number
  unit_price: number
  notes: string | null
}

interface PrintJob {
  id: string
  restaurant_id: string
  printer: 'kitchen' | 'bar'
  items: PrintJobItem[]
  table_number: number | null
  guest_name: string | null
  order_code: number | null
  created_at: string
}

interface PrinterConfig {
  kitchenHost: string
  kitchenPort: number
  barHost: string
  barPort: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any, any, any>>

let channel: RealtimeChannel | null = null
let currentRestaurantId: string | null = null
let printerConfig: PrinterConfig = { kitchenHost: '', kitchenPort: 9100, barHost: '', barPort: 9100 }

// ─── ESC/POS helpers ─────────────────────────────────────────────────────────

function esc(...bytes: number[]): Buffer { return Buffer.from(bytes) }
function text(s: string): Buffer { return Buffer.from(s, 'latin1') }

function buildTicket(job: PrintJob): Buffer {
  const parts: Buffer[] = []
  const br = () => parts.push(text('\n'))

  parts.push(esc(0x1b, 0x40))          // ESC @ init
  parts.push(esc(0x1b, 0x61, 0x01))    // center
  parts.push(esc(0x1b, 0x45, 0x01))    // bold on
  parts.push(text(`MESA ${job.table_number ?? '?'}`)); br()
  parts.push(esc(0x1b, 0x45, 0x00))    // bold off

  if (job.guest_name) { parts.push(text(job.guest_name)); br() }

  if (job.order_code) {
    parts.push(esc(0x1b, 0x45, 0x01))
    parts.push(text(`#${String(job.order_code).padStart(4, '0')}`))
    parts.push(esc(0x1b, 0x45, 0x00)); br()
  }

  const label = job.printer === 'kitchen' ? 'COZINHA' : 'BAR'
  parts.push(text(`-- ${label} --`)); br()
  parts.push(esc(0x1b, 0x61, 0x00))   // left
  parts.push(text('--------------------------------')); br()

  for (const item of job.items) {
    const line = `${item.quantity}x ${item.name}`
    const price = `R$${(item.unit_price * item.quantity).toFixed(2)}`
    const pad = Math.max(1, 32 - line.length - price.length)
    parts.push(text(line + ' '.repeat(pad) + price)); br()
    if (item.notes) { parts.push(text(`   > ${item.notes}`)); br() }
  }

  parts.push(text('--------------------------------')); br(); br(); br()
  parts.push(esc(0x1d, 0x56, 0x42, 0x10)) // partial cut
  return Buffer.concat(parts)
}

async function sendToPrinter(host: string, port: number, data: Buffer): Promise<void> {
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

async function processJob(supabase: AnySupabase, job: PrintJob): Promise<void> {
  log.info(`[print-agent] Processando job ${job.id} → ${job.printer}`)
  const host = job.printer === 'kitchen' ? printerConfig.kitchenHost : printerConfig.barHost
  const port = job.printer === 'kitchen' ? printerConfig.kitchenPort : printerConfig.barPort
  await sendToPrinter(host, port, buildTicket(job))
  await supabase
    .schema('comi')
    .from('print_jobs')
    .update({ printed_at: new Date().toISOString() })
    .eq('id', job.id)
  log.info(`[print-agent] Job ${job.id} impresso`)
}

async function processPendingJobs(supabase: AnySupabase, restaurantId: string): Promise<void> {
  const { data: jobs } = await supabase
    .schema('comi')
    .from('print_jobs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('printed_at', null)
    .order('created_at')

  if (!jobs?.length) return
  log.info(`[print-agent] ${jobs.length} job(s) pendente(s)`)
  for (const job of jobs as PrintJob[]) {
    await processJob(supabase, job).catch((err: unknown) =>
      log.error(`[print-agent] Erro job ${job.id}:`, err)
    )
  }
}

async function loadPrinterConfig(supabase: AnySupabase, restaurantId: string): Promise<void> {
  const { data } = await supabase
    .schema('comi')
    .from('restaurants')
    .select('printer_kitchen_host, printer_kitchen_port, printer_bar_host, printer_bar_port')
    .eq('id', restaurantId)
    .single()

  if (data) {
    printerConfig = {
      kitchenHost: (data as { printer_kitchen_host: string | null }).printer_kitchen_host ?? '',
      kitchenPort: (data as { printer_kitchen_port: number | null }).printer_kitchen_port ?? 9100,
      barHost: (data as { printer_bar_host: string | null }).printer_bar_host ?? '',
      barPort: (data as { printer_bar_port: number | null }).printer_bar_port ?? 9100,
    }
    log.info('[print-agent] Config:', printerConfig)
  }
}

export function stopPrintAgent(): void {
  channel?.unsubscribe()
  channel = null
  currentRestaurantId = null
  log.info('[print-agent] Parado')
}

export async function startPrintAgent(restaurantId: string): Promise<void> {
  if (currentRestaurantId === restaurantId) return
  stopPrintAgent()
  currentRestaurantId = restaurantId
  log.info('[print-agent] Iniciando para', restaurantId)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log.warn('[print-agent] Credenciais não configuradas')
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as AnySupabase

  await loadPrinterConfig(supabase, restaurantId)
  await processPendingJobs(supabase, restaurantId)

  channel = supabase
    .channel(`print-jobs-${restaurantId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'comi',
      table: 'print_jobs',
      filter: `restaurant_id=eq.${restaurantId}`,
    }, (payload: { new: PrintJob }) => {
      processJob(supabase, payload.new).catch((err: unknown) =>
        log.error(`[print-agent] Erro realtime:`, err)
      )
    })
    .subscribe((status: string) => log.info('[print-agent] Realtime:', status))
}

export function updatePrinterConfig(config: Partial<PrinterConfig>): void {
  printerConfig = { ...printerConfig, ...config }
  log.info('[print-agent] Config atualizada:', printerConfig)
}
