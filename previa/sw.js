// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261003164736';
const ARQUIVOS = ["./","./index.html","./parte.20261003164736.FAX22ZHM.js","./parte.20261003164736.OQPZREIY.js","./parte.20261003164736.FD2ZSUNW.js","./parte.20261003164736.FJPIVDKG.js","./parte.20261003164736.VYR355NP.js","./parte.20261003164736.OWEDUPMR.js","./parte.20261003164736.SNVK62TI.js","./parte.20261003164736.6NK5W6JK.js","./parte.20261003164736.QH2LER2U.js","./parte.20261003164736.IF7NFIDT.js","./parte.20261003164736.JQCSOLFR.js","./parte.20261003164736.ADOFPH2B.js","./parte.20261003164736.4IURJCSX.js","./parte.20261003164736.SLUXHGQV.js","./parte.20261003164736.MCEMXL7D.js","./parte.20261003164736.TYDIEJPU.js","./parte.20261003164736.UJLYE2UH.js","./parte.20261003164736.JWJMHXYU.js","./parte.20261003164736.CSL5LTXC.js","./parte.20261003164736.EUOKDFSE.js","./parte.20261003164736.DZPZOCUJ.js","./parte.20261003164736.AP3T2EI5.js","./parte.20261003164736.5PYOQJ3U.js","./parte.20261003164736.EGD5Y7R3.js","./parte.20261003164736.FWEKQMWC.js","./parte.20261003164736.3ZMAISNO.js","./parte.20261003164736.L4RG62PG.js","./parte.20261003164736.5GIGJPFF.js","./parte.20261003164736.AKD37RIJ.js","./parte.20261003164736.5R3RI4EU.js","./parte.20261003164736.PODP6JHC.js","./parte.20261003164736.MDMAKB5E.js","./parte.20261003164736.6W2PHMQI.js","./parte.20261003164736.KTZ6A2NR.js","./parte.20261003164736.WST6JAE2.js","./parte.20261003164736.OKFGZZYH.js","./parte.20261003164736.XRYB3S5J.js","./parte.20261003164736.5UVRWJ7R.js","./parte.20261003164736.AXVPDGZM.js","./parte.20261003164736.VB5VJE35.js","./parte.20261003164736.PQWQ36YT.js","./parte.20261003164736.YYX6JUJS.js","./jogo.20261003164736.js","./parte.20261003164736.7DCQ6NLS.js","./parte.20261003164736.AZID5WOB.js","./parte.20261003164736.4T627GJ6.js","./parte.20261003164736.X2ZQLPIW.js","./parte.20261003164736.LJBC3VAK.js","./parte.20261003164736.NL5Y6AAA.js","./parte.20261003164736.HUNQCA7T.js","./parte.20261003164736.VKJZ6AYV.js","./parte.20261003164736.66X4WTFP.js","./parte.20261003164736.WN6GESKC.js","./parte.20261003164736.O4G2DRKH.js","./parte.20261003164736.HLGEJGUZ.js","./parte.20261003164736.IENMNMFL.js","./parte.20261003164736.UHOPPTV7.js","./parte.20261003164736.T4BCR5R5.js","./parte.20261003164736.T2X7SS5K.js","./parte.20261003164736.KPAVWES3.js","./parte.20261003164736.LL7C6FYG.js","./parte.20261003164736.27J4ENSO.js","./parte.20261003164736.5NIOT6PE.js","./parte.20261003164736.QFWA2I5D.js","./parte.20261003164736.BAKQLUP4.js","./parte.20261003164736.EOMB4DXI.js","./parte.20261003164736.5YPC6HDG.js","./parte.20261003164736.T43S3RTR.js","./parte.20261003164736.2IEDVVIS.js","./parte.20261003164736.VMBJCZQO.js","./parte.20261003164736.5SHXLSPE.js","./parte.20261003164736.YJKREXG4.js","./parte.20261003164736.DCBFO55C.js","./parte.20261003164736.DN65FUZX.js","./parte.20261003164736.3OK6GMYL.js","./parte.20261003164736.DJKNEYDS.js","./parte.20261003164736.UMAXVJ2U.js","./parte.20261003164736.RBWLL4AO.js","./parte.20261003164736.OT2RXIL7.js","./parte.20261003164736.2PYQVP6X.js","./parte.20261003164736.LC4MO7P3.js","./parte.20261003164736.MWSPTRF4.js","./parte.20261003164736.ZSU2VDET.js","./parte.20261003164736.VS23AGX7.js","./parte.20261003164736.XFGRCFVK.js","./parte.20261003164736.GN3A4QGR.js","./parte.20261003164736.626KTCSA.js","./parte.20261003164736.B3JRA7LV.js","./parte.20261003164736.PJXHVA3V.js","./parte.20261003164736.QSQS76SA.js","./parte.20261003164736.QN4OUOIW.js","./parte.20261003164736.MNQ3OTON.js","./parte.20261003164736.6GPFD4P6.js","./parte.20261003164736.IRUQ4CPX.js","./parte.20261003164736.4DM4VKAK.js","./parte.20261003164736.RH2YLU3Y.js","./parte.20261003164736.NMEXSK5Q.js","./parte.20261003164736.H4IAQTMX.js","./parte.20261003164736.2NDNMURS.js","./parte.20261003164736.G2U2DLGK.js","./parte.20261003164736.WT52KBJY.js","./parte.20261003164736.IECZNNIU.js","./parte.20261003164736.R26FBQTY.js","./parte.20261003164736.E2ADICRA.js","./parte.20261003164736.ZXYSI6BH.js","./parte.20261003164736.JJOM6PR2.js","./parte.20261003164736.DHVGI7KV.js","./parte.20261003164736.73V33YGY.js","./parte.20261003164736.YFYR56BH.js","./parte.20261003164736.QCJW35RX.js","./parte.20261003164736.AR4X4Z3B.js","./parte.20261003164736.VQNULXWM.js","./parte.20261003164736.A62NGGRH.js","./parte.20261003164736.WK3CS2OT.js","./manifest.webmanifest","./fontes/inter.20261003164736.woff2","./estilo.20261003164736.css","./tarefas.20261003164736.js","./oficina.20261003164736.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261003164736.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
