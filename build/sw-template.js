/* Service worker for offline play. The build fills in VERSION and PRECACHE. */
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const CACHE = `misdeal-${VERSION}`
// Hosts add Vary headers (Firebase: x-fh-requested-host, accept-encoding) that would make cached
// files miss when the page asks for them offline. Everything cached here is same-origin and static.
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('misdeal-') || k.startsWith('print-run-')) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Pages: try the network so new deploys show up, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html', MATCH).then((page) => page || caches.match('/', MATCH))),
    )
    return
  }

  // Hashed build assets never change, so the cache wins.
  event.respondWith(
    caches.match(req, MATCH).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        }),
    ),
  )
})
