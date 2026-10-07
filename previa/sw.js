// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261007075045';
const ARQUIVOS = ["./","./index.html","./parte.20261007075045.FZPW6WA6.js","./parte.20261007075045.VYKUASSP.js","./parte.20261007075045.4ADSCIW2.js","./parte.20261007075045.TSV6DU6B.js","./parte.20261007075045.VHKQ7V7N.js","./parte.20261007075045.UWVH44BM.js","./parte.20261007075045.MS6WB67B.js","./parte.20261007075045.B5L2TIZH.js","./parte.20261007075045.2BWTZBWJ.js","./parte.20261007075045.J7CVUZT2.js","./parte.20261007075045.BYWPC7FF.js","./parte.20261007075045.INDXO4XX.js","./parte.20261007075045.S2LJDP5C.js","./parte.20261007075045.EZDFORFZ.js","./parte.20261007075045.H6E3VKWT.js","./parte.20261007075045.NOHKLZC6.js","./parte.20261007075045.I374HL3I.js","./parte.20261007075045.66BF5RXV.js","./parte.20261007075045.7L2PIVA2.js","./parte.20261007075045.QOSRFZPW.js","./parte.20261007075045.VDBYBFF4.js","./parte.20261007075045.I6KEELSQ.js","./parte.20261007075045.NWAJIVLK.js","./parte.20261007075045.KUQZ66QV.js","./parte.20261007075045.TJ4IVKGZ.js","./parte.20261007075045.2EA2CVNO.js","./parte.20261007075045.PEU6YNON.js","./parte.20261007075045.RZPNI3GT.js","./parte.20261007075045.PCRMKQ52.js","./parte.20261007075045.6BI6OIYC.js","./parte.20261007075045.N52RU46R.js","./parte.20261007075045.V72DAJ6U.js","./parte.20261007075045.ZETM2WLH.js","./parte.20261007075045.EWJNZ2SW.js","./parte.20261007075045.C6JE3UU5.js","./parte.20261007075045.ZWQZXSGN.js","./parte.20261007075045.CRESV4HT.js","./parte.20261007075045.A4SGKXHD.js","./parte.20261007075045.X6FZCQQJ.js","./parte.20261007075045.BSJUONOY.js","./parte.20261007075045.IXUI44HU.js","./parte.20261007075045.4OSL5SWU.js","./parte.20261007075045.GHBAFJEQ.js","./parte.20261007075045.BZNHEOBN.js","./jogo.20261007075045.js","./parte.20261007075045.Y7ORRZYX.js","./parte.20261007075045.QBZF37BM.js","./parte.20261007075045.I2ZLG76Q.js","./parte.20261007075045.2QQ6AG4L.js","./parte.20261007075045.4X7SL7PO.js","./parte.20261007075045.JDIXLM7W.js","./parte.20261007075045.QS24TKAL.js","./parte.20261007075045.SXYLLUGA.js","./parte.20261007075045.FGFJLQYD.js","./parte.20261007075045.5YDUKDR2.js","./parte.20261007075045.T75BBXLU.js","./parte.20261007075045.5KVEMUF6.js","./parte.20261007075045.7F4HOZOD.js","./parte.20261007075045.P7HIXMTS.js","./parte.20261007075045.ES5HEVPS.js","./parte.20261007075045.QPNSJM4W.js","./parte.20261007075045.B2PBK3VW.js","./parte.20261007075045.Z4U2BTBM.js","./parte.20261007075045.6HAGSU7Y.js","./parte.20261007075045.435AAPJI.js","./parte.20261007075045.NRYSHUZP.js","./parte.20261007075045.QGPZYW3L.js","./parte.20261007075045.YSOCV55J.js","./parte.20261007075045.D75FXFKD.js","./parte.20261007075045.QAT5XDHV.js","./parte.20261007075045.2NPTHMZP.js","./parte.20261007075045.FU4Z7PAH.js","./parte.20261007075045.G7P33MSI.js","./parte.20261007075045.W4XCKV4R.js","./parte.20261007075045.I7XWQNN6.js","./parte.20261007075045.EVQYT2R5.js","./parte.20261007075045.HEI2RY2F.js","./parte.20261007075045.HUNZV5KA.js","./parte.20261007075045.L6TICSY4.js","./parte.20261007075045.6FJ6SMMI.js","./parte.20261007075045.5PTKU4U2.js","./parte.20261007075045.OT2W4PU3.js","./parte.20261007075045.AJAB5EV3.js","./parte.20261007075045.YYNR4JPZ.js","./parte.20261007075045.3BD4BHES.js","./parte.20261007075045.5Z3NRCYP.js","./parte.20261007075045.AWARMDTC.js","./parte.20261007075045.L4NWYBVV.js","./parte.20261007075045.ZO2A5NCM.js","./parte.20261007075045.7SI2BQF4.js","./parte.20261007075045.AM3DDSOD.js","./parte.20261007075045.7B246KMZ.js","./parte.20261007075045.BT2AWDN3.js","./parte.20261007075045.OGFO43LE.js","./parte.20261007075045.KBY65GUM.js","./parte.20261007075045.J4KQ4KMX.js","./parte.20261007075045.BNSVFT73.js","./parte.20261007075045.GTSO4PGT.js","./parte.20261007075045.RBW4QXLH.js","./parte.20261007075045.BEUL6WII.js","./parte.20261007075045.3KKHBS4J.js","./parte.20261007075045.BNF6UZCT.js","./parte.20261007075045.DISKZGMK.js","./parte.20261007075045.GQ5NKRRR.js","./parte.20261007075045.6K2ONEBF.js","./parte.20261007075045.Z3XQWZ6J.js","./parte.20261007075045.3CHMK36A.js","./parte.20261007075045.TBD5MFHP.js","./parte.20261007075045.O6LFSGXP.js","./parte.20261007075045.O5PEMXC6.js","./parte.20261007075045.IIY3YUEZ.js","./parte.20261007075045.WTDIQW6F.js","./parte.20261007075045.EHECXUHE.js","./parte.20261007075045.FMDAVSES.js","./parte.20261007075045.WZPRDP3P.js","./parte.20261007075045.YCRHSEZH.js","./parte.20261007075045.JLGBLLJ5.js","./parte.20261007075045.TXG4L7L6.js","./parte.20261007075045.AW3HXYR7.js","./parte.20261007075045.JJSIUG4A.js","./parte.20261007075045.2O3A5OBU.js","./manifest.webmanifest","./fontes/inter.20261007075045.woff2","./estilo.20261007075045.css","./tarefas.20261007075045.js","./oficina.20261007075045.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261007075045.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
