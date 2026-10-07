// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261007201216';
const ARQUIVOS = ["./","./index.html","./parte.20261007201216.BOLDSDNI.js","./parte.20261007201216.RLOUY3CI.js","./parte.20261007201216.EAUMCHAA.js","./parte.20261007201216.VRIKRWHW.js","./parte.20261007201216.5APAIBE4.js","./parte.20261007201216.NUUCFNRS.js","./parte.20261007201216.JNDT4WGP.js","./parte.20261007201216.MSXARRVW.js","./parte.20261007201216.MJFJEZ7M.js","./parte.20261007201216.2A3JSHUC.js","./parte.20261007201216.VLRNRB6K.js","./parte.20261007201216.HCIFJ4AO.js","./parte.20261007201216.PJAPHXBH.js","./parte.20261007201216.O5UNT3HU.js","./parte.20261007201216.G7NFHVKG.js","./parte.20261007201216.EP7GIQUB.js","./parte.20261007201216.NKJYYPI6.js","./parte.20261007201216.4AUS6SMR.js","./parte.20261007201216.3X2QN6VL.js","./parte.20261007201216.OW3JMU3E.js","./parte.20261007201216.EDJ7LRUU.js","./parte.20261007201216.ARPU3KYV.js","./parte.20261007201216.ARKNWB33.js","./parte.20261007201216.ENYM5P4I.js","./parte.20261007201216.SDH2JR22.js","./parte.20261007201216.4BSGDAJQ.js","./parte.20261007201216.ZDHPBFTX.js","./parte.20261007201216.KMCBY54Q.js","./parte.20261007201216.JMSCLZXC.js","./parte.20261007201216.RTD3DISE.js","./parte.20261007201216.RD6FAPIG.js","./parte.20261007201216.W4XKHJI3.js","./parte.20261007201216.DRLY7TOC.js","./parte.20261007201216.OFWLP3Q5.js","./parte.20261007201216.7VNQS4WW.js","./parte.20261007201216.V2EWN2ED.js","./parte.20261007201216.EFG2LHLI.js","./parte.20261007201216.AJ2H5OLB.js","./parte.20261007201216.IT6WLYTU.js","./parte.20261007201216.LXTCZ6FZ.js","./parte.20261007201216.35UF3K3L.js","./parte.20261007201216.JDXXGMY7.js","./parte.20261007201216.QPCMU777.js","./parte.20261007201216.HV6NJZHG.js","./jogo.20261007201216.js","./parte.20261007201216.O2FNARXF.js","./parte.20261007201216.G55WHLFR.js","./parte.20261007201216.ZUPBALTB.js","./parte.20261007201216.L7R4UZW4.js","./parte.20261007201216.TWRLAGRD.js","./parte.20261007201216.GMCMRAW6.js","./parte.20261007201216.B475YTUB.js","./parte.20261007201216.3QZ37HSH.js","./parte.20261007201216.6NINR3IA.js","./parte.20261007201216.SEMRJ7Q6.js","./parte.20261007201216.6QUH4KI2.js","./parte.20261007201216.3PTZ65ZN.js","./parte.20261007201216.ET74DZOM.js","./parte.20261007201216.NFX62M3S.js","./parte.20261007201216.FUEUH53D.js","./parte.20261007201216.IIOPMZKL.js","./parte.20261007201216.23GNBOO5.js","./parte.20261007201216.KZSFJM7H.js","./parte.20261007201216.MJTRZUYX.js","./parte.20261007201216.MFQNA322.js","./parte.20261007201216.GWPDJJGC.js","./parte.20261007201216.M4MK4ZWY.js","./parte.20261007201216.CIY6FYZA.js","./parte.20261007201216.LWHAR7OB.js","./parte.20261007201216.BW4QVJFL.js","./parte.20261007201216.UJF32ADP.js","./parte.20261007201216.WNFGTBC3.js","./parte.20261007201216.WFVKL3OH.js","./parte.20261007201216.EL4TQ3IR.js","./parte.20261007201216.KPZ77EVE.js","./parte.20261007201216.TPBJMIUL.js","./parte.20261007201216.LMTN3BA3.js","./parte.20261007201216.6GPJKWYF.js","./parte.20261007201216.UWYBZH7V.js","./parte.20261007201216.DFDC7EK5.js","./parte.20261007201216.TCSZWKAM.js","./parte.20261007201216.4F5GR7Z6.js","./parte.20261007201216.LLL7SQ45.js","./parte.20261007201216.6NJOL45F.js","./parte.20261007201216.3K26BYGU.js","./parte.20261007201216.QRTV54U7.js","./parte.20261007201216.A5SYI25P.js","./parte.20261007201216.GIDBAUYI.js","./parte.20261007201216.IDRBDDXT.js","./parte.20261007201216.DCQJZTJR.js","./parte.20261007201216.PMIRR5UQ.js","./parte.20261007201216.U67UM2XJ.js","./parte.20261007201216.PRKEEYNN.js","./parte.20261007201216.SIGTYCNF.js","./parte.20261007201216.OU5HYX3Q.js","./parte.20261007201216.NF4ZWVDK.js","./parte.20261007201216.Q6JZQQN5.js","./parte.20261007201216.GVHH4CNT.js","./parte.20261007201216.IOFUHDMX.js","./parte.20261007201216.B2NQXWY5.js","./parte.20261007201216.P2DVUPEO.js","./parte.20261007201216.KBFQQN7P.js","./parte.20261007201216.OESMV6ZE.js","./parte.20261007201216.P7I4HCA4.js","./parte.20261007201216.N7UP4MJE.js","./parte.20261007201216.A4VPWHUV.js","./parte.20261007201216.ZK3UYSWY.js","./parte.20261007201216.KV5WDRKH.js","./parte.20261007201216.LUWJ6LQC.js","./parte.20261007201216.GBTLAZTO.js","./parte.20261007201216.MXWUDX36.js","./parte.20261007201216.IF4OWWIK.js","./parte.20261007201216.YPKMVIRU.js","./parte.20261007201216.T3QORZHD.js","./parte.20261007201216.OL7ZUQD3.js","./parte.20261007201216.GQQJMH6S.js","./parte.20261007201216.E7FGOHKZ.js","./parte.20261007201216.QTC2GHJ5.js","./parte.20261007201216.J3UHVY62.js","./parte.20261007201216.RMMWIAL7.js","./parte.20261007201216.U5BT2ISC.js","./manifest.webmanifest","./fontes/inter.20261007201216.woff2","./estilo.20261007201216.css","./tarefas.20261007201216.js","./oficina.20261007201216.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261007201216.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
