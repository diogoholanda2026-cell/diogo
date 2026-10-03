// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261003212558';
const ARQUIVOS = ["./","./index.html","./parte.20261003212558.PWD3Q2OT.js","./parte.20261003212558.QUIOGGYB.js","./parte.20261003212558.OY6XL5IF.js","./parte.20261003212558.5RB6KHNX.js","./parte.20261003212558.PT7SJHDL.js","./parte.20261003212558.WKC3MXJW.js","./parte.20261003212558.FJOSA66Q.js","./parte.20261003212558.TPUQSQIO.js","./parte.20261003212558.SO6LFU6E.js","./parte.20261003212558.FGBKSJUN.js","./parte.20261003212558.HKQ6SNIH.js","./parte.20261003212558.2FVIZJME.js","./parte.20261003212558.QFLWM6CB.js","./parte.20261003212558.KYP5XX2L.js","./parte.20261003212558.JGBB354N.js","./parte.20261003212558.PH62HCTG.js","./parte.20261003212558.H3AWLMKS.js","./parte.20261003212558.AWZKY6SA.js","./parte.20261003212558.5HPVJIHN.js","./parte.20261003212558.5T3E5ZXV.js","./parte.20261003212558.IGXXK3ZZ.js","./parte.20261003212558.CSUDMLCO.js","./parte.20261003212558.AG5KNHYO.js","./parte.20261003212558.EVEJKHMZ.js","./parte.20261003212558.LV3O3B3C.js","./parte.20261003212558.F3FUCB52.js","./parte.20261003212558.XSGFPUWY.js","./parte.20261003212558.OXDIRGFT.js","./parte.20261003212558.CGSHVXFI.js","./parte.20261003212558.45RZMOVM.js","./parte.20261003212558.KZKQOSZW.js","./parte.20261003212558.MMRB4FRO.js","./parte.20261003212558.GDCUM7JD.js","./parte.20261003212558.BA4WUHPQ.js","./parte.20261003212558.2E73X6PO.js","./parte.20261003212558.CKOV6V7V.js","./parte.20261003212558.2PMUK5RP.js","./parte.20261003212558.TKHN52PT.js","./parte.20261003212558.UKVDOTMW.js","./parte.20261003212558.R26HMDSU.js","./parte.20261003212558.LJBITK7K.js","./parte.20261003212558.D4BAVNS7.js","./jogo.20261003212558.js","./parte.20261003212558.J7G3MRBW.js","./parte.20261003212558.5AQ3P52Q.js","./parte.20261003212558.KZCZA56R.js","./parte.20261003212558.OAWL5AEA.js","./parte.20261003212558.A2WILLKM.js","./parte.20261003212558.5ISVVS6W.js","./parte.20261003212558.77YBGPBF.js","./parte.20261003212558.SUYGXVW7.js","./parte.20261003212558.WTWVZ65C.js","./parte.20261003212558.6XD7BZXS.js","./parte.20261003212558.2RJU5HG6.js","./parte.20261003212558.RP2QIHPR.js","./parte.20261003212558.G2OBGKNW.js","./parte.20261003212558.N5MECWWP.js","./parte.20261003212558.ZMF7GHXG.js","./parte.20261003212558.P4AY6WJ4.js","./parte.20261003212558.GLBVWJZS.js","./parte.20261003212558.HOGZZVOW.js","./parte.20261003212558.WBXVHL4R.js","./parte.20261003212558.IPCLF2Y7.js","./parte.20261003212558.JLH2E4JU.js","./parte.20261003212558.SIDZWPFN.js","./parte.20261003212558.4OGT4IYQ.js","./parte.20261003212558.Y4GBJX7C.js","./parte.20261003212558.PM6QKFG7.js","./parte.20261003212558.URCKN6KX.js","./parte.20261003212558.BQ5VROY3.js","./parte.20261003212558.EFFGZ47M.js","./parte.20261003212558.HOOGV2LM.js","./parte.20261003212558.K2DKQ2MC.js","./parte.20261003212558.JGUDKA42.js","./parte.20261003212558.ECU73KTZ.js","./parte.20261003212558.FZWOO65M.js","./parte.20261003212558.B2DHK7MW.js","./parte.20261003212558.VCPCQV6A.js","./parte.20261003212558.4XSQ4RNL.js","./parte.20261003212558.2LYXNL6P.js","./parte.20261003212558.WQ3ROWDB.js","./parte.20261003212558.NHK46RLX.js","./parte.20261003212558.MUFGIWTT.js","./parte.20261003212558.B3JRBPYP.js","./parte.20261003212558.72DAPONS.js","./parte.20261003212558.7UURG33N.js","./parte.20261003212558.47NUJYQ7.js","./parte.20261003212558.K475HHEX.js","./parte.20261003212558.Y5NY7AYC.js","./parte.20261003212558.F74CD2OK.js","./parte.20261003212558.J7CB3OFG.js","./parte.20261003212558.NP6PDYZJ.js","./parte.20261003212558.SPRAF4IN.js","./parte.20261003212558.76UCWMRX.js","./parte.20261003212558.UVHGP3ZY.js","./parte.20261003212558.FNHKT4QH.js","./parte.20261003212558.DMMIM4XE.js","./parte.20261003212558.QQHIGJGS.js","./parte.20261003212558.XUIUYHIJ.js","./parte.20261003212558.NJWUFWEV.js","./parte.20261003212558.AWJSLJ24.js","./parte.20261003212558.JJ23VQ63.js","./parte.20261003212558.IET76KQ7.js","./parte.20261003212558.5WIYEY3Q.js","./parte.20261003212558.AKXUPJCD.js","./parte.20261003212558.AFM2SZCN.js","./parte.20261003212558.T3YKH3SC.js","./parte.20261003212558.J4C2BTTK.js","./parte.20261003212558.BL3UOIH2.js","./parte.20261003212558.UP6XVJAL.js","./parte.20261003212558.FOF2MGNU.js","./parte.20261003212558.5TJP73GS.js","./parte.20261003212558.MZSB6OC6.js","./parte.20261003212558.ROPLBJLA.js","./manifest.webmanifest","./fontes/inter.20261003212558.woff2","./estilo.20261003212558.css","./tarefas.20261003212558.js","./oficina.20261003212558.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261003212558.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
