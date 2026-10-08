// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008142647';
const ARQUIVOS = ["./","./index.html","./parte.20261008142647.4UZKMH4O.js","./parte.20261008142647.IS6VA6Y4.js","./parte.20261008142647.DKJD73ZJ.js","./parte.20261008142647.MWRQUTDY.js","./parte.20261008142647.BNAVYHR7.js","./parte.20261008142647.RTRXFW33.js","./parte.20261008142647.4YJHZPMU.js","./parte.20261008142647.CBPOGNEO.js","./parte.20261008142647.NBTJCMVV.js","./parte.20261008142647.VBH66U5R.js","./parte.20261008142647.ITTOAJES.js","./parte.20261008142647.IUHHCO5I.js","./parte.20261008142647.K4XAOH7P.js","./parte.20261008142647.2IOKYPLU.js","./parte.20261008142647.BXSN2HGT.js","./parte.20261008142647.QVI5D42P.js","./parte.20261008142647.MY35Z67G.js","./parte.20261008142647.XNFZJGZW.js","./parte.20261008142647.WOYHQVLA.js","./parte.20261008142647.5K7RFSGH.js","./parte.20261008142647.BJVAUHLC.js","./parte.20261008142647.3ULLKDF4.js","./parte.20261008142647.VJWC5KGW.js","./parte.20261008142647.QWBGSAQN.js","./parte.20261008142647.CUSIZWQU.js","./parte.20261008142647.BEMULUGR.js","./parte.20261008142647.UY7FZ6PL.js","./parte.20261008142647.7VUTIEGU.js","./parte.20261008142647.SSSGLTOZ.js","./parte.20261008142647.V4VKURXG.js","./parte.20261008142647.I6S4MGF7.js","./parte.20261008142647.2XBIJUHT.js","./parte.20261008142647.W24UEXEO.js","./parte.20261008142647.VOKTZJ6F.js","./parte.20261008142647.HYY5JZV3.js","./parte.20261008142647.BA7S5MZK.js","./parte.20261008142647.O2NLFLCL.js","./parte.20261008142647.TIBUDJJH.js","./parte.20261008142647.EN4EXROJ.js","./parte.20261008142647.LPX556YG.js","./parte.20261008142647.3RGZPYHZ.js","./parte.20261008142647.LE6OKCER.js","./parte.20261008142647.SRIYYJBQ.js","./parte.20261008142647.BQKS5IYD.js","./jogo.20261008142647.js","./parte.20261008142647.5DS3XQ2P.js","./parte.20261008142647.KIJYTXS2.js","./parte.20261008142647.T2SA3JPE.js","./parte.20261008142647.NKMQN6PK.js","./parte.20261008142647.2ARYQ3OJ.js","./parte.20261008142647.7KSMAIZ3.js","./parte.20261008142647.ONI5IZNQ.js","./parte.20261008142647.LPLIA54N.js","./parte.20261008142647.FMQ6DNB5.js","./parte.20261008142647.APYD62LI.js","./parte.20261008142647.EVVFTNUN.js","./parte.20261008142647.IKUSTZJ3.js","./parte.20261008142647.CO45LWDZ.js","./parte.20261008142647.MG3TQVS2.js","./parte.20261008142647.7NOYENO7.js","./parte.20261008142647.5QECTFQQ.js","./parte.20261008142647.6DGC46Q5.js","./parte.20261008142647.FIEJOLUB.js","./parte.20261008142647.DT3AVZZA.js","./parte.20261008142647.DWUU7H6F.js","./parte.20261008142647.PCLW3OBO.js","./parte.20261008142647.4AWTDT4M.js","./parte.20261008142647.QPXLLFEC.js","./parte.20261008142647.JKM4KOIW.js","./parte.20261008142647.K66YXAFU.js","./parte.20261008142647.O6VXLLKH.js","./parte.20261008142647.B6EG5VJL.js","./parte.20261008142647.5KD7REVU.js","./parte.20261008142647.7QIOGESH.js","./parte.20261008142647.HYWABUTL.js","./parte.20261008142647.QKU3HMSS.js","./parte.20261008142647.43UO4ZYR.js","./parte.20261008142647.MNBHYQSS.js","./parte.20261008142647.MKPAYPYA.js","./parte.20261008142647.XQ23LIH4.js","./parte.20261008142647.LXEQO2IK.js","./parte.20261008142647.JK67A3CR.js","./parte.20261008142647.MSNRHMXT.js","./parte.20261008142647.KLKLBLDC.js","./parte.20261008142647.2HEPPYZK.js","./parte.20261008142647.FWIXU47X.js","./parte.20261008142647.NLD4OCGF.js","./parte.20261008142647.ERHQECID.js","./parte.20261008142647.SILLXAUO.js","./parte.20261008142647.SZNCIUU7.js","./parte.20261008142647.EZWHIT6Z.js","./parte.20261008142647.DV2OC35Y.js","./parte.20261008142647.TQ4WXJEI.js","./parte.20261008142647.AJBCZBOQ.js","./parte.20261008142647.H52ZCWRF.js","./parte.20261008142647.HXCKJPOK.js","./parte.20261008142647.FQHKME4M.js","./parte.20261008142647.M4NALPRW.js","./parte.20261008142647.FVFO4QVJ.js","./parte.20261008142647.O6YTIFO2.js","./parte.20261008142647.AI4JLSIS.js","./parte.20261008142647.RZV7IAB3.js","./parte.20261008142647.HQNIMAIW.js","./parte.20261008142647.OF3V5EVA.js","./parte.20261008142647.SLWN3JHA.js","./parte.20261008142647.XXVCI6Z7.js","./parte.20261008142647.AOV7L2GT.js","./parte.20261008142647.T44IDIJB.js","./parte.20261008142647.HESTZQH6.js","./parte.20261008142647.E2RPD2KO.js","./parte.20261008142647.D46CWLBG.js","./parte.20261008142647.HFW7PNO4.js","./parte.20261008142647.IGNQSEGQ.js","./parte.20261008142647.AEGSJHHH.js","./parte.20261008142647.25I4YUZI.js","./parte.20261008142647.EPO4EFEA.js","./parte.20261008142647.THRE5MFH.js","./parte.20261008142647.ZWAUFEW5.js","./parte.20261008142647.JI27XGQI.js","./parte.20261008142647.FM5MPUUH.js","./manifest.webmanifest","./fontes/inter.20261008142647.woff2","./estilo.20261008142647.css","./tarefas.20261008142647.js","./oficina.20261008142647.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008142647.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
