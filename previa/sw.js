// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261011154227';
const ARQUIVOS = ["./","./index.html","./parte.20261011154227.6DGJFY6R.js","./parte.20261011154227.I2ZCDIUD.js","./parte.20261011154227.CUEWRB3J.js","./parte.20261011154227.H3D3H6TB.js","./parte.20261011154227.6MLI3G2W.js","./parte.20261011154227.3IQZOT37.js","./parte.20261011154227.ELPJOXEX.js","./parte.20261011154227.6HBHHYPB.js","./parte.20261011154227.2FEGBGDT.js","./parte.20261011154227.C3YTGJAG.js","./parte.20261011154227.ITWESNBE.js","./parte.20261011154227.WLXPFADS.js","./parte.20261011154227.DL2ISGCH.js","./parte.20261011154227.UI2DYGZP.js","./parte.20261011154227.H6DMLXWY.js","./parte.20261011154227.A4EWMMFI.js","./parte.20261011154227.2SZEYFZX.js","./parte.20261011154227.2FEHDKED.js","./parte.20261011154227.WL5LNAXD.js","./parte.20261011154227.O6OKHLEP.js","./parte.20261011154227.6MRASLZ5.js","./parte.20261011154227.J5STT6ZQ.js","./parte.20261011154227.PD7BGTJS.js","./parte.20261011154227.RYK67D3G.js","./parte.20261011154227.7SNV67EK.js","./parte.20261011154227.I2LUMY6M.js","./parte.20261011154227.D5NXQTXX.js","./parte.20261011154227.IBCPQ37E.js","./parte.20261011154227.YUKXNG2R.js","./parte.20261011154227.EVZWJSCW.js","./parte.20261011154227.FO74QSB4.js","./parte.20261011154227.6OEA3OJF.js","./parte.20261011154227.GFJHXF32.js","./parte.20261011154227.FZYOUPWC.js","./parte.20261011154227.Y5AKNHQ5.js","./parte.20261011154227.ZLMMEUXF.js","./parte.20261011154227.KAZVXOHE.js","./parte.20261011154227.V5OGWAGJ.js","./parte.20261011154227.ZEK2QX7Y.js","./parte.20261011154227.O5BXBW4Y.js","./parte.20261011154227.U5442KQ6.js","./parte.20261011154227.VOICHYAU.js","./parte.20261011154227.KOIMC5N4.js","./parte.20261011154227.FH3WYJ52.js","./jogo.20261011154227.js","./parte.20261011154227.FRL7PHFD.js","./parte.20261011154227.XZWWZ5OS.js","./parte.20261011154227.EVWFD32F.js","./parte.20261011154227.IAA55XGQ.js","./parte.20261011154227.SVQHRUQ5.js","./parte.20261011154227.BYDQIK2D.js","./parte.20261011154227.K3SYEDQW.js","./parte.20261011154227.7B56Q7OT.js","./parte.20261011154227.ML42UCQ4.js","./parte.20261011154227.WMXISCKJ.js","./parte.20261011154227.AL3WR6UC.js","./parte.20261011154227.STNSCMHS.js","./parte.20261011154227.F4466BCI.js","./parte.20261011154227.J7J3NAHY.js","./parte.20261011154227.JVH66D7X.js","./parte.20261011154227.P3WS4ZYP.js","./parte.20261011154227.XBQEPJXS.js","./parte.20261011154227.BTSK3WBX.js","./parte.20261011154227.2CNAEJCQ.js","./parte.20261011154227.KQN2GENH.js","./parte.20261011154227.YXZRKC3C.js","./parte.20261011154227.HYCIOCO6.js","./parte.20261011154227.YJUENDWB.js","./parte.20261011154227.MIVVISW4.js","./parte.20261011154227.T3HQAHS4.js","./parte.20261011154227.RDTHLVWD.js","./parte.20261011154227.SXFOUMIC.js","./parte.20261011154227.A3ABROWS.js","./parte.20261011154227.GORV5SWB.js","./parte.20261011154227.VDAQIURC.js","./parte.20261011154227.VSGNWX2Y.js","./parte.20261011154227.OWRCOUUY.js","./parte.20261011154227.7QGVYRHB.js","./parte.20261011154227.D5E3VKSK.js","./parte.20261011154227.AXNV7KB3.js","./parte.20261011154227.MMPQI64T.js","./parte.20261011154227.Z23PQ7UI.js","./parte.20261011154227.Y6O6JEAS.js","./parte.20261011154227.WLI2AJRU.js","./parte.20261011154227.XAZAKIDK.js","./parte.20261011154227.7VLQ6UJX.js","./parte.20261011154227.2NPOLMEY.js","./parte.20261011154227.6J4GX6RG.js","./parte.20261011154227.NKTJ77D5.js","./parte.20261011154227.LNGZ7IB5.js","./parte.20261011154227.UT575ZM7.js","./parte.20261011154227.GXYRJDGV.js","./parte.20261011154227.L5CKLLCT.js","./parte.20261011154227.URKNTYFI.js","./parte.20261011154227.RT5DUI6L.js","./parte.20261011154227.6LOFPEK3.js","./parte.20261011154227.BQDRZNIW.js","./parte.20261011154227.UWSGNFNN.js","./parte.20261011154227.TBUEMRLO.js","./parte.20261011154227.GFAQWUGX.js","./parte.20261011154227.HM7YGMCM.js","./parte.20261011154227.C4I63YJD.js","./parte.20261011154227.C37A2D32.js","./parte.20261011154227.FZ2QAD6E.js","./parte.20261011154227.I6SBXR5G.js","./parte.20261011154227.ACANM2F4.js","./parte.20261011154227.7EQO75AA.js","./parte.20261011154227.HBFK33NN.js","./parte.20261011154227.WYIIMJ5B.js","./parte.20261011154227.BTUNWWMN.js","./parte.20261011154227.TWB47F47.js","./parte.20261011154227.T2O6SBUI.js","./parte.20261011154227.EODUDIUS.js","./parte.20261011154227.RYXKHTNE.js","./parte.20261011154227.L4U4DBHT.js","./parte.20261011154227.S22EGE3R.js","./parte.20261011154227.35VW47CL.js","./parte.20261011154227.HYAAZT2X.js","./parte.20261011154227.7EFE7KZ3.js","./parte.20261011154227.Z7INZF66.js","./manifest.webmanifest","./fontes/inter.20261011154227.woff2","./estilo.20261011154227.css","./tarefas.20261011154227.js","./oficina.20261011154227.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261011154227.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
