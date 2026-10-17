// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261017051326';
const ARQUIVOS = ["./","./index.html","./parte.20261017051326.IYO65ZMT.js","./parte.20261017051326.HKMHULER.js","./parte.20261017051326.XQVZJPHK.js","./parte.20261017051326.GWJ2Q56M.js","./parte.20261017051326.OKDH7CVZ.js","./parte.20261017051326.PICSX7Q3.js","./parte.20261017051326.LHQGOCGF.js","./parte.20261017051326.NABWUPUQ.js","./parte.20261017051326.UFQFEFNM.js","./parte.20261017051326.4ZEWSQHQ.js","./parte.20261017051326.JIXSQFKV.js","./parte.20261017051326.S43VFZNL.js","./parte.20261017051326.YGRJN5MS.js","./parte.20261017051326.LSIUXV2A.js","./parte.20261017051326.UCCVVBJA.js","./parte.20261017051326.YIJSAJVX.js","./parte.20261017051326.GCAP3ZBN.js","./parte.20261017051326.YNCSLYV4.js","./parte.20261017051326.FGCDV3B2.js","./parte.20261017051326.5JCDNPML.js","./parte.20261017051326.ZCY57L2Q.js","./parte.20261017051326.7PLYEIGC.js","./parte.20261017051326.UVUESJBM.js","./parte.20261017051326.PC6UIWS7.js","./parte.20261017051326.DHAI47WR.js","./parte.20261017051326.M2EI2S4Q.js","./parte.20261017051326.DUIX5HCP.js","./parte.20261017051326.MC5PKEUS.js","./parte.20261017051326.NKAKU3NF.js","./parte.20261017051326.AFYZBOG6.js","./parte.20261017051326.Q4J4GP35.js","./parte.20261017051326.JTV4DJLA.js","./parte.20261017051326.LNJVLAIW.js","./parte.20261017051326.DHDE455Z.js","./parte.20261017051326.HAU2PR4V.js","./parte.20261017051326.GDOJGXUI.js","./parte.20261017051326.JCNIMD7C.js","./parte.20261017051326.OU5VXP66.js","./parte.20261017051326.J4QPGO6D.js","./parte.20261017051326.SBHM6H6G.js","./parte.20261017051326.RZGBHBT4.js","./parte.20261017051326.RMHMY6ZK.js","./parte.20261017051326.CWRIBIRU.js","./parte.20261017051326.JC5YEPLG.js","./parte.20261017051326.CAMUSNYX.js","./jogo.20261017051326.js","./parte.20261017051326.IJEK7BYW.js","./parte.20261017051326.AXH52NXJ.js","./parte.20261017051326.WNQAQ6Q4.js","./parte.20261017051326.DONJELYH.js","./parte.20261017051326.Y3RXKFZ2.js","./parte.20261017051326.I3UCYWIQ.js","./parte.20261017051326.44675QMD.js","./parte.20261017051326.JNEUANAK.js","./parte.20261017051326.NZACSBYB.js","./parte.20261017051326.E4P7K3V7.js","./parte.20261017051326.YQ4YL5BK.js","./parte.20261017051326.4WLMLTIO.js","./parte.20261017051326.F7P4K7GJ.js","./parte.20261017051326.VRSUMTCY.js","./parte.20261017051326.RTIRINV3.js","./parte.20261017051326.G3BZLGSQ.js","./parte.20261017051326.ZBBSTDNK.js","./parte.20261017051326.N3CSY7NL.js","./parte.20261017051326.2NPWS4SI.js","./parte.20261017051326.CTVKX2FH.js","./parte.20261017051326.ZEVDDVE4.js","./parte.20261017051326.WYXL7PQS.js","./parte.20261017051326.TBXWTO34.js","./parte.20261017051326.6RIIWYFH.js","./parte.20261017051326.LXVBPYBP.js","./parte.20261017051326.HVZKCRW2.js","./parte.20261017051326.ZMPRCZZI.js","./parte.20261017051326.XESW2I2H.js","./parte.20261017051326.4DVVHSHN.js","./parte.20261017051326.PH3PBUPS.js","./parte.20261017051326.B22NT2BF.js","./parte.20261017051326.YHZNQOZP.js","./parte.20261017051326.IL5XLQAF.js","./parte.20261017051326.4YO2ME5G.js","./parte.20261017051326.TZSIR5UD.js","./parte.20261017051326.EE7GNW7F.js","./parte.20261017051326.EDFFOYIH.js","./parte.20261017051326.XUFSFG2Y.js","./parte.20261017051326.IRKMAT3H.js","./parte.20261017051326.HNDTBSZG.js","./parte.20261017051326.Y3EZ7VWN.js","./parte.20261017051326.KUCE2WGT.js","./parte.20261017051326.PZ54CK2L.js","./parte.20261017051326.GCUSTI24.js","./parte.20261017051326.7ALP2Q56.js","./parte.20261017051326.CDC3AXCJ.js","./parte.20261017051326.FQXR75TV.js","./parte.20261017051326.6DZXBLVI.js","./parte.20261017051326.RVPKRA4C.js","./parte.20261017051326.BFKSET7K.js","./parte.20261017051326.ECUCZ4ZS.js","./parte.20261017051326.GOFURDAD.js","./parte.20261017051326.YO4C5WNO.js","./parte.20261017051326.R7LJLSHY.js","./parte.20261017051326.GB5VF76F.js","./parte.20261017051326.XEVLJFVB.js","./parte.20261017051326.4VQZWKMY.js","./parte.20261017051326.LW6VXK2N.js","./parte.20261017051326.DNX7CTK6.js","./parte.20261017051326.X2R23SDZ.js","./parte.20261017051326.4V2DW7JT.js","./parte.20261017051326.3A25GEN7.js","./parte.20261017051326.RC2YESK6.js","./parte.20261017051326.RPN655XI.js","./parte.20261017051326.OJSVZFVD.js","./parte.20261017051326.FTYRHJHJ.js","./parte.20261017051326.QFANE7MP.js","./parte.20261017051326.TL7VPB72.js","./parte.20261017051326.5HLN2VQM.js","./parte.20261017051326.3CBAGSLY.js","./parte.20261017051326.5JD77OD5.js","./parte.20261017051326.PSLX2XHB.js","./parte.20261017051326.VOQRQ4FQ.js","./parte.20261017051326.WRYICJZ5.js","./parte.20261017051326.4KLARKHL.js","./parte.20261017051326.FHRTBJYD.js","./parte.20261017051326.F2AW753V.js","./parte.20261017051326.SKJVGXKK.js","./parte.20261017051326.F7FGRR6C.js","./parte.20261017051326.UMO4BQNB.js","./manifest.webmanifest","./fontes/inter.20261017051326.woff2","./estilo.20261017051326.css","./tarefas.20261017051326.js","./oficina.20261017051326.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261017051326.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
