// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261016123846';
const ARQUIVOS = ["./","./index.html","./parte.20261016123846.UHLR4GTE.js","./parte.20261016123846.NZ7AS6AP.js","./parte.20261016123846.AKZIWN3F.js","./parte.20261016123846.4BB5QUBN.js","./parte.20261016123846.44NP6JCY.js","./parte.20261016123846.27DVG2Q7.js","./parte.20261016123846.OAOYWCOT.js","./parte.20261016123846.LG6Y2DUL.js","./parte.20261016123846.UCZYGT2J.js","./parte.20261016123846.NUHRKIZB.js","./parte.20261016123846.OI3MMIHJ.js","./parte.20261016123846.MOHLZFKD.js","./parte.20261016123846.RUD6NDT7.js","./parte.20261016123846.BZBCWQHI.js","./parte.20261016123846.7VIV6XSL.js","./parte.20261016123846.GAHXW2WH.js","./parte.20261016123846.DXKW3COT.js","./parte.20261016123846.QQYOSYIU.js","./parte.20261016123846.YL2XDCHM.js","./parte.20261016123846.AMHASJTI.js","./parte.20261016123846.JQLD2DKO.js","./parte.20261016123846.NECEER6A.js","./parte.20261016123846.H7XAVKP3.js","./parte.20261016123846.7NNLLGWN.js","./parte.20261016123846.GT6ATE7R.js","./parte.20261016123846.RFADG4G2.js","./parte.20261016123846.RWUKUQEZ.js","./parte.20261016123846.HID4SYPB.js","./parte.20261016123846.LLGII77D.js","./parte.20261016123846.W2YVBQ7T.js","./parte.20261016123846.KXESNEVD.js","./parte.20261016123846.KYUHQ2GS.js","./parte.20261016123846.JBR6UN3Q.js","./parte.20261016123846.WM2UM477.js","./parte.20261016123846.6KI44DDV.js","./parte.20261016123846.7WA2KZM5.js","./parte.20261016123846.CII4BBWK.js","./parte.20261016123846.VAVV3ZY6.js","./parte.20261016123846.FFJOWX3X.js","./parte.20261016123846.HAEG47MV.js","./parte.20261016123846.UUJSGOSG.js","./parte.20261016123846.Q7Y24NGT.js","./parte.20261016123846.MRFPTWJ6.js","./jogo.20261016123846.js","./parte.20261016123846.2DUW3TRV.js","./parte.20261016123846.O75BM7FU.js","./parte.20261016123846.4247N2LR.js","./parte.20261016123846.AYRCN2UC.js","./parte.20261016123846.XMERDWE3.js","./parte.20261016123846.UGUEGQVS.js","./parte.20261016123846.L5CCIDWV.js","./parte.20261016123846.Z5E6O2VM.js","./parte.20261016123846.BLT7ZTSU.js","./parte.20261016123846.T4ZPX6XQ.js","./parte.20261016123846.FXBCGCD6.js","./parte.20261016123846.TKTGYOTJ.js","./parte.20261016123846.JQLNOWGO.js","./parte.20261016123846.HHFNRU7H.js","./parte.20261016123846.5UBAPNWX.js","./parte.20261016123846.X2BMNEFY.js","./parte.20261016123846.KG6J55RT.js","./parte.20261016123846.XTI6W24W.js","./parte.20261016123846.AJ73T2E3.js","./parte.20261016123846.CBMIBBK4.js","./parte.20261016123846.CQ4NXJBX.js","./parte.20261016123846.NB7HXF4T.js","./parte.20261016123846.VMOI7Z7M.js","./parte.20261016123846.USQ35LYA.js","./parte.20261016123846.VYH4G4AQ.js","./parte.20261016123846.CZ6IQZ3Q.js","./parte.20261016123846.7DM4AMJC.js","./parte.20261016123846.MPFDXCIP.js","./parte.20261016123846.JNDBA4NS.js","./parte.20261016123846.7BFWH4YZ.js","./parte.20261016123846.D5ZFMZ4N.js","./parte.20261016123846.TXW7Z2KB.js","./parte.20261016123846.W4XM3YMD.js","./parte.20261016123846.3372OVCS.js","./parte.20261016123846.TO46XPYK.js","./parte.20261016123846.BR7BLCWW.js","./parte.20261016123846.B2H42FOU.js","./parte.20261016123846.DY3H5COA.js","./parte.20261016123846.GKAYFENE.js","./parte.20261016123846.WJAWPTWN.js","./parte.20261016123846.44WFT6NH.js","./parte.20261016123846.Q3C2BXYK.js","./parte.20261016123846.RZWUCKVC.js","./parte.20261016123846.4I3JFGRH.js","./parte.20261016123846.RLFJQOLF.js","./parte.20261016123846.ZIFVH4LX.js","./parte.20261016123846.ZFBJ34IY.js","./parte.20261016123846.RJZF4NFT.js","./parte.20261016123846.K5HQNAB6.js","./parte.20261016123846.KHQAB6JS.js","./parte.20261016123846.GJQWZ3VQ.js","./parte.20261016123846.T6FUP7EI.js","./parte.20261016123846.CT2NBH5M.js","./parte.20261016123846.2ALBPTYM.js","./parte.20261016123846.PXUDJXZR.js","./parte.20261016123846.S5GCSATT.js","./parte.20261016123846.NLQEKUYH.js","./parte.20261016123846.W5Y6CKA5.js","./parte.20261016123846.6GTPRYKV.js","./parte.20261016123846.VNKGO7HP.js","./parte.20261016123846.WET3JDK7.js","./parte.20261016123846.ZFVKBMAA.js","./parte.20261016123846.32B25QNR.js","./parte.20261016123846.4XEU4TGW.js","./parte.20261016123846.TCJF5MIQ.js","./parte.20261016123846.KCG6DKYD.js","./parte.20261016123846.XZBUVUBU.js","./parte.20261016123846.C6LNB4U5.js","./parte.20261016123846.REFKGKZL.js","./parte.20261016123846.UOGJXJEH.js","./parte.20261016123846.5O7BZXCA.js","./parte.20261016123846.SNTMSCXY.js","./parte.20261016123846.PHBJBG2M.js","./parte.20261016123846.SED5R7EB.js","./parte.20261016123846.BZAHMDOP.js","./parte.20261016123846.67FOQIFU.js","./manifest.webmanifest","./fontes/inter.20261016123846.woff2","./estilo.20261016123846.css","./tarefas.20261016123846.js","./oficina.20261016123846.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261016123846.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
