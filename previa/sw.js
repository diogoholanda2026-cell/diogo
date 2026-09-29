// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20260929044056';
const ARQUIVOS = ["./","./index.html","./parte.20260929044056.PCB5TZLD.js","./parte.20260929044056.KVCDNFT2.js","./parte.20260929044056.D7TVMKAK.js","./parte.20260929044056.C6W5VE34.js","./parte.20260929044056.PF3DTCX3.js","./parte.20260929044056.GXFNTGY2.js","./parte.20260929044056.G2EVNB4W.js","./parte.20260929044056.3LXWA7YW.js","./parte.20260929044056.D3QBNDDO.js","./parte.20260929044056.HQ6NB7AX.js","./parte.20260929044056.2OHBEZ4D.js","./parte.20260929044056.XWXB24DN.js","./jogo.20260929044056.js","./parte.20260929044056.ZOTCJJIA.js","./parte.20260929044056.244I5MM4.js","./parte.20260929044056.VS36TVE7.js","./parte.20260929044056.EPQYOFI3.js","./parte.20260929044056.NFTTYUJ5.js","./parte.20260929044056.4EUOWWUE.js","./parte.20260929044056.X54ROGBL.js","./parte.20260929044056.XIU2GHAE.js","./parte.20260929044056.45IMJCSM.js","./parte.20260929044056.7KKULFOA.js","./parte.20260929044056.FT22MMBI.js","./parte.20260929044056.6IBQT2OJ.js","./parte.20260929044056.LEJ5UAV3.js","./parte.20260929044056.M5SPDIM5.js","./parte.20260929044056.OAZESJ5N.js","./parte.20260929044056.6DKPERFK.js","./parte.20260929044056.7TPJWBRQ.js","./parte.20260929044056.AFHWSEYT.js","./parte.20260929044056.54CSDEAI.js","./parte.20260929044056.QR2W3Q62.js","./parte.20260929044056.WVBHAN32.js","./parte.20260929044056.QWPBSO6A.js","./parte.20260929044056.HDHI6O6M.js","./parte.20260929044056.IAJXRQ2V.js","./parte.20260929044056.7PKMEB27.js","./manifest.webmanifest","./fontes/inter.20260929044056.woff2","./estilo.20260929044056.css","./tarefas.20260929044056.js","./oficina.20260929044056.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20260929044056.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
