// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261004100021';
const ARQUIVOS = ["./","./index.html","./parte.20261004100021.N665O44U.js","./parte.20261004100021.UL2OOG23.js","./parte.20261004100021.L4HPRUTA.js","./parte.20261004100021.GILV6UH5.js","./parte.20261004100021.RB2RK2J3.js","./parte.20261004100021.KLKDL2FL.js","./parte.20261004100021.WGQ3MQPV.js","./parte.20261004100021.2PBP3QEF.js","./parte.20261004100021.ZX3LPOGL.js","./parte.20261004100021.EEDMJCQP.js","./parte.20261004100021.3OJEAQOG.js","./parte.20261004100021.OJY2TKHJ.js","./parte.20261004100021.TYBIVO32.js","./parte.20261004100021.K2NWLAL2.js","./parte.20261004100021.S4RLR3TW.js","./parte.20261004100021.VRZVTY7W.js","./parte.20261004100021.PZL73TVH.js","./parte.20261004100021.EZAUG42P.js","./parte.20261004100021.C6RNDTZV.js","./parte.20261004100021.TE7PJF6T.js","./parte.20261004100021.NZRBAJG3.js","./parte.20261004100021.IQPLY262.js","./parte.20261004100021.C7KLHSM7.js","./parte.20261004100021.OUJTEPJW.js","./parte.20261004100021.WBWOWHH3.js","./parte.20261004100021.CBGC67WP.js","./parte.20261004100021.WGH3WELW.js","./parte.20261004100021.4PBY4LED.js","./parte.20261004100021.5PY4O7ID.js","./parte.20261004100021.GAXILV4Y.js","./parte.20261004100021.NCKM4KDR.js","./parte.20261004100021.K2OO5SW2.js","./parte.20261004100021.TZYZMKHK.js","./parte.20261004100021.U5DNPAVR.js","./parte.20261004100021.W2L4KP32.js","./parte.20261004100021.T4IVRBTC.js","./parte.20261004100021.E7BTHPKB.js","./parte.20261004100021.62USFW3S.js","./parte.20261004100021.VPEQX3RA.js","./parte.20261004100021.FC65HPM4.js","./parte.20261004100021.6UPU5XV5.js","./parte.20261004100021.KCBZISRX.js","./jogo.20261004100021.js","./parte.20261004100021.FJZ7FYHJ.js","./parte.20261004100021.B4AAQDZI.js","./parte.20261004100021.6IVY5RUC.js","./parte.20261004100021.XHB52OZY.js","./parte.20261004100021.CMYOWAIM.js","./parte.20261004100021.EPGDUV4Y.js","./parte.20261004100021.FE3TTPIW.js","./parte.20261004100021.LS4GVQIL.js","./parte.20261004100021.UDSZMH66.js","./parte.20261004100021.T2SEPUQY.js","./parte.20261004100021.Z6SE4U74.js","./parte.20261004100021.SQL5CVJX.js","./parte.20261004100021.RF7COQSI.js","./parte.20261004100021.SYUTZWGL.js","./parte.20261004100021.66IMPIMF.js","./parte.20261004100021.GLKU6MRS.js","./parte.20261004100021.B6QHMT5F.js","./parte.20261004100021.DHXQW5VH.js","./parte.20261004100021.CCZ56G3T.js","./parte.20261004100021.Y6SSFZGD.js","./parte.20261004100021.NSOXH6NW.js","./parte.20261004100021.4WTFDRQO.js","./parte.20261004100021.QUUNXHTR.js","./parte.20261004100021.64THT7WW.js","./parte.20261004100021.WJWSQAH3.js","./parte.20261004100021.FXJKP33S.js","./parte.20261004100021.U3SDOWS6.js","./parte.20261004100021.34JZC4TH.js","./parte.20261004100021.7FJD2LNL.js","./parte.20261004100021.BRJ2GM5Y.js","./parte.20261004100021.FVNOVZOZ.js","./parte.20261004100021.R3AGH3EJ.js","./parte.20261004100021.SKJY3ATE.js","./parte.20261004100021.H4FOBLBW.js","./parte.20261004100021.AGQ6THH2.js","./parte.20261004100021.MKSDRWWS.js","./parte.20261004100021.7IYOTQG3.js","./parte.20261004100021.ZLY64AT3.js","./parte.20261004100021.SBSOQMAZ.js","./parte.20261004100021.OG32CLNO.js","./parte.20261004100021.QAFG2O3Y.js","./parte.20261004100021.VI2ZVNYV.js","./parte.20261004100021.44NRM33Q.js","./parte.20261004100021.JSNSDSO7.js","./parte.20261004100021.MHJXMCDQ.js","./parte.20261004100021.HFXJGCW6.js","./parte.20261004100021.LJLLTLV4.js","./parte.20261004100021.U3BT7DCV.js","./parte.20261004100021.4H3FFU74.js","./parte.20261004100021.Z7AFIKFT.js","./parte.20261004100021.54WZKSCY.js","./parte.20261004100021.5HWVSDCY.js","./parte.20261004100021.OYM2UF43.js","./parte.20261004100021.P5P2XFTQ.js","./parte.20261004100021.RP7KOW3B.js","./parte.20261004100021.KLVQSAHM.js","./parte.20261004100021.OBO436XV.js","./parte.20261004100021.2R6V435I.js","./parte.20261004100021.SV5JBEAJ.js","./parte.20261004100021.PXQSDUTA.js","./parte.20261004100021.PTOAQ5W5.js","./parte.20261004100021.IAREOQ5J.js","./parte.20261004100021.IKNKE4GY.js","./parte.20261004100021.RSGJDBXN.js","./parte.20261004100021.7QW7ULWZ.js","./parte.20261004100021.YQ7SNMQC.js","./parte.20261004100021.46ALUIA5.js","./parte.20261004100021.YP7FOAPF.js","./parte.20261004100021.V3BLET5B.js","./parte.20261004100021.ZPP6WX4I.js","./parte.20261004100021.6MJTYPRB.js","./parte.20261004100021.LCNVOLU4.js","./parte.20261004100021.OS4LCW5I.js","./manifest.webmanifest","./fontes/inter.20261004100021.woff2","./estilo.20261004100021.css","./tarefas.20261004100021.js","./oficina.20261004100021.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261004100021.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
