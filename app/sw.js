// Service worker: joga offline sem misturar versões. Cada publicação tem um cache próprio com o
// index.html e o jogo.<carimbo>.js daquela versão (o nome do arquivo muda a cada publicação, então o
// index sempre pede o jogo certo). A instalação baixa tudo sem o cache HTTP e falha inteira se faltar
// um arquivo (o SW antigo continua valendo). A página vem da rede (até 3 s) e cai no cache offline.
// A fonte da interface (Baloo 2) entra no cache com o jogo: a letra é a mesma sem internet.
const CACHE = 'held-2.0.0-20260926142133';
const FONTES = ['latin-600', 'latin-800', 'latin-ext-600', 'latin-ext-800'].map((f) => `./fontes/baloo-2-${f}-normal.woff2`);
const ARQUIVOS = ['./', './index.html', './jogo.20260926142133.js', './manifest.webmanifest', './foto.webp', './icones/icone-192.png', './icones/icone-512.png', ...FONTES];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' }))))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', (e) => { if (e.data === 'atualizar') self.skipWaiting(); });
const doCache = (req) => caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }));
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // rede primeiro (revalidando o cache HTTP), com limite de 3 s; sem rede, o index desta versão
    e.respondWith((async () => {
      try {
        const r = await Promise.race([fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }), new Promise((_, n) => setTimeout(() => n(new Error('tempo')), 3000))]);
        if (r.ok && !r.redirected) return r;
      } catch (_) {}
      return (await doCache('./index.html')) || (await doCache('./')) || fetch(req);
    })());
    return;
  }
  // arquivos: só do cache desta versão; o que não estiver nele vem da rede (sem gravar no cache)
  e.respondWith(doCache(req).then((hit) => hit || fetch(req)));
});
