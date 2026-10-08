// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008160946';
const ARQUIVOS = ["./","./index.html","./parte.20261008160946.CQQ2TSCM.js","./parte.20261008160946.F5H2EWVW.js","./parte.20261008160946.VRL7GDGZ.js","./parte.20261008160946.BMDNUFK2.js","./parte.20261008160946.M6DMIH62.js","./parte.20261008160946.D22TPV5A.js","./parte.20261008160946.WZTGFGRD.js","./parte.20261008160946.MNYLE6XI.js","./parte.20261008160946.USYZSRER.js","./parte.20261008160946.4VGRB63J.js","./parte.20261008160946.4UTGD37R.js","./parte.20261008160946.Q3MX6J4X.js","./parte.20261008160946.NUEGUJWZ.js","./parte.20261008160946.LY6WS2FU.js","./parte.20261008160946.SDVOSUDB.js","./parte.20261008160946.S6ZYS572.js","./parte.20261008160946.OPPC6YNJ.js","./parte.20261008160946.GCYASKAU.js","./parte.20261008160946.CZDYEXKH.js","./parte.20261008160946.U2OQNDZH.js","./parte.20261008160946.J5XOVUDL.js","./parte.20261008160946.634DJPNY.js","./parte.20261008160946.SVSJRIKV.js","./parte.20261008160946.FVFZTRLY.js","./parte.20261008160946.GPBX4UK5.js","./parte.20261008160946.GBZVJWKJ.js","./parte.20261008160946.ZGT4EYYJ.js","./parte.20261008160946.G675CL3V.js","./parte.20261008160946.ST2PL5I2.js","./parte.20261008160946.HXCOOK4P.js","./parte.20261008160946.HPW7ISRD.js","./parte.20261008160946.2DOLLNSI.js","./parte.20261008160946.OWVT7M7P.js","./parte.20261008160946.R7LRXA6T.js","./parte.20261008160946.QPYQ4EWU.js","./parte.20261008160946.ZOHPGPMK.js","./parte.20261008160946.GJR4UKL6.js","./parte.20261008160946.C723D5R2.js","./parte.20261008160946.6KXWLYXB.js","./parte.20261008160946.YDMGGJ47.js","./parte.20261008160946.M6BDEQY3.js","./parte.20261008160946.6A7ROCIH.js","./parte.20261008160946.AYC2P3Y3.js","./parte.20261008160946.JBUJG3JP.js","./jogo.20261008160946.js","./parte.20261008160946.VQVVBL3L.js","./parte.20261008160946.X4MRMGL4.js","./parte.20261008160946.YWGC2QDZ.js","./parte.20261008160946.2JUB5W3F.js","./parte.20261008160946.O7DR4A53.js","./parte.20261008160946.FSRTK66R.js","./parte.20261008160946.4IBD7KOE.js","./parte.20261008160946.NMTHONVF.js","./parte.20261008160946.AX3QG7DA.js","./parte.20261008160946.FKKXWCOZ.js","./parte.20261008160946.T4OQ76ZA.js","./parte.20261008160946.5IYC7MPB.js","./parte.20261008160946.GXBKI6JA.js","./parte.20261008160946.67643H3V.js","./parte.20261008160946.7EYYZW4U.js","./parte.20261008160946.FRM6XF4S.js","./parte.20261008160946.ULY5RZOF.js","./parte.20261008160946.22PV57NV.js","./parte.20261008160946.RMFKXF4Z.js","./parte.20261008160946.WTO2ATRR.js","./parte.20261008160946.I36LH5V4.js","./parte.20261008160946.74MELLGQ.js","./parte.20261008160946.W2LAWO5Z.js","./parte.20261008160946.3WP5UBA5.js","./parte.20261008160946.L2B5MS7Q.js","./parte.20261008160946.HSZKNACJ.js","./parte.20261008160946.RAQTLKPD.js","./parte.20261008160946.6UOPL4ZL.js","./parte.20261008160946.U2PY2YJ5.js","./parte.20261008160946.DPD7LTJZ.js","./parte.20261008160946.OKU6UW5E.js","./parte.20261008160946.PLFONTPK.js","./parte.20261008160946.LW2EM6E7.js","./parte.20261008160946.YVE2RCHY.js","./parte.20261008160946.OLPOATKC.js","./parte.20261008160946.NJUQV4NZ.js","./parte.20261008160946.C2JAZ2UD.js","./parte.20261008160946.YIWTLAYH.js","./parte.20261008160946.AT3UHPRH.js","./parte.20261008160946.OOIQ3YVQ.js","./parte.20261008160946.5R4QXPT2.js","./parte.20261008160946.U36P7HXT.js","./parte.20261008160946.GP6AWJCQ.js","./parte.20261008160946.TCBUS4Y2.js","./parte.20261008160946.6THNMY5G.js","./parte.20261008160946.VOHR6XF3.js","./parte.20261008160946.Q2WXH5AG.js","./parte.20261008160946.JIHQX6JG.js","./parte.20261008160946.L6VDFO7B.js","./parte.20261008160946.HFH4Q5MS.js","./parte.20261008160946.4MUE7RBU.js","./parte.20261008160946.SK5ET4TF.js","./parte.20261008160946.TH7A7TBQ.js","./parte.20261008160946.H3CNUZ2Q.js","./parte.20261008160946.BAZ4KC7O.js","./parte.20261008160946.JDCFTTJF.js","./parte.20261008160946.IWO5JLM4.js","./parte.20261008160946.DLIV5DGG.js","./parte.20261008160946.B7FTLZ6W.js","./parte.20261008160946.G2G4YXJI.js","./parte.20261008160946.4QYHH356.js","./parte.20261008160946.K7XQM5VG.js","./parte.20261008160946.GAAH5NNA.js","./parte.20261008160946.LAQ4FCR6.js","./parte.20261008160946.UI4UAYMF.js","./parte.20261008160946.P7ULXWUJ.js","./parte.20261008160946.IZWMT7XN.js","./parte.20261008160946.HQ2LOFW6.js","./parte.20261008160946.T6BKXNR7.js","./parte.20261008160946.Z66M35CQ.js","./parte.20261008160946.XSSATG43.js","./parte.20261008160946.ZPNFYCTK.js","./parte.20261008160946.NGZRC6J2.js","./parte.20261008160946.3NAIHDIT.js","./parte.20261008160946.D6NHDGEK.js","./manifest.webmanifest","./fontes/inter.20261008160946.woff2","./estilo.20261008160946.css","./tarefas.20261008160946.js","./oficina.20261008160946.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008160946.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
