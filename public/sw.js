const CACHE = 'comi-v2'
const PRECACHE = ['/manifest.json', '/icomi-nobg.png', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  // Deixa passar: métodos não-GET, API, rotas Next.js internas
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/__nextjs')
  ) return

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Só cacheia respostas válidas
        if (response && response.ok) {
          const clone = response.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return response
      })
      .catch(() =>
        // Offline: tenta o cache, se não tiver retorna 503 válido
        caches.match(e.request).then(cached =>
          cached ?? new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
        )
      )
  )
})
