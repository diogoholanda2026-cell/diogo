// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261016115246';
const ARQUIVOS = ["./","./index.html","./parte.20261016115246.P3KNCZ24.js","./parte.20261016115246.UW362A3O.js","./parte.20261016115246.PBJ6D3DH.js","./parte.20261016115246.ULUV65B7.js","./parte.20261016115246.6VMJOGJD.js","./parte.20261016115246.ZNPHJWTI.js","./parte.20261016115246.B6XJBWU2.js","./parte.20261016115246.LL3OYENH.js","./parte.20261016115246.HR2ZPTQF.js","./parte.20261016115246.YVWVH6KD.js","./parte.20261016115246.UODSJ7TZ.js","./parte.20261016115246.4M4O37LI.js","./parte.20261016115246.NIPYYCTC.js","./parte.20261016115246.AHNBW6CA.js","./parte.20261016115246.3T4VMD4D.js","./parte.20261016115246.T5VMOXGI.js","./parte.20261016115246.T5E4SAGX.js","./parte.20261016115246.JNOGG3WI.js","./parte.20261016115246.EWSSJNUR.js","./parte.20261016115246.C3G62UWQ.js","./parte.20261016115246.33PBB453.js","./parte.20261016115246.AZL4XM6H.js","./parte.20261016115246.4CX3CJ6W.js","./parte.20261016115246.BE2P5ZHI.js","./parte.20261016115246.JIAVNXX6.js","./parte.20261016115246.J2FEAZFH.js","./parte.20261016115246.4M6IX3KK.js","./parte.20261016115246.IJD2R6PU.js","./parte.20261016115246.C7IZVQTM.js","./parte.20261016115246.7K5JYRKJ.js","./parte.20261016115246.FCIYVMQE.js","./parte.20261016115246.PJ2YXRSJ.js","./parte.20261016115246.DA3H3EMH.js","./parte.20261016115246.2IJOYC4N.js","./parte.20261016115246.RH7EZIBV.js","./parte.20261016115246.LTJ2EJKV.js","./parte.20261016115246.G3ARFC5E.js","./parte.20261016115246.MQKRZM6F.js","./parte.20261016115246.WN54PDJP.js","./parte.20261016115246.U3CEITPF.js","./parte.20261016115246.N26CKR56.js","./parte.20261016115246.BYXUBIYB.js","./parte.20261016115246.JHPZS6KE.js","./parte.20261016115246.MYMXDGSV.js","./jogo.20261016115246.js","./parte.20261016115246.CNAICKSP.js","./parte.20261016115246.MVFMJIQA.js","./parte.20261016115246.J3GT3KUP.js","./parte.20261016115246.OLVSEPBC.js","./parte.20261016115246.GVTMTJUD.js","./parte.20261016115246.MTZKXI5A.js","./parte.20261016115246.RRWTCFN2.js","./parte.20261016115246.6MFRDJA4.js","./parte.20261016115246.7MFKIC25.js","./parte.20261016115246.KPM4XXIV.js","./parte.20261016115246.SCWAGDIQ.js","./parte.20261016115246.TJUS2COB.js","./parte.20261016115246.SUTF6F3I.js","./parte.20261016115246.4WKD7ZIO.js","./parte.20261016115246.URAM2KX4.js","./parte.20261016115246.ADX75EHY.js","./parte.20261016115246.SO4KDKMX.js","./parte.20261016115246.DN5SC7C6.js","./parte.20261016115246.M3NGGYH2.js","./parte.20261016115246.NG2MSU52.js","./parte.20261016115246.NWJACXIA.js","./parte.20261016115246.ZEDYUYBC.js","./parte.20261016115246.BN3DF6XZ.js","./parte.20261016115246.UNUUFF3L.js","./parte.20261016115246.Y4OPIRAJ.js","./parte.20261016115246.2AXRE2A5.js","./parte.20261016115246.2HRJJ4JD.js","./parte.20261016115246.HRNG6W3C.js","./parte.20261016115246.I2UAX5L2.js","./parte.20261016115246.6GGBAWRX.js","./parte.20261016115246.NZ4AG4IL.js","./parte.20261016115246.VU5DE6E5.js","./parte.20261016115246.7MEGODPW.js","./parte.20261016115246.PW25T5TT.js","./parte.20261016115246.KKB6ARI7.js","./parte.20261016115246.SCLFGRNU.js","./parte.20261016115246.LHPZPHXX.js","./parte.20261016115246.RVUOK3M3.js","./parte.20261016115246.2YEQM52X.js","./parte.20261016115246.RTWWRQJ4.js","./parte.20261016115246.DUDU4XSN.js","./parte.20261016115246.QCJJXMJI.js","./parte.20261016115246.EDS3LURE.js","./parte.20261016115246.JH7PVYWM.js","./parte.20261016115246.ZYAN3JUO.js","./parte.20261016115246.5B7S3GI6.js","./parte.20261016115246.Y7H3T3NE.js","./parte.20261016115246.QBKLXOEY.js","./parte.20261016115246.YS2PMFLG.js","./parte.20261016115246.GXZCSPGL.js","./parte.20261016115246.TM5GM3GP.js","./parte.20261016115246.XOTB5SPV.js","./parte.20261016115246.HQX5TJGZ.js","./parte.20261016115246.6NTUAZV6.js","./parte.20261016115246.VFHRCDPM.js","./parte.20261016115246.QNMENRJD.js","./parte.20261016115246.IIOJTTQW.js","./parte.20261016115246.PNXTXCHA.js","./parte.20261016115246.FRBJPDE7.js","./parte.20261016115246.PFIHF2IB.js","./parte.20261016115246.ENNTSFHH.js","./parte.20261016115246.XJYRVMCF.js","./parte.20261016115246.JSVCXFAG.js","./parte.20261016115246.YMMGYIYT.js","./parte.20261016115246.FVRZUFW3.js","./parte.20261016115246.574PLUBK.js","./parte.20261016115246.T7VMHWYG.js","./parte.20261016115246.V5CN3WCM.js","./parte.20261016115246.LWFFEX6J.js","./parte.20261016115246.3N4APNL5.js","./parte.20261016115246.T3KSY2KT.js","./parte.20261016115246.NB3GFW4Y.js","./parte.20261016115246.RE6OEUIY.js","./parte.20261016115246.4SW2HUE7.js","./parte.20261016115246.RXEFSQ5A.js","./manifest.webmanifest","./fontes/inter.20261016115246.woff2","./estilo.20261016115246.css","./tarefas.20261016115246.js","./oficina.20261016115246.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261016115246.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
