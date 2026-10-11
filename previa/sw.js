// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261011164121';
const ARQUIVOS = ["./","./index.html","./parte.20261011164121.CCJ65LXB.js","./parte.20261011164121.H2Y6AUPY.js","./parte.20261011164121.EFT65AGM.js","./parte.20261011164121.67TWUXCE.js","./parte.20261011164121.VU7Q2OVX.js","./parte.20261011164121.K2GCAY2C.js","./parte.20261011164121.NTF6EX47.js","./parte.20261011164121.W6RZEO2E.js","./parte.20261011164121.HZI6BNL6.js","./parte.20261011164121.CGUCWVX6.js","./parte.20261011164121.EH6LHIU7.js","./parte.20261011164121.UCUDHJJY.js","./parte.20261011164121.2QVVBDFW.js","./parte.20261011164121.VFRELXAK.js","./parte.20261011164121.CLKMKIBY.js","./parte.20261011164121.24INAK6U.js","./parte.20261011164121.QB6STZOF.js","./parte.20261011164121.7MAT5LDA.js","./parte.20261011164121.7ZWENARM.js","./parte.20261011164121.ASKUAIEB.js","./parte.20261011164121.SMILNKLA.js","./parte.20261011164121.Q2ZHOODK.js","./parte.20261011164121.ILIFFOU6.js","./parte.20261011164121.MRNKV7WE.js","./parte.20261011164121.FYAOHAS7.js","./parte.20261011164121.W4JNVLL7.js","./parte.20261011164121.GOEXZZCN.js","./parte.20261011164121.WHUNKKD4.js","./parte.20261011164121.PFXZIN63.js","./parte.20261011164121.M5EBZKVX.js","./parte.20261011164121.XD22IRF5.js","./parte.20261011164121.JWLCV7FE.js","./parte.20261011164121.NZUHGJVU.js","./parte.20261011164121.CZLXRUHN.js","./parte.20261011164121.F4JO2KN4.js","./parte.20261011164121.IXBY3R6O.js","./parte.20261011164121.U7HNUT6Z.js","./parte.20261011164121.CNWO5UDH.js","./parte.20261011164121.TO6QVIV7.js","./parte.20261011164121.GXZTULJK.js","./parte.20261011164121.CINLHOZH.js","./parte.20261011164121.JMYKQK5S.js","./parte.20261011164121.GHSE3ZLB.js","./parte.20261011164121.3BDGCFDA.js","./jogo.20261011164121.js","./parte.20261011164121.MDP5WPIS.js","./parte.20261011164121.K3Y4XYFY.js","./parte.20261011164121.WHYB52KJ.js","./parte.20261011164121.S4CLXR6N.js","./parte.20261011164121.FSJASHMG.js","./parte.20261011164121.CXRVS6O6.js","./parte.20261011164121.PDLQ6PUH.js","./parte.20261011164121.NATW3ZXW.js","./parte.20261011164121.NW6VMYIX.js","./parte.20261011164121.XAAWRVSE.js","./parte.20261011164121.IHGIJGKX.js","./parte.20261011164121.ATXKKYX6.js","./parte.20261011164121.WSFCGSKT.js","./parte.20261011164121.SOVAFYCP.js","./parte.20261011164121.MKSPHXFR.js","./parte.20261011164121.VPI56IOH.js","./parte.20261011164121.RVBWZK5L.js","./parte.20261011164121.6MR6SSQ7.js","./parte.20261011164121.NY5GT4ED.js","./parte.20261011164121.IXJG7BJ4.js","./parte.20261011164121.C3JPHDN4.js","./parte.20261011164121.5VEE7UNS.js","./parte.20261011164121.45EF2RNN.js","./parte.20261011164121.26ISUWLS.js","./parte.20261011164121.HZPISXXP.js","./parte.20261011164121.CZIDA6K7.js","./parte.20261011164121.SBGFYZV5.js","./parte.20261011164121.SUOFTWVE.js","./parte.20261011164121.XZ2HYYIY.js","./parte.20261011164121.KP3LMYNB.js","./parte.20261011164121.46P3EKLT.js","./parte.20261011164121.DXBHZDIV.js","./parte.20261011164121.MUXNT4OS.js","./parte.20261011164121.7QU64CE2.js","./parte.20261011164121.AOUY4DXG.js","./parte.20261011164121.P53JINTO.js","./parte.20261011164121.3IFYL2RO.js","./parte.20261011164121.NEE72NBD.js","./parte.20261011164121.KDGVCLU5.js","./parte.20261011164121.PCMHYXH4.js","./parte.20261011164121.3XEJVLY6.js","./parte.20261011164121.Q3BEKL3O.js","./parte.20261011164121.2D63ILAF.js","./parte.20261011164121.HMXIRPVN.js","./parte.20261011164121.5PZQD6O3.js","./parte.20261011164121.6VCTI2AH.js","./parte.20261011164121.NKE3ORVH.js","./parte.20261011164121.OYY74XNV.js","./parte.20261011164121.F2J7CAPM.js","./parte.20261011164121.FVEDMTSJ.js","./parte.20261011164121.UWPXS7CA.js","./parte.20261011164121.7GWFXZHG.js","./parte.20261011164121.TBRQ4Z5E.js","./parte.20261011164121.OTUJW6YS.js","./parte.20261011164121.U37JEJZY.js","./parte.20261011164121.GSMJYABK.js","./parte.20261011164121.MSE6XAUL.js","./parte.20261011164121.FCON6VUT.js","./parte.20261011164121.N3NWLBGB.js","./parte.20261011164121.RWKE2Z7I.js","./parte.20261011164121.VYQ2QRSS.js","./parte.20261011164121.3WU3IAR4.js","./parte.20261011164121.4QS4VWZN.js","./parte.20261011164121.WFSML6UM.js","./parte.20261011164121.2PE4ZM3I.js","./parte.20261011164121.3NWR444B.js","./parte.20261011164121.QCYAAYNP.js","./parte.20261011164121.HHKOT7C6.js","./parte.20261011164121.NZA3A2BW.js","./parte.20261011164121.REXXLASV.js","./parte.20261011164121.QYF5FHLO.js","./parte.20261011164121.P5WGFIR3.js","./parte.20261011164121.WNW3QCQ7.js","./parte.20261011164121.ZGOOY3JM.js","./parte.20261011164121.LHY3PMMX.js","./manifest.webmanifest","./fontes/inter.20261011164121.woff2","./estilo.20261011164121.css","./tarefas.20261011164121.js","./oficina.20261011164121.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261011164121.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
