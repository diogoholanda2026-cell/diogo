// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008140106';
const ARQUIVOS = ["./","./index.html","./parte.20261008140106.CIOHIEF5.js","./parte.20261008140106.JYKPNRAN.js","./parte.20261008140106.SRRTAMP4.js","./parte.20261008140106.443VGCYS.js","./parte.20261008140106.EIFS4EVD.js","./parte.20261008140106.V574ZZ3L.js","./parte.20261008140106.STOTBYOV.js","./parte.20261008140106.I2LD2NFV.js","./parte.20261008140106.KXXT5CFZ.js","./parte.20261008140106.SYTS3BDJ.js","./parte.20261008140106.NIT4C5EX.js","./parte.20261008140106.VHANGS43.js","./parte.20261008140106.4KN3TFJU.js","./parte.20261008140106.HUBRB44M.js","./parte.20261008140106.LL76QGKN.js","./parte.20261008140106.HITJS44U.js","./parte.20261008140106.E52DWL62.js","./parte.20261008140106.DYHRUW4Q.js","./parte.20261008140106.GHJKM447.js","./parte.20261008140106.B42MVANB.js","./parte.20261008140106.77KYSFGO.js","./parte.20261008140106.NWSI3ZUD.js","./parte.20261008140106.SNXBOHWX.js","./parte.20261008140106.CBMWT7DR.js","./parte.20261008140106.6GXQGDQF.js","./parte.20261008140106.GYVNJE52.js","./parte.20261008140106.TUWQQX27.js","./parte.20261008140106.JLTJ3ZTC.js","./parte.20261008140106.7WVL3R3C.js","./parte.20261008140106.VPJUL2GH.js","./parte.20261008140106.GKBUIHWZ.js","./parte.20261008140106.BU44UQD2.js","./parte.20261008140106.C46HQPHU.js","./parte.20261008140106.OLRN2TF2.js","./parte.20261008140106.47DJF2JI.js","./parte.20261008140106.XIIHMP6A.js","./parte.20261008140106.UUT2K2GK.js","./parte.20261008140106.L4V4RIMT.js","./parte.20261008140106.OBODAC64.js","./parte.20261008140106.O5QVI4Z7.js","./parte.20261008140106.6ULGPLYI.js","./parte.20261008140106.XEWE6UV3.js","./parte.20261008140106.PHDA3CRF.js","./parte.20261008140106.3VLXL6ER.js","./jogo.20261008140106.js","./parte.20261008140106.SX6OGXQT.js","./parte.20261008140106.SMF7A4MO.js","./parte.20261008140106.FYDLDN4G.js","./parte.20261008140106.UV3VPH3K.js","./parte.20261008140106.3CGU4YQV.js","./parte.20261008140106.3FQKLOLG.js","./parte.20261008140106.UUWV4JMF.js","./parte.20261008140106.CAWXO2WO.js","./parte.20261008140106.CK2D5M7Z.js","./parte.20261008140106.OSTQG7UH.js","./parte.20261008140106.456IARMU.js","./parte.20261008140106.7XEGTGAQ.js","./parte.20261008140106.MP2QWHJB.js","./parte.20261008140106.HXN3ENTX.js","./parte.20261008140106.7GFT5ZBE.js","./parte.20261008140106.M3MQYPOQ.js","./parte.20261008140106.J7SPY5RB.js","./parte.20261008140106.OZUDOH6U.js","./parte.20261008140106.RS6GT7NE.js","./parte.20261008140106.3XS445A2.js","./parte.20261008140106.XHHLPAU6.js","./parte.20261008140106.BADNNBY4.js","./parte.20261008140106.VR35NRDM.js","./parte.20261008140106.ARJVMOSU.js","./parte.20261008140106.7PFFO7QX.js","./parte.20261008140106.MGGQNXRE.js","./parte.20261008140106.RP7QRDAY.js","./parte.20261008140106.GSVX2WOJ.js","./parte.20261008140106.MB5GGODX.js","./parte.20261008140106.KV42LTZT.js","./parte.20261008140106.M7GDLTV2.js","./parte.20261008140106.N7FUEPH4.js","./parte.20261008140106.FUKB2AA7.js","./parte.20261008140106.DVSK42BZ.js","./parte.20261008140106.VCGVLTRQ.js","./parte.20261008140106.JZEEURJG.js","./parte.20261008140106.2KBF6U5H.js","./parte.20261008140106.ZG2WKVZ3.js","./parte.20261008140106.METPDO5L.js","./parte.20261008140106.G7CIITDM.js","./parte.20261008140106.AKO6PKKE.js","./parte.20261008140106.T47DAT34.js","./parte.20261008140106.OD7TYCAE.js","./parte.20261008140106.U7TB3YLT.js","./parte.20261008140106.UW5XTDZV.js","./parte.20261008140106.ZY3BZVKB.js","./parte.20261008140106.3YRGSDBH.js","./parte.20261008140106.GJXLIVT6.js","./parte.20261008140106.RXWFAGIL.js","./parte.20261008140106.OPHEPTUY.js","./parte.20261008140106.EW2ZP3R5.js","./parte.20261008140106.QMZ5NMX3.js","./parte.20261008140106.7RD5DISE.js","./parte.20261008140106.ZZ7KJLUT.js","./parte.20261008140106.DSP5RVWV.js","./parte.20261008140106.7PPFRQVY.js","./parte.20261008140106.EJHOX2JE.js","./parte.20261008140106.H3UCKULX.js","./parte.20261008140106.M6ZXB3CM.js","./parte.20261008140106.MEK4LU7J.js","./parte.20261008140106.UNR7DCRN.js","./parte.20261008140106.5RFYBT5X.js","./parte.20261008140106.LRRTFZZH.js","./parte.20261008140106.U5D3A6X2.js","./parte.20261008140106.3O2LZXCC.js","./parte.20261008140106.R27MHOPN.js","./parte.20261008140106.HME2ASF5.js","./parte.20261008140106.WFXPL4J2.js","./parte.20261008140106.NBSRUFDS.js","./parte.20261008140106.BFWMTUPY.js","./parte.20261008140106.XEZ7DC5Q.js","./parte.20261008140106.NT6YFYDQ.js","./parte.20261008140106.5ZWTURLY.js","./parte.20261008140106.DZEF4CB6.js","./parte.20261008140106.RI4SDEP4.js","./manifest.webmanifest","./fontes/inter.20261008140106.woff2","./estilo.20261008140106.css","./tarefas.20261008140106.js","./oficina.20261008140106.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008140106.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
