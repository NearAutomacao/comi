const hostname = new URL(self.location).hostname
const isLocal = hostname === 'localhost' || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)

// Em rede local (Electron): se auto-cancela e limpa todo o cache
if (isLocal) {
  self.addEventListener('install', () => self.skipWaiting())
  self.addEventListener('activate', e => {
    e.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.registration.unregister())
    )
  })
} else {
  // Produção: comportamento normal de cache offline
  const CACHE = 'comi-v4'
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
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(e.request).then(cached =>
            cached ?? new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
          )
        )
    )
  })
}
