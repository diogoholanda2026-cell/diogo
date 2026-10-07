// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261007061355';
const ARQUIVOS = ["./","./index.html","./parte.20261007061355.CYE7QGGP.js","./parte.20261007061355.IY7YDCQN.js","./parte.20261007061355.UWSO5B47.js","./parte.20261007061355.P72GT6GT.js","./parte.20261007061355.FUIG3P44.js","./parte.20261007061355.WYPQV2MZ.js","./parte.20261007061355.ODKFPL2C.js","./parte.20261007061355.A7YJ6SH4.js","./parte.20261007061355.3OZ4QO57.js","./parte.20261007061355.JO5I3IUW.js","./parte.20261007061355.R4YVA6WM.js","./parte.20261007061355.64SX2KCC.js","./parte.20261007061355.QX3QPGNK.js","./parte.20261007061355.H7RZ63GK.js","./parte.20261007061355.WFJ7MACK.js","./parte.20261007061355.4FSNCDPG.js","./parte.20261007061355.JBWGHWSC.js","./parte.20261007061355.CYKUFJTX.js","./parte.20261007061355.OKI475KJ.js","./parte.20261007061355.KV5JJBGR.js","./parte.20261007061355.2AMI32CG.js","./parte.20261007061355.SSUD5WDS.js","./parte.20261007061355.RPYEGY7A.js","./parte.20261007061355.5EIY4QVI.js","./parte.20261007061355.KW33QYDH.js","./parte.20261007061355.ZRDG4XOF.js","./parte.20261007061355.FS43AKYV.js","./parte.20261007061355.DG5X73DB.js","./parte.20261007061355.WFSYSAW6.js","./parte.20261007061355.4NWQSVYB.js","./parte.20261007061355.D6JN5BKQ.js","./parte.20261007061355.GOMOBMKW.js","./parte.20261007061355.G5FQDFEL.js","./parte.20261007061355.SVBOM7D4.js","./parte.20261007061355.YC5CTYZG.js","./parte.20261007061355.K2C6M4JK.js","./parte.20261007061355.Z42X7S7Y.js","./parte.20261007061355.2B5VKLSU.js","./parte.20261007061355.JNLGUGJ3.js","./parte.20261007061355.P542MCPU.js","./parte.20261007061355.SESUHBDV.js","./parte.20261007061355.POO7J3MB.js","./parte.20261007061355.SNCTATUO.js","./jogo.20261007061355.js","./parte.20261007061355.U6PT2HWN.js","./parte.20261007061355.NN6QP3Z4.js","./parte.20261007061355.FPC6SO4P.js","./parte.20261007061355.AAROTXVU.js","./parte.20261007061355.6BHV4OD2.js","./parte.20261007061355.HMPMENCM.js","./parte.20261007061355.OH5FYXUX.js","./parte.20261007061355.EW3I2EQ4.js","./parte.20261007061355.GIXUSTTS.js","./parte.20261007061355.5CVECGPK.js","./parte.20261007061355.K7DFQILP.js","./parte.20261007061355.RUUVTPSF.js","./parte.20261007061355.33CH2HXA.js","./parte.20261007061355.EXYFMMOG.js","./parte.20261007061355.ZSIJCTJ5.js","./parte.20261007061355.S53KPYHJ.js","./parte.20261007061355.I67UF5KX.js","./parte.20261007061355.GQZDZ54O.js","./parte.20261007061355.SJPG3O36.js","./parte.20261007061355.RVTD44W3.js","./parte.20261007061355.QY32XNXU.js","./parte.20261007061355.NHFHDSBQ.js","./parte.20261007061355.A5FCPING.js","./parte.20261007061355.56I6SCXN.js","./parte.20261007061355.TQL75CQA.js","./parte.20261007061355.6F437CPT.js","./parte.20261007061355.ARO23OOX.js","./parte.20261007061355.3B4UDUMB.js","./parte.20261007061355.GHHIHPDN.js","./parte.20261007061355.I5XC3ZSE.js","./parte.20261007061355.JIIVIAPH.js","./parte.20261007061355.N6ZRC5OT.js","./parte.20261007061355.DCL7446Z.js","./parte.20261007061355.I3CQQOHI.js","./parte.20261007061355.IXSRSGKZ.js","./parte.20261007061355.WCOBLZBM.js","./parte.20261007061355.VFHY6E7U.js","./parte.20261007061355.EBPZYAP7.js","./parte.20261007061355.KQJMYKGH.js","./parte.20261007061355.2UC4FAUF.js","./parte.20261007061355.ANJSOZB4.js","./parte.20261007061355.UCFVNOR7.js","./parte.20261007061355.75ZCF6DI.js","./parte.20261007061355.EUNHAWLO.js","./parte.20261007061355.7BNYOACU.js","./parte.20261007061355.LP5AFVWN.js","./parte.20261007061355.ZM3IZ5MR.js","./parte.20261007061355.Z7RQF6VS.js","./parte.20261007061355.2TVVQOD5.js","./parte.20261007061355.YWIQSZYD.js","./parte.20261007061355.TEFR6HYC.js","./parte.20261007061355.JA2OGNJV.js","./parte.20261007061355.QJQA3BZ3.js","./parte.20261007061355.Y3FB22BN.js","./parte.20261007061355.FDLC2WN5.js","./parte.20261007061355.J7ASDXSY.js","./parte.20261007061355.SCGYOYYY.js","./parte.20261007061355.4ZSL75RN.js","./parte.20261007061355.HX64LM2B.js","./parte.20261007061355.MFW3HWF2.js","./parte.20261007061355.H63R4KGX.js","./parte.20261007061355.GACIKTKC.js","./parte.20261007061355.H2II4XB7.js","./parte.20261007061355.AWJNNDKP.js","./parte.20261007061355.ZNFEJEFB.js","./parte.20261007061355.VUSZS3BO.js","./parte.20261007061355.BMLKEHSE.js","./parte.20261007061355.MCNPPUNR.js","./parte.20261007061355.MBGUN52M.js","./parte.20261007061355.MDKXIUTE.js","./parte.20261007061355.7BR7B5MN.js","./parte.20261007061355.WBXBA7H3.js","./parte.20261007061355.OZ7DKSGT.js","./parte.20261007061355.54MQYNM5.js","./manifest.webmanifest","./fontes/inter.20261007061355.woff2","./estilo.20261007061355.css","./tarefas.20261007061355.js","./oficina.20261007061355.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261007061355.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
