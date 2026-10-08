// Service worker da Arcologia de Held (D38). Joga sem rede e sem misturar versões.
// Cada montagem tem um cache próprio, com o prefixo do app ('heldopolis-previa-' ou 'heldopolis-app-') e o carimbo.
// A lista de arquivos vem do montar.mjs (todos com carimbo no nome, menos a página, o manifesto e os ícones).
// A instalação baixa tudo sem o cache HTTP e falha inteira se faltar um arquivo (a versão anterior continua valendo).
// O activate apaga só os caches do MESMO prefixo: o jogo antigo ('held-') e o outro app (prévia ou app) ficam.
// A página vem da rede (até 3 s) e cai no cache; os outros arquivos vêm do cache desta versão.
// A troca de versão espera o app pedir: postMessage('atualizar').
const PREFIXO = 'heldopolis-previa-';
const CACHE = PREFIXO + '20261008151423';
const ARQUIVOS = ["./","./index.html","./parte.20261008151423.KZ2BIUJV.js","./parte.20261008151423.6UQWF5FO.js","./parte.20261008151423.O4ONGLHV.js","./parte.20261008151423.UUTWL74V.js","./parte.20261008151423.Z7XRNAD4.js","./parte.20261008151423.2PCS2DZZ.js","./parte.20261008151423.FWNLQOYB.js","./parte.20261008151423.2HDBRDRG.js","./parte.20261008151423.44KVL7RG.js","./parte.20261008151423.DWSG5QU5.js","./parte.20261008151423.KF2IKG5A.js","./parte.20261008151423.7IJDTAVF.js","./parte.20261008151423.5Y436KCL.js","./parte.20261008151423.27OCYP7Q.js","./parte.20261008151423.URW6LJOR.js","./parte.20261008151423.EBN5WY52.js","./parte.20261008151423.Q5JMTIVT.js","./parte.20261008151423.2KTHQC6W.js","./parte.20261008151423.TFCC4BKE.js","./parte.20261008151423.24B6AXAE.js","./parte.20261008151423.7SNKZS2V.js","./parte.20261008151423.RPUERVPZ.js","./parte.20261008151423.H4ODUXHZ.js","./parte.20261008151423.XJGMBNWS.js","./parte.20261008151423.ELWH6EBS.js","./parte.20261008151423.R5XUYZYQ.js","./parte.20261008151423.YKYUKD4N.js","./parte.20261008151423.JZDK7GHU.js","./parte.20261008151423.AZBOH2Y4.js","./parte.20261008151423.7OE7CD6I.js","./parte.20261008151423.VXF5VE6P.js","./parte.20261008151423.MLDHJJUU.js","./parte.20261008151423.FLCBOB32.js","./parte.20261008151423.7ME6SK2Y.js","./parte.20261008151423.HXMLSFTF.js","./parte.20261008151423.7IVT7HBA.js","./parte.20261008151423.ORPEJ7PH.js","./parte.20261008151423.4XH5TSU6.js","./parte.20261008151423.I236SBPN.js","./parte.20261008151423.L7FOOZE4.js","./parte.20261008151423.DNGNPE7G.js","./parte.20261008151423.TYE7AYUA.js","./parte.20261008151423.X7HBT753.js","./parte.20261008151423.Z3GMI6CR.js","./jogo.20261008151423.js","./parte.20261008151423.JA24QUTJ.js","./parte.20261008151423.LUWHDQXL.js","./parte.20261008151423.GNKTNCCY.js","./parte.20261008151423.VGOFJZLU.js","./parte.20261008151423.ZEVSJYL4.js","./parte.20261008151423.CJH7S27S.js","./parte.20261008151423.26SJWXH6.js","./parte.20261008151423.VZXR64TR.js","./parte.20261008151423.BJ4HYXSP.js","./parte.20261008151423.BV22QF34.js","./parte.20261008151423.CDXIX5BK.js","./parte.20261008151423.5TV2WJAK.js","./parte.20261008151423.5QLYLUJQ.js","./parte.20261008151423.O4ODF6EG.js","./parte.20261008151423.Z7RRPY75.js","./parte.20261008151423.QNX6B66F.js","./parte.20261008151423.JWSHEB6M.js","./parte.20261008151423.3S2Q3GTX.js","./parte.20261008151423.XFXM65AN.js","./parte.20261008151423.JBKYGWL3.js","./parte.20261008151423.GW2QDE4S.js","./parte.20261008151423.KVCCL23R.js","./parte.20261008151423.6SSZRO6Y.js","./parte.20261008151423.YVXN6FCB.js","./parte.20261008151423.OK6NWI3R.js","./parte.20261008151423.3HNQLCPC.js","./parte.20261008151423.KW3DB3GU.js","./parte.20261008151423.WSF6KWMI.js","./parte.20261008151423.TZXOAWY2.js","./parte.20261008151423.PCYHWTTP.js","./parte.20261008151423.7QVTXBJN.js","./parte.20261008151423.TSKB4BOH.js","./parte.20261008151423.WBRDCQCV.js","./parte.20261008151423.U62RFUUC.js","./parte.20261008151423.LL7YYKVD.js","./parte.20261008151423.4JXONPQF.js","./parte.20261008151423.TIM3BLNI.js","./parte.20261008151423.ZBDV4FQP.js","./parte.20261008151423.VPG2YEJX.js","./parte.20261008151423.UR76ZXZD.js","./parte.20261008151423.R2RYDW4E.js","./parte.20261008151423.4XBQ76QV.js","./parte.20261008151423.KJOJSITA.js","./parte.20261008151423.7FKOE27K.js","./parte.20261008151423.CXKNBM7F.js","./parte.20261008151423.4BBAMJIK.js","./parte.20261008151423.E3X3XYT2.js","./parte.20261008151423.NWMN3YAH.js","./parte.20261008151423.ZAGXSMMM.js","./parte.20261008151423.GWMAGI5H.js","./parte.20261008151423.BJDF4ICY.js","./parte.20261008151423.ANLZMNLV.js","./parte.20261008151423.XTVBDWWP.js","./parte.20261008151423.KZMXFONG.js","./parte.20261008151423.REGOJPYZ.js","./parte.20261008151423.657HU6XK.js","./parte.20261008151423.43X7ZM3K.js","./parte.20261008151423.TTP6AAC6.js","./parte.20261008151423.7D6OLU7T.js","./parte.20261008151423.XGLPLPWR.js","./parte.20261008151423.27MLVN3P.js","./parte.20261008151423.JKD2AK5A.js","./parte.20261008151423.FJO6KBUZ.js","./parte.20261008151423.6UHGLOXD.js","./parte.20261008151423.CJ3O7AC6.js","./parte.20261008151423.XE675E5M.js","./parte.20261008151423.FMYQDPYP.js","./parte.20261008151423.MADDBEFR.js","./parte.20261008151423.MU6BZJQS.js","./parte.20261008151423.HS4RVKWQ.js","./parte.20261008151423.TI5ZUZAE.js","./parte.20261008151423.VFPW5CDP.js","./parte.20261008151423.HUHR52UE.js","./parte.20261008151423.IHDIGFOA.js","./parte.20261008151423.32E5XRFC.js","./manifest.webmanifest","./fontes/inter.20261008151423.woff2","./estilo.20261008151423.css","./tarefas.20261008151423.js","./oficina.20261008151423.js","./icones/icone-192.png","./icones/icone-512.png","./icones/icone-mascaravel-512.png","./materiais/chao-camadas.20261008151423.ktx2","./basis/basis_transcoder.js","./basis/basis_transcoder.wasm","./cenas.html"];

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
