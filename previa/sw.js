// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20260928202955';
const ARQUIVOS = ["./","./index.html","./parte.20260928202955.5WMK4JCL.js","./parte.20260928202955.E6INUEVJ.js","./parte.20260928202955.4FDP3W6Z.js","./parte.20260928202955.LQ6T3YCW.js","./parte.20260928202955.BTWGADRC.js","./parte.20260928202955.L6CWH4FM.js","./parte.20260928202955.PRG46PVG.js","./parte.20260928202955.KLCT52DY.js","./parte.20260928202955.SY4IJCHE.js","./parte.20260928202955.NSXJ6QA3.js","./parte.20260928202955.SEAZGFXV.js","./parte.20260928202955.7ATJPTM5.js","./jogo.20260928202955.js","./parte.20260928202955.SQJ6LB6E.js","./parte.20260928202955.M7QJYKEW.js","./parte.20260928202955.WQZYXMFK.js","./parte.20260928202955.2WRSHF34.js","./parte.20260928202955.5UHVSG5O.js","./parte.20260928202955.T3R7COF5.js","./parte.20260928202955.KYXALLYK.js","./parte.20260928202955.6WPSUSEC.js","./parte.20260928202955.6D4ZKGLR.js","./parte.20260928202955.TRGWFEUC.js","./parte.20260928202955.YJ3N3CB5.js","./parte.20260928202955.3GZLD5YT.js","./parte.20260928202955.S7MBTGHK.js","./parte.20260928202955.VKOFZON4.js","./parte.20260928202955.5OZNUAOP.js","./parte.20260928202955.IBTJYPFY.js","./parte.20260928202955.OUH4QGCQ.js","./parte.20260928202955.PTWINUMZ.js","./parte.20260928202955.YJ4X5WSJ.js","./parte.20260928202955.UH3XFB56.js","./parte.20260928202955.ACO56LZS.js","./parte.20260928202955.NB4EFBJD.js","./parte.20260928202955.D5FL524K.js","./parte.20260928202955.NRVGTEV3.js","./parte.20260928202955.MWP5KBI4.js","./manifest.webmanifest","./fontes/inter.20260928202955.woff2","./estilo.20260928202955.css","./tarefas.20260928202955.js","./oficina.20260928202955.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20260928202955.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
