// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008084323';
const ARQUIVOS = ["./","./index.html","./parte.20261008084323.BU46LZVD.js","./parte.20261008084323.SVIXUKTY.js","./parte.20261008084323.QWARO6XT.js","./parte.20261008084323.27O35NNU.js","./parte.20261008084323.7VCW2TXO.js","./parte.20261008084323.TG2GNYEB.js","./parte.20261008084323.7F6YAXKM.js","./parte.20261008084323.QAU5DBGM.js","./parte.20261008084323.VOZKAIFL.js","./parte.20261008084323.JLSHXZRC.js","./parte.20261008084323.MRYVFQNC.js","./parte.20261008084323.R7CYKSYL.js","./parte.20261008084323.HXMIZI4O.js","./parte.20261008084323.O67EZDE2.js","./parte.20261008084323.KH2QOFGQ.js","./parte.20261008084323.XJ2OQGMU.js","./parte.20261008084323.JWJDPUNL.js","./parte.20261008084323.HHOL6OBG.js","./parte.20261008084323.5LXHARPQ.js","./parte.20261008084323.P4SS7GQ7.js","./parte.20261008084323.GUI6WZ4B.js","./parte.20261008084323.Y365VVWK.js","./parte.20261008084323.JRXFIBEU.js","./parte.20261008084323.WG67XCL4.js","./parte.20261008084323.FYFIBSR4.js","./parte.20261008084323.XMPZ3ANC.js","./parte.20261008084323.NQOW2RPC.js","./parte.20261008084323.MZYXJ2KS.js","./parte.20261008084323.DZYUXSXQ.js","./parte.20261008084323.AOUWXGG3.js","./parte.20261008084323.H552PEM4.js","./parte.20261008084323.YJKPZ57M.js","./parte.20261008084323.HSBETOHG.js","./parte.20261008084323.H6YP2BRT.js","./parte.20261008084323.K4YXKU2D.js","./parte.20261008084323.TVFK3V5A.js","./parte.20261008084323.RIZBCHFS.js","./parte.20261008084323.E6XAD6UZ.js","./parte.20261008084323.XDPW7KDD.js","./parte.20261008084323.PDTQXH2P.js","./parte.20261008084323.3JF726DS.js","./parte.20261008084323.TX2BPIKL.js","./parte.20261008084323.VQAD6AQZ.js","./parte.20261008084323.FHVD3LNK.js","./jogo.20261008084323.js","./parte.20261008084323.K6U54D65.js","./parte.20261008084323.THTOGNCP.js","./parte.20261008084323.XZAGRF53.js","./parte.20261008084323.F64MBS66.js","./parte.20261008084323.QSF5FICT.js","./parte.20261008084323.QURXVG2D.js","./parte.20261008084323.J6CZW3SY.js","./parte.20261008084323.IKFZLMPH.js","./parte.20261008084323.GPUC6TEE.js","./parte.20261008084323.KCZ744AS.js","./parte.20261008084323.ZVJ2J4IY.js","./parte.20261008084323.AHSYYG74.js","./parte.20261008084323.VN4RRKKY.js","./parte.20261008084323.5HA3NZTG.js","./parte.20261008084323.LXBSQPEL.js","./parte.20261008084323.7DT53CYU.js","./parte.20261008084323.XLSNIJ6P.js","./parte.20261008084323.SAAQE5WL.js","./parte.20261008084323.NC2PD7KD.js","./parte.20261008084323.Q2GQEJ67.js","./parte.20261008084323.CGIUCP73.js","./parte.20261008084323.45P7CIOQ.js","./parte.20261008084323.IIVXM43E.js","./parte.20261008084323.RBDHTPHR.js","./parte.20261008084323.SSEMXK3U.js","./parte.20261008084323.6X277BMG.js","./parte.20261008084323.MEEHHF74.js","./parte.20261008084323.HQKIFK47.js","./parte.20261008084323.IHEJ5VT4.js","./parte.20261008084323.FXCGWQAN.js","./parte.20261008084323.NHVO34NM.js","./parte.20261008084323.SVIE73TP.js","./parte.20261008084323.CVVYTI32.js","./parte.20261008084323.WR2UCG3Y.js","./parte.20261008084323.TQTFNQIO.js","./parte.20261008084323.V5CLLEKG.js","./parte.20261008084323.4R454VYS.js","./parte.20261008084323.U35OR3CL.js","./parte.20261008084323.ZIRHKZSY.js","./parte.20261008084323.DZK4MIFR.js","./parte.20261008084323.6FS4I54B.js","./parte.20261008084323.M7NQSS3O.js","./parte.20261008084323.AAVFSNAN.js","./parte.20261008084323.5TGMQYIL.js","./parte.20261008084323.JYKT7WYY.js","./parte.20261008084323.L4UYPJI7.js","./parte.20261008084323.IENFGDXG.js","./parte.20261008084323.E3DTK46V.js","./parte.20261008084323.YF4XWB4A.js","./parte.20261008084323.HCHGWEBO.js","./parte.20261008084323.TA7WA7RF.js","./parte.20261008084323.CQHUPIZR.js","./parte.20261008084323.AIFKCYBK.js","./parte.20261008084323.EAWY42EM.js","./parte.20261008084323.ADIHUPPG.js","./parte.20261008084323.OL3YI7RK.js","./parte.20261008084323.2F4FNY55.js","./parte.20261008084323.NMAYDSYO.js","./parte.20261008084323.DVT3E7WA.js","./parte.20261008084323.RWVHLWED.js","./parte.20261008084323.ADI3HNEL.js","./parte.20261008084323.6SQCBLXW.js","./parte.20261008084323.SY3AOBIN.js","./parte.20261008084323.YMZ2O5GV.js","./parte.20261008084323.IEHDR7PE.js","./parte.20261008084323.HEUN72KP.js","./parte.20261008084323.7445HA5U.js","./parte.20261008084323.T7S6LHXB.js","./parte.20261008084323.KTNZRHJC.js","./parte.20261008084323.A4IHGERX.js","./parte.20261008084323.PNVYD2IX.js","./parte.20261008084323.5TRBXOBK.js","./parte.20261008084323.SUM4DGE2.js","./parte.20261008084323.2YTXRNGK.js","./parte.20261008084323.EJ7MKSEQ.js","./parte.20261008084323.7C7X7BTY.js","./manifest.webmanifest","./fontes/inter.20261008084323.woff2","./estilo.20261008084323.css","./tarefas.20261008084323.js","./oficina.20261008084323.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008084323.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
