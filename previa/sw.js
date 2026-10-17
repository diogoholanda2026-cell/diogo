// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261017093216';
const ARQUIVOS = ["./","./index.html","./parte.20261017093216.WYJJ22BO.js","./parte.20261017093216.IQZQUYLR.js","./parte.20261017093216.MPBUPOXK.js","./parte.20261017093216.WJQ74IQU.js","./parte.20261017093216.VQ6UBCZG.js","./parte.20261017093216.7T2QXX6S.js","./parte.20261017093216.FLKK4INA.js","./parte.20261017093216.XEL2BBFZ.js","./parte.20261017093216.NJ37I4T7.js","./parte.20261017093216.7O6QCO67.js","./parte.20261017093216.TLXRPSOP.js","./parte.20261017093216.VUOFOZAA.js","./parte.20261017093216.IEJIZSHY.js","./parte.20261017093216.DHVK5SG5.js","./parte.20261017093216.D34V45ZK.js","./parte.20261017093216.3KDJL7CK.js","./parte.20261017093216.LV2M7JEJ.js","./parte.20261017093216.OWNR7WGT.js","./parte.20261017093216.4D6IBI5K.js","./parte.20261017093216.IOGRK5KY.js","./parte.20261017093216.6VLBIR65.js","./parte.20261017093216.YD6KRFVP.js","./parte.20261017093216.L6GGHWUW.js","./parte.20261017093216.IESI2J52.js","./parte.20261017093216.GVCGD7SL.js","./parte.20261017093216.WVHTSEDG.js","./parte.20261017093216.ICCVZYMC.js","./parte.20261017093216.HOVZNM4N.js","./parte.20261017093216.ZHISDQOP.js","./parte.20261017093216.DKICW2AV.js","./parte.20261017093216.C5HSZ3ET.js","./parte.20261017093216.MZGQR7GG.js","./parte.20261017093216.523CFRGE.js","./parte.20261017093216.37PYPLQ5.js","./parte.20261017093216.5WCYVJ4W.js","./parte.20261017093216.WSWYS6PD.js","./parte.20261017093216.LHOOGX2Z.js","./parte.20261017093216.E5AJFX4G.js","./parte.20261017093216.KRA65CDE.js","./parte.20261017093216.RWUTC6TU.js","./parte.20261017093216.B7YUDV2P.js","./parte.20261017093216.ZXJ74SRS.js","./parte.20261017093216.ZTUOMRE7.js","./parte.20261017093216.UKPQFUCF.js","./parte.20261017093216.KBNLCGUQ.js","./jogo.20261017093216.js","./parte.20261017093216.6XI5NYVI.js","./parte.20261017093216.W5NJGAGR.js","./parte.20261017093216.ZHLP7EFR.js","./parte.20261017093216.YLJHVHHI.js","./parte.20261017093216.XKBF4CQ3.js","./parte.20261017093216.XOEDTCYC.js","./parte.20261017093216.DLOL7VSN.js","./parte.20261017093216.QXQIGKYN.js","./parte.20261017093216.C4DTZLPF.js","./parte.20261017093216.FHVCJYZY.js","./parte.20261017093216.SQXZZSOP.js","./parte.20261017093216.XWFZW6X3.js","./parte.20261017093216.IHK3MDH2.js","./parte.20261017093216.66O5AZIP.js","./parte.20261017093216.ZVW6N6TF.js","./parte.20261017093216.SYN74CSA.js","./parte.20261017093216.6UX2CZFK.js","./parte.20261017093216.RS4KNPKS.js","./parte.20261017093216.6NHBRJCN.js","./parte.20261017093216.S575N5O3.js","./parte.20261017093216.T5EX6O7N.js","./parte.20261017093216.BZLU5OVS.js","./parte.20261017093216.HQIL2QUT.js","./parte.20261017093216.CRPQNS2V.js","./parte.20261017093216.R4ABNGWD.js","./parte.20261017093216.6FIWSWVV.js","./parte.20261017093216.ICJPUWEC.js","./parte.20261017093216.HUIHJIYH.js","./parte.20261017093216.LBSJ2HU6.js","./parte.20261017093216.HYME5HZL.js","./parte.20261017093216.7W7CMTBL.js","./parte.20261017093216.DCRZ2UBD.js","./parte.20261017093216.ATRC65KX.js","./parte.20261017093216.OYXAZZOZ.js","./parte.20261017093216.USS5P4WR.js","./parte.20261017093216.BWVFCUTA.js","./parte.20261017093216.VIQPMYZB.js","./parte.20261017093216.KM6AHR6K.js","./parte.20261017093216.PJ3C2GTL.js","./parte.20261017093216.Q44FJYWV.js","./parte.20261017093216.GLFONK6Y.js","./parte.20261017093216.I6JGOM2O.js","./parte.20261017093216.PKGXHDWC.js","./parte.20261017093216.MGUXIZWC.js","./parte.20261017093216.XLKSM5AO.js","./parte.20261017093216.VQHIAVMP.js","./parte.20261017093216.72SKZDOT.js","./parte.20261017093216.AUBOXJRE.js","./parte.20261017093216.KS4B2N5X.js","./parte.20261017093216.5VMT62EM.js","./parte.20261017093216.HAUUFDDZ.js","./parte.20261017093216.AOSCJAGF.js","./parte.20261017093216.Z6CUUSWN.js","./parte.20261017093216.JWB4Y7UG.js","./parte.20261017093216.5QMVO2YA.js","./parte.20261017093216.AXPMQB6P.js","./parte.20261017093216.UCZIE3X5.js","./parte.20261017093216.H2RZ5YRS.js","./parte.20261017093216.ZCCSNXBG.js","./parte.20261017093216.ZUTKLCOI.js","./parte.20261017093216.O5H7V5HM.js","./parte.20261017093216.MQB6NNXF.js","./parte.20261017093216.MAPR263B.js","./parte.20261017093216.5CZQX4VR.js","./parte.20261017093216.DWLXBKOE.js","./parte.20261017093216.BHUZ6RSH.js","./parte.20261017093216.RDOZG46D.js","./parte.20261017093216.DDBMLPMZ.js","./parte.20261017093216.FUIVRW4G.js","./parte.20261017093216.ASJE3M3Z.js","./parte.20261017093216.ICBCCHYP.js","./parte.20261017093216.XG3PS334.js","./parte.20261017093216.AJIW7T3N.js","./parte.20261017093216.P223TYQA.js","./parte.20261017093216.OU5D5LD6.js","./parte.20261017093216.YGQ7UKKC.js","./parte.20261017093216.F2CVGR47.js","./parte.20261017093216.COB5L2PN.js","./parte.20261017093216.IQLS3YYL.js","./parte.20261017093216.POIFTBKL.js","./manifest.webmanifest","./fontes/inter.20261017093216.woff2","./estilo.20261017093216.css","./tarefas.20261017093216.js","./oficina.20261017093216.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261017093216.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
