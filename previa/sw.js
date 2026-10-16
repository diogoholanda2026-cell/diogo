// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261016154757';
const ARQUIVOS = ["./","./index.html","./parte.20261016154757.SWJCMCVH.js","./parte.20261016154757.TOTUBIRI.js","./parte.20261016154757.AHF6S5Y6.js","./parte.20261016154757.AWPEM4HZ.js","./parte.20261016154757.KJMAVSNJ.js","./parte.20261016154757.24KQS7VE.js","./parte.20261016154757.MJHSCGSG.js","./parte.20261016154757.YV5F43AW.js","./parte.20261016154757.EDTH57KM.js","./parte.20261016154757.BAHMYLMY.js","./parte.20261016154757.2IUVJ6BO.js","./parte.20261016154757.ZVVJX76L.js","./parte.20261016154757.35IAAHOK.js","./parte.20261016154757.KC7FR7F7.js","./parte.20261016154757.QQQDLJWS.js","./parte.20261016154757.6WUQ3BMS.js","./parte.20261016154757.JEMXIL63.js","./parte.20261016154757.K4ETKOVJ.js","./parte.20261016154757.YYP5UT2I.js","./parte.20261016154757.7BIPDPHV.js","./parte.20261016154757.PHES6FVO.js","./parte.20261016154757.FLUINN6G.js","./parte.20261016154757.IPTLKSCJ.js","./parte.20261016154757.XCVD2ZBJ.js","./parte.20261016154757.YFQW3C4Q.js","./parte.20261016154757.OBFEXV6T.js","./parte.20261016154757.DMRURKVM.js","./parte.20261016154757.NINYPSB4.js","./parte.20261016154757.QBAV3M35.js","./parte.20261016154757.KG7GCKWV.js","./parte.20261016154757.AOBL6CP3.js","./parte.20261016154757.HQB3R67S.js","./parte.20261016154757.OK5BXP73.js","./parte.20261016154757.QN5UY2UK.js","./parte.20261016154757.JIXZPLEO.js","./parte.20261016154757.YZTZQYBG.js","./parte.20261016154757.SQPNW7BT.js","./parte.20261016154757.SNS27GEN.js","./parte.20261016154757.XH26FTIX.js","./parte.20261016154757.FDTOHNDX.js","./parte.20261016154757.724JHHG6.js","./parte.20261016154757.S7JLS2XP.js","./parte.20261016154757.YZHL2SZE.js","./jogo.20261016154757.js","./parte.20261016154757.ICZE5GH3.js","./parte.20261016154757.DDXUKUNA.js","./parte.20261016154757.EXHLSNTQ.js","./parte.20261016154757.LTJ5HMZ2.js","./parte.20261016154757.3TH3EDQZ.js","./parte.20261016154757.EU2ZTWSR.js","./parte.20261016154757.LYSWRK2P.js","./parte.20261016154757.H7X6MHOX.js","./parte.20261016154757.KVBM4DIS.js","./parte.20261016154757.L55BXVWR.js","./parte.20261016154757.NFXXAUX7.js","./parte.20261016154757.QU3PU3VM.js","./parte.20261016154757.5PSMBCUR.js","./parte.20261016154757.4POI5ESU.js","./parte.20261016154757.OECHV4NY.js","./parte.20261016154757.D7C22MA2.js","./parte.20261016154757.FPXNFXLT.js","./parte.20261016154757.UQ5GRTPU.js","./parte.20261016154757.7XCUXY5C.js","./parte.20261016154757.QCYAIWCL.js","./parte.20261016154757.B7LLU3QZ.js","./parte.20261016154757.JMA37BVH.js","./parte.20261016154757.KFQWGSUC.js","./parte.20261016154757.7WYG2MSE.js","./parte.20261016154757.CJQ7HD7B.js","./parte.20261016154757.N65TZ3OX.js","./parte.20261016154757.ZN7U5QV5.js","./parte.20261016154757.XC3WSDM2.js","./parte.20261016154757.ZYJQORNL.js","./parte.20261016154757.OZTQZMAA.js","./parte.20261016154757.OUZSC3HQ.js","./parte.20261016154757.KXGM6FV7.js","./parte.20261016154757.FBCYQJEX.js","./parte.20261016154757.I7MHH23K.js","./parte.20261016154757.NSY2TRDV.js","./parte.20261016154757.GUXKVQ7R.js","./parte.20261016154757.WQLU5AKB.js","./parte.20261016154757.LTC2C5U7.js","./parte.20261016154757.YN6JKW22.js","./parte.20261016154757.2JYYZJO5.js","./parte.20261016154757.HUXZE6Y6.js","./parte.20261016154757.YQOABL57.js","./parte.20261016154757.IDMWLFAJ.js","./parte.20261016154757.TDYMYGFD.js","./parte.20261016154757.N7D3EIBL.js","./parte.20261016154757.SRCOB4X3.js","./parte.20261016154757.3Q2VMPIS.js","./parte.20261016154757.MX556I3C.js","./parte.20261016154757.HW25BOFM.js","./parte.20261016154757.3FLBMDB3.js","./parte.20261016154757.3JQ37ISC.js","./parte.20261016154757.G26CLAMP.js","./parte.20261016154757.NPOPDQU7.js","./parte.20261016154757.W67FNEAD.js","./parte.20261016154757.UK2RM5T4.js","./parte.20261016154757.FDTQ6RUO.js","./parte.20261016154757.JJ6XR4VN.js","./parte.20261016154757.BQ2MM4DA.js","./parte.20261016154757.4AHQY2Y4.js","./parte.20261016154757.AFZY3TMB.js","./parte.20261016154757.PNFM2W2D.js","./parte.20261016154757.TVF2GE4I.js","./parte.20261016154757.6TJQU7AT.js","./parte.20261016154757.OVX56FQ5.js","./parte.20261016154757.QCSGFPES.js","./parte.20261016154757.XRZQMC5W.js","./parte.20261016154757.MUP3SNUT.js","./parte.20261016154757.N2YOEIQS.js","./parte.20261016154757.JYDOZ2DI.js","./parte.20261016154757.NTZW7QIH.js","./parte.20261016154757.OWR3CPRM.js","./parte.20261016154757.O64EKM47.js","./parte.20261016154757.KG76T6YU.js","./parte.20261016154757.ZINFADZJ.js","./parte.20261016154757.7QWDT5ZX.js","./parte.20261016154757.OUM2LFTC.js","./manifest.webmanifest","./fontes/inter.20261016154757.woff2","./estilo.20261016154757.css","./tarefas.20261016154757.js","./oficina.20261016154757.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261016154757.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
