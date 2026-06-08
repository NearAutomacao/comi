import PocketBase from 'pocketbase'

let _pb: PocketBase | null = null
let _pbUrl: string | null = null

function getPbUrl(): string {
  if (typeof window !== 'undefined') {
    const config = (window as any).__COMI_CONFIG__
    if (config?.pbUrl) return config.pbUrl
  }
  return process.env.NEXT_PUBLIC_PB_URL ?? 'http://127.0.0.1:8090'
}

export function createClient(): PocketBase {
  const url = getPbUrl()
  if (!_pb || _pbUrl !== url) {
    _pb = new PocketBase(url)
    _pb.autoCancellation(false)
    _pbUrl = url
  }
  return _pb
}
