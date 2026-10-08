// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008122548';
const ARQUIVOS = ["./","./index.html","./parte.20261008122548.LQ57WM75.js","./parte.20261008122548.YR5GKJ74.js","./parte.20261008122548.EBTHYLY4.js","./parte.20261008122548.ILHKHNLV.js","./parte.20261008122548.P2CBIEWP.js","./parte.20261008122548.KK377BEX.js","./parte.20261008122548.J5JBSKJP.js","./parte.20261008122548.VK263W2A.js","./parte.20261008122548.KKI6CHI5.js","./parte.20261008122548.TPOA23F5.js","./parte.20261008122548.6C4UEI7N.js","./parte.20261008122548.RAWN2CKY.js","./parte.20261008122548.KAL5VMO3.js","./parte.20261008122548.46EERE4G.js","./parte.20261008122548.SVVKHC2U.js","./parte.20261008122548.BNLFCTGW.js","./parte.20261008122548.RRWVX7XJ.js","./parte.20261008122548.DE2SU4X3.js","./parte.20261008122548.4FHKZOZO.js","./parte.20261008122548.3O4BCHIU.js","./parte.20261008122548.QWB3TWKR.js","./parte.20261008122548.5KSGRRZS.js","./parte.20261008122548.KUEIVA52.js","./parte.20261008122548.QLHLM5NZ.js","./parte.20261008122548.4G5JCLFR.js","./parte.20261008122548.HEW7BDQS.js","./parte.20261008122548.ZVVTY4SM.js","./parte.20261008122548.UQY6BXRS.js","./parte.20261008122548.JI5KVKTC.js","./parte.20261008122548.IXFPXPEJ.js","./parte.20261008122548.AZQYGSEV.js","./parte.20261008122548.III3P5NZ.js","./parte.20261008122548.AJG65NY5.js","./parte.20261008122548.3IO6K4CL.js","./parte.20261008122548.SODOOYJV.js","./parte.20261008122548.H4XHUU5X.js","./parte.20261008122548.BOM7LQBS.js","./parte.20261008122548.U7UXW6XU.js","./parte.20261008122548.JXVH2THZ.js","./parte.20261008122548.MN6MA4UH.js","./parte.20261008122548.SKTL3VXP.js","./parte.20261008122548.QN56RS2C.js","./parte.20261008122548.IBQW7ZJE.js","./parte.20261008122548.GCKBZV2W.js","./jogo.20261008122548.js","./parte.20261008122548.JYUE2OZL.js","./parte.20261008122548.EHL3W7WX.js","./parte.20261008122548.5JXLK6JF.js","./parte.20261008122548.Z7XTGTXV.js","./parte.20261008122548.B5WVB5U7.js","./parte.20261008122548.TUN7HIAV.js","./parte.20261008122548.G7UZUDH3.js","./parte.20261008122548.VOVKSAZ5.js","./parte.20261008122548.SGCXJHUA.js","./parte.20261008122548.I3E3CQ7Q.js","./parte.20261008122548.MZOFEI5D.js","./parte.20261008122548.CAYVTT3G.js","./parte.20261008122548.6PUBXLLG.js","./parte.20261008122548.NASBZPHC.js","./parte.20261008122548.ILV7ZROM.js","./parte.20261008122548.S6JFLRWH.js","./parte.20261008122548.SIZOXVFB.js","./parte.20261008122548.ODNDXDGV.js","./parte.20261008122548.SIN3VJ3C.js","./parte.20261008122548.C7L4FEM7.js","./parte.20261008122548.W6BBJ5Q7.js","./parte.20261008122548.RC6RNUZ2.js","./parte.20261008122548.SFWHUGD6.js","./parte.20261008122548.PUEOBZKU.js","./parte.20261008122548.MXCD2MUI.js","./parte.20261008122548.HX4QZEKB.js","./parte.20261008122548.ZAUQ3DFK.js","./parte.20261008122548.AHCIVUWT.js","./parte.20261008122548.XDQAQA6S.js","./parte.20261008122548.TGBGA53A.js","./parte.20261008122548.6PUCOEOX.js","./parte.20261008122548.HPV6UBRH.js","./parte.20261008122548.Q5VK6XYY.js","./parte.20261008122548.EX7OM7UG.js","./parte.20261008122548.AGGZWNHR.js","./parte.20261008122548.BERG7D4L.js","./parte.20261008122548.MWIVPOEC.js","./parte.20261008122548.ZX6O7EEO.js","./parte.20261008122548.Q47QBXVW.js","./parte.20261008122548.B3C35EE7.js","./parte.20261008122548.XNUZ7LBU.js","./parte.20261008122548.QCPKF6LO.js","./parte.20261008122548.RLF6OVGL.js","./parte.20261008122548.FNW4H7Y5.js","./parte.20261008122548.XOSE2SOZ.js","./parte.20261008122548.BEWJD7UH.js","./parte.20261008122548.3T7Q72U7.js","./parte.20261008122548.PBNU4EVM.js","./parte.20261008122548.LWJTLNPU.js","./parte.20261008122548.EPG227EX.js","./parte.20261008122548.TG4DOSPN.js","./parte.20261008122548.S4Y5RTKY.js","./parte.20261008122548.4X4YG67L.js","./parte.20261008122548.JFD4VT7P.js","./parte.20261008122548.AIBP522P.js","./parte.20261008122548.JXUYPJDB.js","./parte.20261008122548.DSV5YMQM.js","./parte.20261008122548.BCCU4PIT.js","./parte.20261008122548.4UOTV5QY.js","./parte.20261008122548.CBTYSOJ7.js","./parte.20261008122548.222TKDFT.js","./parte.20261008122548.OKJYAUIH.js","./parte.20261008122548.R2YKBAHC.js","./parte.20261008122548.MK34EBX3.js","./parte.20261008122548.GQEISBND.js","./parte.20261008122548.KPTJL3LK.js","./parte.20261008122548.LDTJX33F.js","./parte.20261008122548.ZQJHP6N6.js","./parte.20261008122548.QBSBZAJS.js","./parte.20261008122548.6VEXAESF.js","./parte.20261008122548.J6K2A7V3.js","./parte.20261008122548.6NQ3H2ZE.js","./parte.20261008122548.N7XERGFQ.js","./parte.20261008122548.JZEULOKL.js","./parte.20261008122548.MZ3GKXPI.js","./parte.20261008122548.NVQF2JHR.js","./parte.20261008122548.TBGLL3ZU.js","./manifest.webmanifest","./fontes/inter.20261008122548.woff2","./estilo.20261008122548.css","./tarefas.20261008122548.js","./oficina.20261008122548.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008122548.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
