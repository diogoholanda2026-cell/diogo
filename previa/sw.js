// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261007170748';
const ARQUIVOS = ["./","./index.html","./parte.20261007170748.YMJE5BSJ.js","./parte.20261007170748.LCA76NTG.js","./parte.20261007170748.3QWERTCX.js","./parte.20261007170748.3DIFBHYE.js","./parte.20261007170748.645JANHP.js","./parte.20261007170748.2HMUMJLH.js","./parte.20261007170748.6VG63SSY.js","./parte.20261007170748.4X3HDY2C.js","./parte.20261007170748.ACVBOLLN.js","./parte.20261007170748.DBFI4JEZ.js","./parte.20261007170748.MAHMX6JF.js","./parte.20261007170748.2HZD3VYV.js","./parte.20261007170748.243DLK7K.js","./parte.20261007170748.BTXUNXSZ.js","./parte.20261007170748.4XOXL3X7.js","./parte.20261007170748.SMY3GFJT.js","./parte.20261007170748.6X7PC5BO.js","./parte.20261007170748.S2RXOQ54.js","./parte.20261007170748.JAEB6RPL.js","./parte.20261007170748.UZOOQR77.js","./parte.20261007170748.OKC3ZL6F.js","./parte.20261007170748.Y6BIFZNT.js","./parte.20261007170748.WTBPIRZI.js","./parte.20261007170748.6IJRVWSZ.js","./parte.20261007170748.VGL3F77X.js","./parte.20261007170748.K5TXTR66.js","./parte.20261007170748.GNFSZYLN.js","./parte.20261007170748.ZJMNWC5L.js","./parte.20261007170748.DCFSCR4S.js","./parte.20261007170748.RH4SLMF6.js","./parte.20261007170748.KCPBZYTX.js","./parte.20261007170748.ZFHFVKYW.js","./parte.20261007170748.3JC4LAIR.js","./parte.20261007170748.UMPSI3MI.js","./parte.20261007170748.ZEZILMUE.js","./parte.20261007170748.HWQAXWBY.js","./parte.20261007170748.KB53EA4Q.js","./parte.20261007170748.2AJCTTUB.js","./parte.20261007170748.LLG752OX.js","./parte.20261007170748.CD6TQ6TI.js","./parte.20261007170748.43IGON35.js","./parte.20261007170748.CFXQHXF3.js","./parte.20261007170748.UOZPFDX2.js","./parte.20261007170748.JJ2VPCVD.js","./jogo.20261007170748.js","./parte.20261007170748.3JCADVYU.js","./parte.20261007170748.WPPHEEHJ.js","./parte.20261007170748.JUPCGR7D.js","./parte.20261007170748.RK7E2HRL.js","./parte.20261007170748.H3GYW6AM.js","./parte.20261007170748.B32AYIGS.js","./parte.20261007170748.VEPVGJCU.js","./parte.20261007170748.XLVQECF3.js","./parte.20261007170748.OJ5FLG3J.js","./parte.20261007170748.LTDO5K4M.js","./parte.20261007170748.UD26RMCK.js","./parte.20261007170748.D6VTADDC.js","./parte.20261007170748.EAG7XFKY.js","./parte.20261007170748.BZKLETBB.js","./parte.20261007170748.WOFTL453.js","./parte.20261007170748.57V4YMOM.js","./parte.20261007170748.VJIYGH57.js","./parte.20261007170748.5OPGTVCK.js","./parte.20261007170748.PCGYSNGZ.js","./parte.20261007170748.WRDZJXL7.js","./parte.20261007170748.U7DZ3YSC.js","./parte.20261007170748.DSQ3SUDK.js","./parte.20261007170748.PNOJYGAS.js","./parte.20261007170748.XBGIHDVQ.js","./parte.20261007170748.UO527V4O.js","./parte.20261007170748.NBCSEYDT.js","./parte.20261007170748.MBH65LF6.js","./parte.20261007170748.CNOFMETT.js","./parte.20261007170748.HIO2WE5D.js","./parte.20261007170748.JRP72KD2.js","./parte.20261007170748.Q2GDGJ36.js","./parte.20261007170748.ULYA4CZA.js","./parte.20261007170748.GCZO44NS.js","./parte.20261007170748.5JEWRAKV.js","./parte.20261007170748.JNKYDQT4.js","./parte.20261007170748.WGZO7BPX.js","./parte.20261007170748.PCZMIXH5.js","./parte.20261007170748.4PFI4YRT.js","./parte.20261007170748.TRLDKE2U.js","./parte.20261007170748.P6WID254.js","./parte.20261007170748.64SXINLS.js","./parte.20261007170748.3KNDEW32.js","./parte.20261007170748.NN5FYAPX.js","./parte.20261007170748.Y34TSYZQ.js","./parte.20261007170748.KAL5VJ3H.js","./parte.20261007170748.MSBIWI4J.js","./parte.20261007170748.GO6VCKHY.js","./parte.20261007170748.OZYFICOJ.js","./parte.20261007170748.HKMTQAO7.js","./parte.20261007170748.LHJKEWEF.js","./parte.20261007170748.TLR5HFWP.js","./parte.20261007170748.SDSAK6PE.js","./parte.20261007170748.GFQO7RON.js","./parte.20261007170748.IPPXIIVD.js","./parte.20261007170748.M2PO6AK7.js","./parte.20261007170748.FZXUYVAK.js","./parte.20261007170748.A7G3AAZM.js","./parte.20261007170748.KQMW26BV.js","./parte.20261007170748.LIYUWSUR.js","./parte.20261007170748.WS534WON.js","./parte.20261007170748.5C7ZMCOE.js","./parte.20261007170748.A5HAQJSQ.js","./parte.20261007170748.AIDWBMUP.js","./parte.20261007170748.63KDVBBT.js","./parte.20261007170748.4QPJQQA7.js","./parte.20261007170748.Q7GW5D26.js","./parte.20261007170748.E64JENW2.js","./parte.20261007170748.AWKBVLMZ.js","./parte.20261007170748.NXRPDJTG.js","./parte.20261007170748.YYKZWHN2.js","./parte.20261007170748.6UQJB3BN.js","./parte.20261007170748.LH3DWWOI.js","./parte.20261007170748.3USUPIKZ.js","./parte.20261007170748.XS5SN6YE.js","./parte.20261007170748.U2SMWNKB.js","./parte.20261007170748.XR2FEPSZ.js","./manifest.webmanifest","./fontes/inter.20261007170748.woff2","./estilo.20261007170748.css","./tarefas.20261007170748.js","./oficina.20261007170748.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261007170748.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
