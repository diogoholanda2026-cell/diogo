// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008082041';
const ARQUIVOS = ["./","./index.html","./parte.20261008082041.CEG6FIFD.js","./parte.20261008082041.HU2Z46HD.js","./parte.20261008082041.BTRORGWM.js","./parte.20261008082041.7T4EQP52.js","./parte.20261008082041.TTXYEGWZ.js","./parte.20261008082041.IXAYMUGK.js","./parte.20261008082041.5PRK7JZN.js","./parte.20261008082041.ZNCMT4BP.js","./parte.20261008082041.6FKCQGZ4.js","./parte.20261008082041.2DSWUCDA.js","./parte.20261008082041.4JCHNWDW.js","./parte.20261008082041.EMCFV7JF.js","./parte.20261008082041.CM4LQJHK.js","./parte.20261008082041.2RWC5DAI.js","./parte.20261008082041.TJBDFFSQ.js","./parte.20261008082041.UVNFYGLK.js","./parte.20261008082041.RQCPMFG5.js","./parte.20261008082041.RDJLARAZ.js","./parte.20261008082041.H5W2DUZ7.js","./parte.20261008082041.RNN6BWWM.js","./parte.20261008082041.3BTNX6RK.js","./parte.20261008082041.JQ3IBQHS.js","./parte.20261008082041.ZRG5A26S.js","./parte.20261008082041.4UXRXX7S.js","./parte.20261008082041.42B53T3P.js","./parte.20261008082041.BFZC4RYY.js","./parte.20261008082041.F2VGSKD4.js","./parte.20261008082041.KMDDOYNZ.js","./parte.20261008082041.WQCK7L6N.js","./parte.20261008082041.OPGW3LCO.js","./parte.20261008082041.XBQDDKFT.js","./parte.20261008082041.XH3H4MTD.js","./parte.20261008082041.OL5OTFNV.js","./parte.20261008082041.Q6TA3XAI.js","./parte.20261008082041.6HXEFIAP.js","./parte.20261008082041.DZWMK2DX.js","./parte.20261008082041.ZVPXUTH2.js","./parte.20261008082041.DM52G2AH.js","./parte.20261008082041.RA7MMTNP.js","./parte.20261008082041.S4FL455T.js","./parte.20261008082041.LWKNAUHS.js","./parte.20261008082041.MLQ2EUSR.js","./parte.20261008082041.J3YGGBZA.js","./parte.20261008082041.L5NLCBIX.js","./jogo.20261008082041.js","./parte.20261008082041.7OJQ6VNI.js","./parte.20261008082041.FVXNNELM.js","./parte.20261008082041.HPVU4V2Z.js","./parte.20261008082041.NWDMU352.js","./parte.20261008082041.C3OYUP7D.js","./parte.20261008082041.742YPUAD.js","./parte.20261008082041.NAMAPNQZ.js","./parte.20261008082041.GEHSPP7F.js","./parte.20261008082041.EYTPYEEA.js","./parte.20261008082041.BWBTLCDI.js","./parte.20261008082041.VWKEEVER.js","./parte.20261008082041.6RQBLO4K.js","./parte.20261008082041.57ME7TIL.js","./parte.20261008082041.7FWT64SK.js","./parte.20261008082041.PKUKEKAO.js","./parte.20261008082041.AGSCLMYG.js","./parte.20261008082041.LA233OOJ.js","./parte.20261008082041.L3VRHRMN.js","./parte.20261008082041.UL7J6KPS.js","./parte.20261008082041.3QSBBNYI.js","./parte.20261008082041.2Z26JVAR.js","./parte.20261008082041.DO4EZOGN.js","./parte.20261008082041.VUG5XJOJ.js","./parte.20261008082041.QJSU3R57.js","./parte.20261008082041.FOQ5E2UL.js","./parte.20261008082041.SFJZUQM2.js","./parte.20261008082041.VECMFO7Y.js","./parte.20261008082041.OSGXHYGO.js","./parte.20261008082041.DMP24ONA.js","./parte.20261008082041.EE7UHKQ5.js","./parte.20261008082041.F5VPWNGY.js","./parte.20261008082041.J4GSKFFP.js","./parte.20261008082041.HJTEGB24.js","./parte.20261008082041.XFSPA26T.js","./parte.20261008082041.7744STTN.js","./parte.20261008082041.7IIQ3RVF.js","./parte.20261008082041.G6POZE2Z.js","./parte.20261008082041.OF5JAVOL.js","./parte.20261008082041.5JDSW7LW.js","./parte.20261008082041.2XN7V3QD.js","./parte.20261008082041.KUA6SHJ7.js","./parte.20261008082041.K3YW44QE.js","./parte.20261008082041.7XMCP56W.js","./parte.20261008082041.EICKP76D.js","./parte.20261008082041.B42SZSCI.js","./parte.20261008082041.VWEH2YE2.js","./parte.20261008082041.RV7XQEE5.js","./parte.20261008082041.2D3JAQV4.js","./parte.20261008082041.YFEZ6P54.js","./parte.20261008082041.UPDWSTGL.js","./parte.20261008082041.YYLWJHRB.js","./parte.20261008082041.EVII5RES.js","./parte.20261008082041.HM4GSOYF.js","./parte.20261008082041.Y5D6A6EE.js","./parte.20261008082041.63755PWZ.js","./parte.20261008082041.J6P25YOA.js","./parte.20261008082041.3N5EWELO.js","./parte.20261008082041.N6NRMIW2.js","./parte.20261008082041.ZOEKWH3E.js","./parte.20261008082041.2TYEZEEG.js","./parte.20261008082041.XZNID7KV.js","./parte.20261008082041.5AYR54DL.js","./parte.20261008082041.IMY45BGN.js","./parte.20261008082041.7NBDHBOJ.js","./parte.20261008082041.VLFM25O5.js","./parte.20261008082041.LQ4NHWOB.js","./parte.20261008082041.B4KCS4KI.js","./parte.20261008082041.XTOD5MRK.js","./parte.20261008082041.YNXX7ISW.js","./parte.20261008082041.MAIYI2L4.js","./parte.20261008082041.BJ7WDQT7.js","./parte.20261008082041.AFHRAEUF.js","./parte.20261008082041.XOPTUR6J.js","./parte.20261008082041.EAWDQ6SH.js","./parte.20261008082041.4XXNKBHM.js","./parte.20261008082041.PRW26WNA.js","./manifest.webmanifest","./fontes/inter.20261008082041.woff2","./estilo.20261008082041.css","./tarefas.20261008082041.js","./oficina.20261008082041.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008082041.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
