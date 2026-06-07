import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })

function require_env(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Variável de ambiente obrigatória: ${key}`)
  return val
}

export const config = {
  supabaseUrl:        require_env('SUPABASE_URL'),
  supabaseServiceKey: require_env('SUPABASE_SERVICE_ROLE_KEY'),
  restaurantId:       require_env('RESTAURANT_ID'),

  // Impressoras: endereço IP e porta TCP (padrão ESC/POS = 9100)
  printers: {
    kitchen: {
      host: process.env.PRINTER_KITCHEN_HOST ?? '',
      port: parseInt(process.env.PRINTER_KITCHEN_PORT ?? '9100'),
    },
    bar: {
      host: process.env.PRINTER_BAR_HOST ?? '',
      port: parseInt(process.env.PRINTER_BAR_PORT ?? '9100'),
    },
  },

  // Intervalo de polling quando offline (ms)
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '3000'),
}
