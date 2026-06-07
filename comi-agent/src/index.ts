import { createClient } from '@supabase/supabase-js'
import { config } from './config'
import { printTicket, PrintTicket } from './printer'

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  db: { schema: 'comi' },
})

console.log('COMI Agent iniciado')
console.log(`Restaurante: ${config.restaurantId}`)
console.log(`Cozinha: ${config.printers.kitchen.host || 'não configurada'}`)
console.log(`Bar:     ${config.printers.bar.host || 'não configurado'}`)

// ──────────────────────────────────────────
// Modo primário: Supabase Realtime
// O agente recebe print_jobs em tempo real assim que são criados
// ──────────────────────────────────────────
function startRealtime() {
  console.log('[realtime] Conectando...')

  const channel = supabase
    .channel('print-jobs')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'comi',
        table: 'print_jobs',
        filter: `restaurant_id=eq.${config.restaurantId}`,
      },
      async payload => {
        const job = payload.new as {
          id: string
          printer: 'kitchen' | 'bar'
          items: { name: string; quantity: number; notes: string | null }[]
          table_number: number | null
          guest_name: string | null
          order_code: number | null
          created_at: string
        }

        console.log(`[job] #${job.order_code ?? '?'} → ${job.printer} | ${job.items.length} item(s)`)
        await processJob(job.id, job)
      }
    )
    .subscribe(status => {
      console.log(`[realtime] ${status}`)
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.log('[realtime] Erro — ativando modo polling...')
        channel.unsubscribe()
        startPolling()
      }
    })
}

// ──────────────────────────────────────────
// Modo fallback: polling (sem internet ou realtime indisponível)
// ──────────────────────────────────────────
async function startPolling() {
  console.log(`[polling] Iniciando — intervalo ${config.pollIntervalMs}ms`)

  async function poll() {
    try {
      const { data: jobs, error } = await supabase
        .from('print_jobs')
        .select('*')
        .eq('restaurant_id', config.restaurantId)
        .is('printed_at', null)
        .order('created_at', { ascending: true })
        .limit(20)

      if (error) {
        console.error('[polling] Erro:', error.message)
      } else if (jobs && jobs.length > 0) {
        for (const job of jobs) {
          await processJob(job.id, job)
        }
      }
    } catch (err) {
      console.error('[polling] Falha:', err)
    }

    setTimeout(poll, config.pollIntervalMs)
  }

  poll()
}

// ──────────────────────────────────────────
// Processa e imprime um job
// ──────────────────────────────────────────
async function processJob(
  jobId: string,
  job: {
    printer: 'kitchen' | 'bar'
    items: { name: string; quantity: number; notes: string | null }[]
    table_number: number | null
    guest_name: string | null
    order_code: number | null
    created_at: string
  }
) {
  const printerConfig = config.printers[job.printer]

  const ticket: PrintTicket = {
    printer: job.printer,
    orderCode: job.order_code,
    tableNumber: job.table_number,
    guestName: job.guest_name,
    items: job.items,
    createdAt: job.created_at,
  }

  try {
    await printTicket(printerConfig.host, printerConfig.port, ticket)
    console.log(`[print] ✓ #${job.order_code ?? jobId.slice(0, 8)} → ${job.printer}`)

    // Marca como impresso
    await supabase
      .from('print_jobs')
      .update({ printed_at: new Date().toISOString() })
      .eq('id', jobId)
  } catch (err) {
    console.error(`[print] ✗ ${job.printer}:`, err)
    // Não marca como impresso — tentará novamente no próximo ciclo (polling)
  }
}

// ──────────────────────────────────────────
// Inicialização: tenta realtime primeiro
// Se falhar, cai no polling
// ──────────────────────────────────────────
async function main() {
  // Processa jobs pendentes que possam ter chegado enquanto o agente estava offline
  console.log('[init] Verificando jobs pendentes...')
  const { data: pending } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('restaurant_id', config.restaurantId)
    .is('printed_at', null)
    .order('created_at', { ascending: true })

  if (pending && pending.length > 0) {
    console.log(`[init] ${pending.length} job(s) pendente(s) encontrado(s)`)
    for (const job of pending) {
      await processJob(job.id, job)
    }
  }

  // Inicia realtime (com fallback automático para polling)
  startRealtime()
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
