// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008164809';
const ARQUIVOS = ["./","./index.html","./parte.20261008164809.RHJNFSUY.js","./parte.20261008164809.QJR6XY5M.js","./parte.20261008164809.PRGMWYIU.js","./parte.20261008164809.2SES2WNK.js","./parte.20261008164809.GSAK6L43.js","./parte.20261008164809.AK3YSYKH.js","./parte.20261008164809.MVVZHMO4.js","./parte.20261008164809.2A5Q5SBD.js","./parte.20261008164809.QLSQNV7Z.js","./parte.20261008164809.ZURXNJ3A.js","./parte.20261008164809.ISKZXBMO.js","./parte.20261008164809.SFGDSBO7.js","./parte.20261008164809.OM47BFY5.js","./parte.20261008164809.HLEHOL5U.js","./parte.20261008164809.V2WSEEIW.js","./parte.20261008164809.F7Z3TJGK.js","./parte.20261008164809.KSG7WSB2.js","./parte.20261008164809.SBFFG7GQ.js","./parte.20261008164809.L5TL7IEK.js","./parte.20261008164809.WAQYBI2U.js","./parte.20261008164809.EWFSM573.js","./parte.20261008164809.RETZJHX7.js","./parte.20261008164809.QI7EV5PY.js","./parte.20261008164809.BQ352RH6.js","./parte.20261008164809.O6KRZMZM.js","./parte.20261008164809.XLRTOXX3.js","./parte.20261008164809.HP5XDQ5O.js","./parte.20261008164809.WM6DJP5G.js","./parte.20261008164809.L67X7P7T.js","./parte.20261008164809.SXEE3HX4.js","./parte.20261008164809.GQLJNAOD.js","./parte.20261008164809.M6NMMGSM.js","./parte.20261008164809.7NTEFQYL.js","./parte.20261008164809.GY5GI6P6.js","./parte.20261008164809.2NXQEK72.js","./parte.20261008164809.WDKOSDMB.js","./parte.20261008164809.IM5GS5KX.js","./parte.20261008164809.PLT7JIU2.js","./parte.20261008164809.IHOW4NTR.js","./parte.20261008164809.4MGFRICA.js","./parte.20261008164809.5UUI33CW.js","./parte.20261008164809.L7K3FF5N.js","./parte.20261008164809.F422YODW.js","./parte.20261008164809.UUTBAVQN.js","./jogo.20261008164809.js","./parte.20261008164809.YPRTMC4U.js","./parte.20261008164809.XZJBF7UH.js","./parte.20261008164809.M76OT2TX.js","./parte.20261008164809.OR3ASX4B.js","./parte.20261008164809.X7ZFKPV6.js","./parte.20261008164809.6MUWCNO4.js","./parte.20261008164809.E54LHCZX.js","./parte.20261008164809.HUCCPIRM.js","./parte.20261008164809.RQQQ2VD4.js","./parte.20261008164809.BLVMUXSD.js","./parte.20261008164809.ZUCBNBVA.js","./parte.20261008164809.CELAYRDM.js","./parte.20261008164809.ZHZUP72D.js","./parte.20261008164809.KOQR6K4S.js","./parte.20261008164809.OSCRWKAT.js","./parte.20261008164809.LH3EG7PV.js","./parte.20261008164809.74GZOBJV.js","./parte.20261008164809.3KQJMPRM.js","./parte.20261008164809.WLWYPYHQ.js","./parte.20261008164809.OBSWKM6B.js","./parte.20261008164809.YVPKHZET.js","./parte.20261008164809.2WKEILYS.js","./parte.20261008164809.EBTULMUT.js","./parte.20261008164809.FEVCLUVI.js","./parte.20261008164809.N2EDY5I2.js","./parte.20261008164809.J2F7H7UZ.js","./parte.20261008164809.D7ISOWCB.js","./parte.20261008164809.L523ACCH.js","./parte.20261008164809.WVDX5GNY.js","./parte.20261008164809.V6QRYCDD.js","./parte.20261008164809.A7VYOVYL.js","./parte.20261008164809.EOHS4RZV.js","./parte.20261008164809.GCJCYVMD.js","./parte.20261008164809.R26V5LI5.js","./parte.20261008164809.NGIYBRTT.js","./parte.20261008164809.F556MLGS.js","./parte.20261008164809.NDGENVPO.js","./parte.20261008164809.Y6P4K4MK.js","./parte.20261008164809.LPSDORUZ.js","./parte.20261008164809.FZOHYOAL.js","./parte.20261008164809.K7SHECQX.js","./parte.20261008164809.235AU4VU.js","./parte.20261008164809.JEEQQKTS.js","./parte.20261008164809.GM76FLHK.js","./parte.20261008164809.B3CNKFML.js","./parte.20261008164809.UHXI4M2C.js","./parte.20261008164809.ENHGG4ER.js","./parte.20261008164809.6U5UNT5A.js","./parte.20261008164809.DSZV2ZYZ.js","./parte.20261008164809.HOVUB26T.js","./parte.20261008164809.SAUDNVID.js","./parte.20261008164809.IBIKTCVW.js","./parte.20261008164809.7VWK4UMB.js","./parte.20261008164809.UYIOFLSR.js","./parte.20261008164809.YXQ6FT6K.js","./parte.20261008164809.LTGZKWR3.js","./parte.20261008164809.GE7RWQUA.js","./parte.20261008164809.RMVD4SJ7.js","./parte.20261008164809.MR3OMYKS.js","./parte.20261008164809.7XBDFIYF.js","./parte.20261008164809.GFZ2TPW2.js","./parte.20261008164809.PAJZK7DW.js","./parte.20261008164809.QS3JEIHN.js","./parte.20261008164809.FQYC3WTN.js","./parte.20261008164809.LK33A5T2.js","./parte.20261008164809.ALEHL7IH.js","./parte.20261008164809.AQH6V3EE.js","./parte.20261008164809.RZHLXD5Y.js","./parte.20261008164809.YIZKLDM2.js","./parte.20261008164809.JBGS6CHD.js","./parte.20261008164809.3BCSLD5M.js","./parte.20261008164809.PZZYLBEO.js","./parte.20261008164809.3X4ZFKNH.js","./parte.20261008164809.DQQV3BZ6.js","./parte.20261008164809.Q4L6XRIK.js","./manifest.webmanifest","./fontes/inter.20261008164809.woff2","./estilo.20261008164809.css","./tarefas.20261008164809.js","./oficina.20261008164809.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008164809.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
