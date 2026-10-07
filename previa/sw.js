// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261007005445';
const ARQUIVOS = ["./","./index.html","./parte.20261007005445.7DVUDEXH.js","./parte.20261007005445.EK2VJANV.js","./parte.20261007005445.OSMY4EPY.js","./parte.20261007005445.7SDITFMD.js","./parte.20261007005445.KDIPO76E.js","./parte.20261007005445.URIMD5KQ.js","./parte.20261007005445.LVQFXPRQ.js","./parte.20261007005445.OJKSO4XL.js","./parte.20261007005445.STL2WFNB.js","./parte.20261007005445.THM2YK4R.js","./parte.20261007005445.TWSFMFKC.js","./parte.20261007005445.IHPQV2HE.js","./parte.20261007005445.HT5PK4PM.js","./parte.20261007005445.GGSVJJAF.js","./parte.20261007005445.MC5HZRQI.js","./parte.20261007005445.JJZWNBT6.js","./parte.20261007005445.2WWI6XZZ.js","./parte.20261007005445.XVLVHWSH.js","./parte.20261007005445.67UKEZGV.js","./parte.20261007005445.TTFCIB5E.js","./parte.20261007005445.6ABB5Z3R.js","./parte.20261007005445.IB6OIPAG.js","./parte.20261007005445.HPSOA6JY.js","./parte.20261007005445.OADZTN7N.js","./parte.20261007005445.UZKSS7ML.js","./parte.20261007005445.TB64VYZ4.js","./parte.20261007005445.S223FDS7.js","./parte.20261007005445.EHHTSB6K.js","./parte.20261007005445.ZWNZU5MK.js","./parte.20261007005445.FSNNOO35.js","./parte.20261007005445.ZMOOURLO.js","./parte.20261007005445.QT2RMUL3.js","./parte.20261007005445.YD2MQIBE.js","./parte.20261007005445.4MQ56SUE.js","./parte.20261007005445.22JBS36Z.js","./parte.20261007005445.PGEUDHDA.js","./parte.20261007005445.LBFGZAKD.js","./parte.20261007005445.NYIXORGI.js","./parte.20261007005445.OI4I6YB4.js","./parte.20261007005445.BQ2EMWUE.js","./parte.20261007005445.YJWW7LHA.js","./parte.20261007005445.FVN3LCI5.js","./parte.20261007005445.BYY7SKSU.js","./jogo.20261007005445.js","./parte.20261007005445.IOTQTO7D.js","./parte.20261007005445.STJTHTXZ.js","./parte.20261007005445.S3AVTBB5.js","./parte.20261007005445.BUKMMG2O.js","./parte.20261007005445.ULE6VJ2A.js","./parte.20261007005445.UR3I6Y67.js","./parte.20261007005445.GCI2FTF6.js","./parte.20261007005445.7BVUW7YK.js","./parte.20261007005445.HSJNHDWR.js","./parte.20261007005445.IU3LFJ2J.js","./parte.20261007005445.UMIFAOBF.js","./parte.20261007005445.GGZ2L3P3.js","./parte.20261007005445.U2XUWHDV.js","./parte.20261007005445.536C3NJ6.js","./parte.20261007005445.C27KI42Q.js","./parte.20261007005445.4JESRGVY.js","./parte.20261007005445.UJPRH4VN.js","./parte.20261007005445.27B7NDZH.js","./parte.20261007005445.C2P6TVFS.js","./parte.20261007005445.3JMFIBYQ.js","./parte.20261007005445.OFFIQMKQ.js","./parte.20261007005445.MASL4G4S.js","./parte.20261007005445.7M7E6X2W.js","./parte.20261007005445.SAMZRAVT.js","./parte.20261007005445.BJMRE44L.js","./parte.20261007005445.H3OY3Z7Q.js","./parte.20261007005445.22O27RKG.js","./parte.20261007005445.CIVMDT5F.js","./parte.20261007005445.UEH7XOAU.js","./parte.20261007005445.CO6XX6CF.js","./parte.20261007005445.VSWBQ47E.js","./parte.20261007005445.CAKEMMRU.js","./parte.20261007005445.O4TBB734.js","./parte.20261007005445.DMMAQEX4.js","./parte.20261007005445.FK5XDFFF.js","./parte.20261007005445.NKLJSG5S.js","./parte.20261007005445.L4OHTOWE.js","./parte.20261007005445.EHLSY5RA.js","./parte.20261007005445.MFLCKGNS.js","./parte.20261007005445.APWOY7VS.js","./parte.20261007005445.IFOKBQIX.js","./parte.20261007005445.55PPRZL6.js","./parte.20261007005445.LAWWW2BI.js","./parte.20261007005445.FXXG7QM6.js","./parte.20261007005445.APIYTGYB.js","./parte.20261007005445.PQQVZ3P3.js","./parte.20261007005445.IQSAJSWH.js","./parte.20261007005445.PEOHMEAP.js","./parte.20261007005445.TDLT353B.js","./parte.20261007005445.ZJXJEGAT.js","./parte.20261007005445.SWXAPY7D.js","./parte.20261007005445.O3C2HCXJ.js","./parte.20261007005445.ZB4GO4VP.js","./parte.20261007005445.EFDPAUKK.js","./parte.20261007005445.5PLRT36P.js","./parte.20261007005445.LEEN227K.js","./parte.20261007005445.G77SFRER.js","./parte.20261007005445.FDAQ4CKG.js","./parte.20261007005445.HJXI6LQA.js","./parte.20261007005445.L2356RZP.js","./parte.20261007005445.HV6EX6HW.js","./parte.20261007005445.LY66YTJK.js","./parte.20261007005445.GLRR6IXG.js","./parte.20261007005445.6AKE4VCT.js","./parte.20261007005445.5MNKH3QQ.js","./parte.20261007005445.KODWXJHZ.js","./parte.20261007005445.EUZAMWKT.js","./parte.20261007005445.HOP34WL7.js","./parte.20261007005445.VMFMCTFX.js","./parte.20261007005445.PFYQVFO5.js","./parte.20261007005445.KLFW375F.js","./parte.20261007005445.INGQ5VOP.js","./parte.20261007005445.ZC67PPPL.js","./parte.20261007005445.P3PXPJMP.js","./manifest.webmanifest","./fontes/inter.20261007005445.woff2","./estilo.20261007005445.css","./tarefas.20261007005445.js","./oficina.20261007005445.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261007005445.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
