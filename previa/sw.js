// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008091606';
const ARQUIVOS = ["./","./index.html","./parte.20261008091606.X44PTE2D.js","./parte.20261008091606.AXLBD3WE.js","./parte.20261008091606.U4JVGNRF.js","./parte.20261008091606.U4S6BGFK.js","./parte.20261008091606.RX54EK6V.js","./parte.20261008091606.TBALHE3L.js","./parte.20261008091606.NIOSBG36.js","./parte.20261008091606.44Q3IVUB.js","./parte.20261008091606.FSBWGQLA.js","./parte.20261008091606.6KA7IFZD.js","./parte.20261008091606.NDI7HXFV.js","./parte.20261008091606.IK6HIRCI.js","./parte.20261008091606.VTGJYCKQ.js","./parte.20261008091606.UOTBR23U.js","./parte.20261008091606.GBBTBNX5.js","./parte.20261008091606.OP2NGWUA.js","./parte.20261008091606.Q7COPFGG.js","./parte.20261008091606.6MSNK4AA.js","./parte.20261008091606.S72R5WUJ.js","./parte.20261008091606.ECKGF7VW.js","./parte.20261008091606.G7R372HA.js","./parte.20261008091606.XTJVEJFH.js","./parte.20261008091606.RGHLBSJL.js","./parte.20261008091606.SAJ7FT5N.js","./parte.20261008091606.VYITBPIG.js","./parte.20261008091606.ZSWXP7CM.js","./parte.20261008091606.ARYQ4OLC.js","./parte.20261008091606.VIANDBRR.js","./parte.20261008091606.5S54XHHE.js","./parte.20261008091606.E577YZ3J.js","./parte.20261008091606.RHKQ6FAS.js","./parte.20261008091606.YJ5TJS7X.js","./parte.20261008091606.EPILVXNY.js","./parte.20261008091606.Z4B7WZEL.js","./parte.20261008091606.4QOVZFJQ.js","./parte.20261008091606.5NPXWIVQ.js","./parte.20261008091606.GBG2EXZH.js","./parte.20261008091606.6CNPZU4Z.js","./parte.20261008091606.JGPIDA6Y.js","./parte.20261008091606.5EQT5ISK.js","./parte.20261008091606.YCFGEQRC.js","./parte.20261008091606.5UD4EYGY.js","./parte.20261008091606.7YEWDOPN.js","./parte.20261008091606.5YCZNCJJ.js","./jogo.20261008091606.js","./parte.20261008091606.YPL76BGT.js","./parte.20261008091606.A6HF4O3J.js","./parte.20261008091606.U3VZZSNV.js","./parte.20261008091606.PJ5YUOBM.js","./parte.20261008091606.SHSHELF6.js","./parte.20261008091606.FFXI2XMZ.js","./parte.20261008091606.FOLZSEPP.js","./parte.20261008091606.G2Q4ELGU.js","./parte.20261008091606.FI7TBHB2.js","./parte.20261008091606.JSNJADKD.js","./parte.20261008091606.VQNNL474.js","./parte.20261008091606.VEX5QVTA.js","./parte.20261008091606.QMVWBI2A.js","./parte.20261008091606.YS6RI6IG.js","./parte.20261008091606.PHFEXTJ7.js","./parte.20261008091606.V5ZSUGGE.js","./parte.20261008091606.B4FB7M7O.js","./parte.20261008091606.SHBG4G2O.js","./parte.20261008091606.Z2FSSL7C.js","./parte.20261008091606.BRW7AR22.js","./parte.20261008091606.D3HEWPIG.js","./parte.20261008091606.CB6ZTUOH.js","./parte.20261008091606.YQW4MJD2.js","./parte.20261008091606.7WPSLOTF.js","./parte.20261008091606.IWC4I4V2.js","./parte.20261008091606.R6LIID5O.js","./parte.20261008091606.5CYM5OGX.js","./parte.20261008091606.UNIEFVZ4.js","./parte.20261008091606.7BQJCJ3W.js","./parte.20261008091606.R5N7Y2JH.js","./parte.20261008091606.T4QJJJFM.js","./parte.20261008091606.7DXPB7VV.js","./parte.20261008091606.LJEPC3UO.js","./parte.20261008091606.5EXJV5TD.js","./parte.20261008091606.Z3QBJNUR.js","./parte.20261008091606.LRDC2HAV.js","./parte.20261008091606.OMNSO6OV.js","./parte.20261008091606.MQ3UXALA.js","./parte.20261008091606.GGSDMOPK.js","./parte.20261008091606.XPPL3GGP.js","./parte.20261008091606.IECAFZCB.js","./parte.20261008091606.AK5MYGBU.js","./parte.20261008091606.IMXNB2BB.js","./parte.20261008091606.EJNHSYFC.js","./parte.20261008091606.E754MTKC.js","./parte.20261008091606.J2OM47CU.js","./parte.20261008091606.GFAT6R33.js","./parte.20261008091606.LSUR6N2O.js","./parte.20261008091606.67H4YXV3.js","./parte.20261008091606.NIFNPVLI.js","./parte.20261008091606.5LNAPSCW.js","./parte.20261008091606.SLPCCMOU.js","./parte.20261008091606.YPCMD7ZT.js","./parte.20261008091606.TZ3W5RJW.js","./parte.20261008091606.L5ZR3GRY.js","./parte.20261008091606.WUDETCUW.js","./parte.20261008091606.6LTHHHYO.js","./parte.20261008091606.3K2QZEJU.js","./parte.20261008091606.4CQI3RUM.js","./parte.20261008091606.UZZL6HD6.js","./parte.20261008091606.Z7Z6ULJX.js","./parte.20261008091606.YM4EX2O6.js","./parte.20261008091606.DHOFHOTE.js","./parte.20261008091606.YBAL4BJK.js","./parte.20261008091606.GD74T5CQ.js","./parte.20261008091606.E33SWFW3.js","./parte.20261008091606.4LUIVNTS.js","./parte.20261008091606.JJKBHUNL.js","./parte.20261008091606.ONNBZB4A.js","./parte.20261008091606.UDXQBTHJ.js","./parte.20261008091606.DYWUCKYN.js","./parte.20261008091606.UHWJLKAU.js","./parte.20261008091606.ZHXSGNNI.js","./parte.20261008091606.UALP746T.js","./parte.20261008091606.VN46CMCQ.js","./parte.20261008091606.QU2MMYSS.js","./parte.20261008091606.7ULJH7AE.js","./manifest.webmanifest","./fontes/inter.20261008091606.woff2","./estilo.20261008091606.css","./tarefas.20261008091606.js","./oficina.20261008091606.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008091606.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
