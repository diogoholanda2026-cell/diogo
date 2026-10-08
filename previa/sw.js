// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008152546';
const ARQUIVOS = ["./","./index.html","./parte.20261008152546.TXTJN45F.js","./parte.20261008152546.LYEMDMZQ.js","./parte.20261008152546.KWFGZMF2.js","./parte.20261008152546.JQEUN6Y5.js","./parte.20261008152546.C4ZAQDE2.js","./parte.20261008152546.L755QOFS.js","./parte.20261008152546.LRNFZ4IA.js","./parte.20261008152546.YB4G46ZH.js","./parte.20261008152546.PZULRXUH.js","./parte.20261008152546.AQEBQDPN.js","./parte.20261008152546.MTL44B32.js","./parte.20261008152546.GBPXUGPF.js","./parte.20261008152546.GGPINIWG.js","./parte.20261008152546.FBIB66Y5.js","./parte.20261008152546.EYZRC56Z.js","./parte.20261008152546.JQRFT4X5.js","./parte.20261008152546.W72TOOJH.js","./parte.20261008152546.23DE35DO.js","./parte.20261008152546.7AJZMAZV.js","./parte.20261008152546.5THNOCPD.js","./parte.20261008152546.SM43YVBH.js","./parte.20261008152546.HM7KJYDS.js","./parte.20261008152546.SQMCR3Q6.js","./parte.20261008152546.TO6RZVWD.js","./parte.20261008152546.TDD3LLQH.js","./parte.20261008152546.K73PL3AI.js","./parte.20261008152546.IRFEAJWC.js","./parte.20261008152546.HHNAGUFH.js","./parte.20261008152546.3JT3GLRT.js","./parte.20261008152546.YN2B5IUX.js","./parte.20261008152546.INATAQ3Y.js","./parte.20261008152546.L7JUZYJC.js","./parte.20261008152546.MPDN7B2K.js","./parte.20261008152546.XFMRGWGI.js","./parte.20261008152546.7M5Q2XL7.js","./parte.20261008152546.XTTJMMI2.js","./parte.20261008152546.EDBSFV25.js","./parte.20261008152546.W2Y4IUQH.js","./parte.20261008152546.NOWHO5GP.js","./parte.20261008152546.WQTEN7U5.js","./parte.20261008152546.6TCAL4AY.js","./parte.20261008152546.LHNGBYQ7.js","./parte.20261008152546.JEMZPTJ4.js","./parte.20261008152546.MGNQ5ZGV.js","./jogo.20261008152546.js","./parte.20261008152546.SRCG7R7Z.js","./parte.20261008152546.EBE57AMS.js","./parte.20261008152546.JYFORDVQ.js","./parte.20261008152546.MC6GZC77.js","./parte.20261008152546.YDALC6DP.js","./parte.20261008152546.HOFDOHWI.js","./parte.20261008152546.6VGGEJPV.js","./parte.20261008152546.N3DC7LZN.js","./parte.20261008152546.5JH4D3ZL.js","./parte.20261008152546.RBBUDNYD.js","./parte.20261008152546.5WIHZO7D.js","./parte.20261008152546.BZ3DWU2N.js","./parte.20261008152546.UOKJ343V.js","./parte.20261008152546.HJAEL3PR.js","./parte.20261008152546.HZNN5A6K.js","./parte.20261008152546.FRPPETYG.js","./parte.20261008152546.MTUP36UZ.js","./parte.20261008152546.25CXWAA2.js","./parte.20261008152546.QOGZVUNV.js","./parte.20261008152546.XSZ3VZSC.js","./parte.20261008152546.7B7SKWME.js","./parte.20261008152546.AVTRZ4JJ.js","./parte.20261008152546.C47ZYYL2.js","./parte.20261008152546.7H5VYX57.js","./parte.20261008152546.OQIXU64R.js","./parte.20261008152546.FLKBSKPM.js","./parte.20261008152546.OAEITMZM.js","./parte.20261008152546.LY5YIFPK.js","./parte.20261008152546.RXBBRPE4.js","./parte.20261008152546.P4N6VPCQ.js","./parte.20261008152546.BQCAZNJV.js","./parte.20261008152546.BQH2KOP2.js","./parte.20261008152546.UUHCTFIB.js","./parte.20261008152546.6JGDLOZZ.js","./parte.20261008152546.5WTXIINI.js","./parte.20261008152546.2GXKNDTY.js","./parte.20261008152546.GNDXZHYI.js","./parte.20261008152546.R4VDATXX.js","./parte.20261008152546.MDAIAF6N.js","./parte.20261008152546.3ZSXXLEL.js","./parte.20261008152546.XVST6SMF.js","./parte.20261008152546.XSWZ3R7R.js","./parte.20261008152546.CZ4OG676.js","./parte.20261008152546.EHNOP2XJ.js","./parte.20261008152546.Q5OC6B7A.js","./parte.20261008152546.EGZYYMHW.js","./parte.20261008152546.V2BQRGFJ.js","./parte.20261008152546.DLT5WQWL.js","./parte.20261008152546.MIZH6OJZ.js","./parte.20261008152546.ODH6CERH.js","./parte.20261008152546.4E3FSWX4.js","./parte.20261008152546.JEAARAU6.js","./parte.20261008152546.LM7AUCBZ.js","./parte.20261008152546.PCAYLSAW.js","./parte.20261008152546.NVAKDUVD.js","./parte.20261008152546.TQ5GOZ2H.js","./parte.20261008152546.7PGJ3ILU.js","./parte.20261008152546.2UKC4VV3.js","./parte.20261008152546.7F2J7DFZ.js","./parte.20261008152546.YFIDMSSW.js","./parte.20261008152546.XEJEWR6U.js","./parte.20261008152546.LNM3FNKH.js","./parte.20261008152546.W7UFXOP3.js","./parte.20261008152546.ERJRBFQB.js","./parte.20261008152546.L4RQ2BDZ.js","./parte.20261008152546.BSARLVUA.js","./parte.20261008152546.3RGQGG4W.js","./parte.20261008152546.WL6A7VWD.js","./parte.20261008152546.QD44JKKY.js","./parte.20261008152546.F6FNM5ML.js","./parte.20261008152546.QOKVK4IK.js","./parte.20261008152546.KUTQEOGU.js","./parte.20261008152546.CVJNYZR3.js","./parte.20261008152546.MI6KOZ5H.js","./parte.20261008152546.KCLFY76H.js","./manifest.webmanifest","./fontes/inter.20261008152546.woff2","./estilo.20261008152546.css","./tarefas.20261008152546.js","./oficina.20261008152546.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008152546.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
