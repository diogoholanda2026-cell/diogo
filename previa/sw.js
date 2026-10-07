// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261007063107';
const ARQUIVOS = ["./","./index.html","./parte.20261007063107.L5TYU7XZ.js","./parte.20261007063107.H2Z7LLK4.js","./parte.20261007063107.DTHEGBL6.js","./parte.20261007063107.WP26WX2W.js","./parte.20261007063107.6YFYOWA6.js","./parte.20261007063107.3YH4PLUM.js","./parte.20261007063107.GWEZXAL2.js","./parte.20261007063107.XQF5NNQH.js","./parte.20261007063107.LPFWPHA4.js","./parte.20261007063107.RUS2FP2X.js","./parte.20261007063107.YKCN3LHB.js","./parte.20261007063107.PRSKQ5JX.js","./parte.20261007063107.ZPOF5MYE.js","./parte.20261007063107.VK6BT425.js","./parte.20261007063107.4OIJBARO.js","./parte.20261007063107.WLYOMJTW.js","./parte.20261007063107.OADYA7ES.js","./parte.20261007063107.BBCFOSVK.js","./parte.20261007063107.BVZRFOMJ.js","./parte.20261007063107.BODU2CYX.js","./parte.20261007063107.J4EOKGVQ.js","./parte.20261007063107.37MIOY7D.js","./parte.20261007063107.BIA6INFN.js","./parte.20261007063107.MM3CFMXW.js","./parte.20261007063107.66OHM6CE.js","./parte.20261007063107.MOQTISYK.js","./parte.20261007063107.V73PNE6S.js","./parte.20261007063107.QWTSZVHR.js","./parte.20261007063107.IMGYFZOB.js","./parte.20261007063107.T2FMMAOL.js","./parte.20261007063107.YZEYRYRM.js","./parte.20261007063107.CXNMNQM2.js","./parte.20261007063107.JAENYQ6J.js","./parte.20261007063107.EV3ZHWGF.js","./parte.20261007063107.NINW66FC.js","./parte.20261007063107.WY2Y2EVO.js","./parte.20261007063107.RNG2CLPO.js","./parte.20261007063107.2JZW5T5J.js","./parte.20261007063107.5LJMR75O.js","./parte.20261007063107.VKXAMGLC.js","./parte.20261007063107.H7XICAR3.js","./parte.20261007063107.ZNBFVHRS.js","./parte.20261007063107.CS6WGDML.js","./jogo.20261007063107.js","./parte.20261007063107.37FP4GJN.js","./parte.20261007063107.DJM3LGFN.js","./parte.20261007063107.IWDSWURH.js","./parte.20261007063107.UVISS3KY.js","./parte.20261007063107.OA42TBQN.js","./parte.20261007063107.6JDTM4OQ.js","./parte.20261007063107.LR3Q3ZTR.js","./parte.20261007063107.4OTDPGT3.js","./parte.20261007063107.6HOBT4LW.js","./parte.20261007063107.FHA4UUES.js","./parte.20261007063107.VW6X4FEV.js","./parte.20261007063107.6OFTFHNW.js","./parte.20261007063107.N7MV4VGS.js","./parte.20261007063107.7IH7SJK5.js","./parte.20261007063107.DRVO6DMZ.js","./parte.20261007063107.BC4EWV5F.js","./parte.20261007063107.GFYWTYDM.js","./parte.20261007063107.7AHF4ZIK.js","./parte.20261007063107.J4VXPZ3X.js","./parte.20261007063107.BALILKF3.js","./parte.20261007063107.K3TEORX5.js","./parte.20261007063107.TIGAGGH2.js","./parte.20261007063107.TJ5ZMEDI.js","./parte.20261007063107.4N4PENRC.js","./parte.20261007063107.WF45TSFS.js","./parte.20261007063107.CGMLFCWE.js","./parte.20261007063107.WUKRCJ2K.js","./parte.20261007063107.4DUHIQQ3.js","./parte.20261007063107.IGKO6W5E.js","./parte.20261007063107.NYF2PWZA.js","./parte.20261007063107.D2JAJK4M.js","./parte.20261007063107.54HAOAQ6.js","./parte.20261007063107.UGYHU4DH.js","./parte.20261007063107.VUP6C6ER.js","./parte.20261007063107.TR64NCTX.js","./parte.20261007063107.BAULQSRU.js","./parte.20261007063107.FVY5O2ZA.js","./parte.20261007063107.TT2EP7OP.js","./parte.20261007063107.UFOETLCE.js","./parte.20261007063107.TSXYNAYO.js","./parte.20261007063107.AXJORSOJ.js","./parte.20261007063107.I663N26R.js","./parte.20261007063107.7UOLXDHC.js","./parte.20261007063107.4PW3TNV3.js","./parte.20261007063107.GZ2ZR4ZX.js","./parte.20261007063107.DUT3UX5J.js","./parte.20261007063107.IYQEFFEZ.js","./parte.20261007063107.IUWSC7RB.js","./parte.20261007063107.HOYRHGGA.js","./parte.20261007063107.RXZDEXGW.js","./parte.20261007063107.S2PAHCSD.js","./parte.20261007063107.RD5AAR55.js","./parte.20261007063107.AKB24UKR.js","./parte.20261007063107.L5AGFPFV.js","./parte.20261007063107.SRQ2QGFP.js","./parte.20261007063107.C27D2G3J.js","./parte.20261007063107.YVMTHBUR.js","./parte.20261007063107.M3PA4EIO.js","./parte.20261007063107.SAQX62YY.js","./parte.20261007063107.JIGKUU4S.js","./parte.20261007063107.5JHPLQY4.js","./parte.20261007063107.JFYFCPNB.js","./parte.20261007063107.OEHL754M.js","./parte.20261007063107.QT45X7SM.js","./parte.20261007063107.K44SAYOC.js","./parte.20261007063107.SSO6XQRC.js","./parte.20261007063107.ULTO4XWT.js","./parte.20261007063107.C3B3DZR7.js","./parte.20261007063107.BJVUJ6KF.js","./parte.20261007063107.27PAKTHW.js","./parte.20261007063107.HEDD53BA.js","./parte.20261007063107.TABVXZFM.js","./parte.20261007063107.LJEO5OMW.js","./parte.20261007063107.PHRNTZMQ.js","./manifest.webmanifest","./fontes/inter.20261007063107.woff2","./estilo.20261007063107.css","./tarefas.20261007063107.js","./oficina.20261007063107.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261007063107.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
