// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008183604';
const ARQUIVOS = ["./","./index.html","./parte.20261008183604.XR3QPJSG.js","./parte.20261008183604.E3YUMDU3.js","./parte.20261008183604.6D22BTNF.js","./parte.20261008183604.DJFSTYZX.js","./parte.20261008183604.T6B7MOZE.js","./parte.20261008183604.GT3GP7F7.js","./parte.20261008183604.TKU4TPHO.js","./parte.20261008183604.IYP7GMMP.js","./parte.20261008183604.SA7WHKOE.js","./parte.20261008183604.HSCGLTNG.js","./parte.20261008183604.HTZLQJYR.js","./parte.20261008183604.TYNAPFQH.js","./parte.20261008183604.VMY76NCQ.js","./parte.20261008183604.7FYM6NOT.js","./parte.20261008183604.IGCAYGZG.js","./parte.20261008183604.ETD3YM4M.js","./parte.20261008183604.ZNNPMJ7P.js","./parte.20261008183604.UNL23JN3.js","./parte.20261008183604.K2HDWKJB.js","./parte.20261008183604.6XOUMIKR.js","./parte.20261008183604.B2YWVIPB.js","./parte.20261008183604.EXSRDRSF.js","./parte.20261008183604.YNHITI36.js","./parte.20261008183604.CGGFSZRP.js","./parte.20261008183604.L6AYGRMZ.js","./parte.20261008183604.D3VT5FDM.js","./parte.20261008183604.SA4SZN4A.js","./parte.20261008183604.ZSWRMXSR.js","./parte.20261008183604.RC2IBF5C.js","./parte.20261008183604.ZESBMDNL.js","./parte.20261008183604.GPABQI53.js","./parte.20261008183604.QQVBEIIP.js","./parte.20261008183604.JSMQBL2V.js","./parte.20261008183604.MFA5FERT.js","./parte.20261008183604.2RMD7A3A.js","./parte.20261008183604.IQ7MJGXV.js","./parte.20261008183604.KNXDQ5LT.js","./parte.20261008183604.WYWZNKFD.js","./parte.20261008183604.EJ7JXCA5.js","./parte.20261008183604.5OJK3OOQ.js","./parte.20261008183604.4AOPNSID.js","./parte.20261008183604.GMI3XORR.js","./parte.20261008183604.YSV6PWYN.js","./parte.20261008183604.ZUFROD4V.js","./jogo.20261008183604.js","./parte.20261008183604.DSX3HRWC.js","./parte.20261008183604.67QMSE6I.js","./parte.20261008183604.VY5BZWFH.js","./parte.20261008183604.DTGL4MJO.js","./parte.20261008183604.3JB6AKVQ.js","./parte.20261008183604.Q5BGDKNQ.js","./parte.20261008183604.FQJ4ESYD.js","./parte.20261008183604.HQKUHRP7.js","./parte.20261008183604.PFBXCWWB.js","./parte.20261008183604.VBCKPERB.js","./parte.20261008183604.VUHKR5WJ.js","./parte.20261008183604.QPJ3JNKA.js","./parte.20261008183604.2RLBWNPE.js","./parte.20261008183604.GSAVFVQ2.js","./parte.20261008183604.2M3QCIDM.js","./parte.20261008183604.2E2T72B7.js","./parte.20261008183604.TYHWYF5C.js","./parte.20261008183604.77OSMTXV.js","./parte.20261008183604.OK5GYWFD.js","./parte.20261008183604.XFLHUUWR.js","./parte.20261008183604.RWP4OOS2.js","./parte.20261008183604.HO4UEJ72.js","./parte.20261008183604.RVNSGTTM.js","./parte.20261008183604.BCFTN5XQ.js","./parte.20261008183604.IIQISK32.js","./parte.20261008183604.WNDGV5CC.js","./parte.20261008183604.TZQZ4ZYW.js","./parte.20261008183604.BB3DPGJ7.js","./parte.20261008183604.CKHJTBGC.js","./parte.20261008183604.V34R5Z5E.js","./parte.20261008183604.6DE22EPP.js","./parte.20261008183604.BB3ITGYE.js","./parte.20261008183604.SS37HQNW.js","./parte.20261008183604.GBYZVQBZ.js","./parte.20261008183604.L7TT5AAJ.js","./parte.20261008183604.BK6BSJ7L.js","./parte.20261008183604.QBZPGIBI.js","./parte.20261008183604.L6LNUJA5.js","./parte.20261008183604.OZOZWN2O.js","./parte.20261008183604.HQXIEDUM.js","./parte.20261008183604.JJVACQ67.js","./parte.20261008183604.2F3GY6OJ.js","./parte.20261008183604.IPHPCIN4.js","./parte.20261008183604.JGCAH6T7.js","./parte.20261008183604.NNSLYAD6.js","./parte.20261008183604.4OERNB5N.js","./parte.20261008183604.7OJT7A6M.js","./parte.20261008183604.YWNZGX3C.js","./parte.20261008183604.GIBZYGGN.js","./parte.20261008183604.GEJLWNBY.js","./parte.20261008183604.HMOHQZU2.js","./parte.20261008183604.NTO2TBFV.js","./parte.20261008183604.MCHI3VZI.js","./parte.20261008183604.A6GLLT7P.js","./parte.20261008183604.ZFPHOCR4.js","./parte.20261008183604.POIXDZIG.js","./parte.20261008183604.5FZCBIQO.js","./parte.20261008183604.H5FM6UR3.js","./parte.20261008183604.XMUN4BLH.js","./parte.20261008183604.J7KBGLKY.js","./parte.20261008183604.7NOEOJAS.js","./parte.20261008183604.OWGGVB4F.js","./parte.20261008183604.C6X3HJFF.js","./parte.20261008183604.EIHWX5C3.js","./parte.20261008183604.E7VHSAYY.js","./parte.20261008183604.ID2YS4RM.js","./parte.20261008183604.HLR5JRG5.js","./parte.20261008183604.GTMSDKET.js","./parte.20261008183604.S2PLY737.js","./parte.20261008183604.OYGPJWDA.js","./parte.20261008183604.SX6TGVWM.js","./parte.20261008183604.IUIXML24.js","./parte.20261008183604.4QCWQ6JQ.js","./parte.20261008183604.OHQ55C2B.js","./parte.20261008183604.2RPJNNMJ.js","./manifest.webmanifest","./fontes/inter.20261008183604.woff2","./estilo.20261008183604.css","./tarefas.20261008183604.js","./oficina.20261008183604.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008183604.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
