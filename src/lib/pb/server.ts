import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'

// Cria cliente PocketBase sem autenticação.
// PocketBase roda apenas em localhost — regras de coleção são abertas (app local).
// Controle de acesso é feito pelas rotas Next.js.
export function createAdminClient(): PocketBase {
  const pb = new PocketBase(PB_URL)
  pb.autoCancellation(false)
  return pb
}

// Helper: converte array em filtro OR do PocketBase
// inFilter('status', ['open', 'preparing']) → 'status = "open" || status = "preparing"'
export function inFilter(field: string, values: (string | number | null)[]): string {
  if (values.length === 0) return 'id = "NEVER_MATCH_EMPTY_IN"'
  return values
    .map(v => v === null ? `${field} = null` : `${field} = ${JSON.stringify(v)}`)
    .join(' || ')
}
