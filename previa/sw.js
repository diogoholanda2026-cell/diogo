// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261012005643';
const ARQUIVOS = ["./","./index.html","./parte.20261012005643.TTEOXKLZ.js","./parte.20261012005643.VXM7ZOZS.js","./parte.20261012005643.3JQIFGTH.js","./parte.20261012005643.TIS3TCG6.js","./parte.20261012005643.WAU3RHWO.js","./parte.20261012005643.6VHMCBO5.js","./parte.20261012005643.AM3MS6KR.js","./parte.20261012005643.MKA637YG.js","./parte.20261012005643.QK2VNPRQ.js","./parte.20261012005643.HVHRFO4M.js","./parte.20261012005643.MPZ7QHUN.js","./parte.20261012005643.E4BLYJVG.js","./parte.20261012005643.UJN6PCHI.js","./parte.20261012005643.EQIQFGT5.js","./parte.20261012005643.BXA4W622.js","./parte.20261012005643.S6DYQYLY.js","./parte.20261012005643.5X5TBHSJ.js","./parte.20261012005643.L2KGPGFF.js","./parte.20261012005643.SUMJKJ3J.js","./parte.20261012005643.Y6YPX2VK.js","./parte.20261012005643.XPNZEICD.js","./parte.20261012005643.UCTEFIH3.js","./parte.20261012005643.3KDRYF7V.js","./parte.20261012005643.FU2Q4ZI7.js","./parte.20261012005643.DQ7MXACU.js","./parte.20261012005643.QS2AMTZB.js","./parte.20261012005643.22IT2M3W.js","./parte.20261012005643.3NDZPURX.js","./parte.20261012005643.Y4STFZS4.js","./parte.20261012005643.DW3LLEFI.js","./parte.20261012005643.6NT3QDZQ.js","./parte.20261012005643.D7KMBFYA.js","./parte.20261012005643.HRSU3SR6.js","./parte.20261012005643.V2DVTLVM.js","./parte.20261012005643.GVYWUPUO.js","./parte.20261012005643.EDYJOMYQ.js","./parte.20261012005643.LQVTDYE3.js","./parte.20261012005643.QZ643SBM.js","./parte.20261012005643.XP4KV6ZO.js","./parte.20261012005643.G3ZIJWZS.js","./parte.20261012005643.RZFCWQM6.js","./parte.20261012005643.PJ5V5JJT.js","./parte.20261012005643.5A4YBOAT.js","./parte.20261012005643.AUGEHMN6.js","./jogo.20261012005643.js","./parte.20261012005643.IEK2YSAG.js","./parte.20261012005643.XF6TGMLY.js","./parte.20261012005643.MKNIJOUI.js","./parte.20261012005643.7QCLIV35.js","./parte.20261012005643.A6QNWUI5.js","./parte.20261012005643.WFOHUIFS.js","./parte.20261012005643.HDZTOUOP.js","./parte.20261012005643.76DSKQRS.js","./parte.20261012005643.EQLCCI6S.js","./parte.20261012005643.PJDECGCV.js","./parte.20261012005643.MPCWQ2FW.js","./parte.20261012005643.PJXLNTS7.js","./parte.20261012005643.CM3ORCO6.js","./parte.20261012005643.KNZ5KAMH.js","./parte.20261012005643.O5EIT3M6.js","./parte.20261012005643.FTEZOOMZ.js","./parte.20261012005643.3HEZUP6C.js","./parte.20261012005643.CEH7AIMX.js","./parte.20261012005643.6NYTHEFM.js","./parte.20261012005643.7FGMRA3M.js","./parte.20261012005643.74GZ3QLA.js","./parte.20261012005643.XG3CVXH4.js","./parte.20261012005643.VKTR2E3K.js","./parte.20261012005643.D7STPAIZ.js","./parte.20261012005643.2TBMLOMH.js","./parte.20261012005643.ASKOECWU.js","./parte.20261012005643.H2J5KI6A.js","./parte.20261012005643.FQKLDB65.js","./parte.20261012005643.WMXHPU4N.js","./parte.20261012005643.HUKAHLA6.js","./parte.20261012005643.JG67YPOF.js","./parte.20261012005643.E3PIFHGU.js","./parte.20261012005643.DAHZW4DZ.js","./parte.20261012005643.IS64LWN5.js","./parte.20261012005643.MGAEQH2D.js","./parte.20261012005643.JVPSW65N.js","./parte.20261012005643.FZF5JNUX.js","./parte.20261012005643.KA3M7VDI.js","./parte.20261012005643.DLVX4WPL.js","./parte.20261012005643.B2B5RMFE.js","./parte.20261012005643.7JDCRSMY.js","./parte.20261012005643.24CA5UA4.js","./parte.20261012005643.IJ7M5LLE.js","./parte.20261012005643.I74PDI6T.js","./parte.20261012005643.R4PFJGZ4.js","./parte.20261012005643.QY3LM6QJ.js","./parte.20261012005643.ZLYV22OG.js","./parte.20261012005643.HRECXYPJ.js","./parte.20261012005643.REGFGLKD.js","./parte.20261012005643.RUTSF4XB.js","./parte.20261012005643.2ZOHYCUL.js","./parte.20261012005643.3VQZQIZ3.js","./parte.20261012005643.5XCCNE5R.js","./parte.20261012005643.IXXVXPYO.js","./parte.20261012005643.E35EYVKC.js","./parte.20261012005643.IYEONKOS.js","./parte.20261012005643.ONBVHOAR.js","./parte.20261012005643.6JTZKIYX.js","./parte.20261012005643.WSWVVQF4.js","./parte.20261012005643.AUUIPIZ7.js","./parte.20261012005643.DCKUR3FS.js","./parte.20261012005643.IUK765AT.js","./parte.20261012005643.2EEMD4L2.js","./parte.20261012005643.7CGLX4NT.js","./parte.20261012005643.YDVQLM4D.js","./parte.20261012005643.Z3WMMJKB.js","./parte.20261012005643.KXIIJNN5.js","./parte.20261012005643.7PJ52U3J.js","./parte.20261012005643.WQ6QHKYG.js","./parte.20261012005643.YIBBMKLO.js","./parte.20261012005643.543ZRSWA.js","./parte.20261012005643.MBZCXHUF.js","./parte.20261012005643.XPAGTIC7.js","./parte.20261012005643.N5OGFDZW.js","./parte.20261012005643.H4DLY435.js","./manifest.webmanifest","./fontes/inter.20261012005643.woff2","./estilo.20261012005643.css","./tarefas.20261012005643.js","./oficina.20261012005643.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261012005643.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
