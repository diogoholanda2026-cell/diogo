// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20260928135559';
const ARQUIVOS = ["./","./index.html","./parte.20260928135559.35HROWT7.js","./parte.20260928135559.DEUJO7OL.js","./parte.20260928135559.E66CYKVH.js","./parte.20260928135559.WLLPDYHT.js","./parte.20260928135559.7U5OJYUV.js","./parte.20260928135559.DKLGSGI6.js","./parte.20260928135559.AYDNPKHR.js","./parte.20260928135559.3UVBXMGI.js","./parte.20260928135559.THIS7ELJ.js","./parte.20260928135559.CV3CHAQQ.js","./parte.20260928135559.NPMIVONM.js","./parte.20260928135559.CYXDDTEC.js","./jogo.20260928135559.js","./parte.20260928135559.OZMLOF7R.js","./parte.20260928135559.HG74Z356.js","./parte.20260928135559.Z3RQT3QF.js","./parte.20260928135559.OXNQFRT3.js","./parte.20260928135559.T5R5LCDZ.js","./parte.20260928135559.HA7Y36BY.js","./parte.20260928135559.WD5FKT6D.js","./parte.20260928135559.Q2HTF6VG.js","./parte.20260928135559.MXGBKISV.js","./parte.20260928135559.D5HXBBSY.js","./parte.20260928135559.QTWREKMW.js","./parte.20260928135559.J3RHYUU2.js","./parte.20260928135559.642NLNSY.js","./parte.20260928135559.HZ3UQE6R.js","./parte.20260928135559.BZEIYXD4.js","./parte.20260928135559.GKPSFE4K.js","./parte.20260928135559.EZFLCZJ3.js","./parte.20260928135559.EVZDX7ZG.js","./parte.20260928135559.FNLZC2SE.js","./parte.20260928135559.FAKNTXW5.js","./parte.20260928135559.FU7SIUHO.js","./parte.20260928135559.NFJPB3SN.js","./parte.20260928135559.THY55TK2.js","./parte.20260928135559.3MU2RXFU.js","./manifest.webmanifest","./fontes/inter.20260928135559.woff2","./estilo.20260928135559.css","./tarefas.20260928135559.js","./oficina.20260928135559.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20260928135559.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIXO) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'atualizar') self.skipWaiting();
});

const doCache = (req) => caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // rede primeiro (revalidando o cache HTTP), com limite de 3 s; sem rede, a página desta versão
    e.respondWith((async () => {
      try {
        const limite = new Promise((_, nao) => setTimeout(() => nao(new Error('tempo')), 3000));
        const r = await Promise.race([fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }), limite]);
        if (r.ok && !r.redirected) return r;
      } catch (_) { /* sem rede: cai no cache */ }
      return (await doCache('./index.html')) || (await doCache('./')) || fetch(req);
    })());
    return;
  }
  // arquivos: do cache desta versão; o que não estiver nele vem da rede (sem gravar)
  e.respondWith(doCache(req).then((hit) => hit || fetch(req)));
});
