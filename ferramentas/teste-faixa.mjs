// Teste do motor da Faixa (fonte/render/models/faixa.js) em node, com um document falso: def.ordem, def.aberturaDe, def.nos
// (tambores), def.pilares, a tampa acabada das pontas retas, as Faixas de antes da rodada Trevo com a mesma contagem de
// triângulos (os números de HEAD estão embutidos) e a Faixa do Anel do plano mestre (revisão 6) sem NaN.
// Uso: node ferramentas/teste-faixa.mjs [--medir] → 'teste-faixa ok' (ou as falhas, com código 1). --medir imprime as
// contagens das Faixas antigas (para atualizar PADRAO quando a tampa mudar de propósito).
globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ data: [] }) }), width: 0, height: 0 }) };
globalThis.window = globalThis; globalThis.self = globalThis;
const THREE = await import('three');
const { Faixa } = await import(new URL('../fonte/render/models/faixa.js', import.meta.url).href);
const { ellipse, curve, medidas } = await import(new URL('../fonte/render/geom.js', import.meta.url).href);

const falhas = []; const f = (ok, msg) => { if (!ok) falhas.push(msg); };
const secao = (nome, fn) => { try { fn(); } catch (e) { falhas.push(nome + ': exceção ' + (e.stack || e.message).split('\n').slice(0, 3).join(' <- ')); } }; // uma seção que quebra não esconde as outras
const perto = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;
const tri = (o) => { let n = 0; o.traverse((m) => { if (m.isMesh && m.geometry) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); } }); return n; };
const triMapa = (mp) => { let n = 0; for (const g of mp.values()) n += g.index.count / 3; return n; };
const soma = (o) => { let s = 0; o.traverse((m) => { if (m.isMesh && !m.isInstancedMesh) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) s += p.getX(i) + 2 * p.getY(i) + 3 * p.getZ(i); } }); return s; };
// vértices (x, y, z, nx, ny, nz, chave do material) das malhas não instanciadas de um objeto (em node os materiais não
// existem: cada malha ganha um padrão, então a comparação é pela chave userData.matKey)
const vertices = (o) => { const out = []; o.updateMatrixWorld(true); o.traverse((m) => { if (!m.isMesh || m.isInstancedMesh) return; const p = m.geometry.attributes.position, n = m.geometry.attributes.normal; for (let i = 0; i < p.count; i++) out.push([p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 0, n ? n.getZ(i) : 0, m.userData.matKey]); }); return out; };
const finito = (o) => { let ok = true; o.traverse((m) => { if (m.isMesh) { for (const v of m.geometry.attributes.position.array) if (!Number.isFinite(v)) ok = false; if (m.isInstancedMesh) for (const v of m.instanceMatrix.array) if (!Number.isFinite(v)) ok = false; } }); return ok; };
const caixaDe = (o) => new THREE.Box3().setFromObject(o);
const reta = (x0, x1, z = 0, n = 40) => Array.from({ length: n + 1 }, (_, k) => [x0 + ((x1 - x0) * k) / n, z]);

// ------------------------------------------------------------------ Faixas de antes (aneis.js faixas(), centro.js alaOnda(),
// campus.js escolaBloco) com os números da planta de HEAD embutidos; sem extraGeo/decor (dependem da planta antiga)
function defsAntigas() {
  const fr = (n) => (Number.isInteger(n) ? n + 1e-4 : n);
  const arco = (cx, cz, r, a0, a1, n = 24, rz = r) => { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([fr(cx + Math.cos(a) * r), fr(cz + Math.sin(a) * rz)]); } return out; };
  const a = { c: [-18.6, 13.600000000000001], rx: 11.4, rz: 9.2, rot: -0.1 }, ar = { c: [-16.6, -22.7], rx: 7.7, rz: 3.8, rot: 0, a0: 2.95, a1: 5.64 };
  const elo = [[-24.8, -19.4], [-27.2, -17.2], [-29.2, -12.5], [-29.2, -7.1], [-27.6, -2.6]], s = { centro: [23.0001, -15.0001], r: 10.8, a0: (-165 * Math.PI) / 180, a1: (15 * Math.PI) / 180, largura: 1.2 };
  const sdPath = [[-9.5, -6.2], [-9.5, -9.1], [-9.5, -12.1], [-9.4999, -15.000099999999998], [-9.317360163830688, -16.85345805915322], [-8.776755558857225, -18.63559260746835], [-7.898861316874182, -20.27801721368622], [-6.717414421272204, -21.717614421272202], [-5.277817213686221, -22.89906131687418], [-3.635392607468358, -23.77695555885722], [-1.8532580591532224, -24.317560163830688], [0.00009999999999825489, -24.5001], [1.8534580591532188, -24.317560163830688], [3.635592607468355, -23.776955558857225], [5.278017213686217, -22.89906131687418], [6.7176144212721995, -21.717614421272202], [7.89906131687418, -20.27801721368622], [8.776955558857221, -18.635592607468357], [9.317560163830688, -16.853458059153223], [9.5001, -15.000100000000002], [9.5, -12.1], [9.5, -9.1], [9.5, -6.2]];
  const b = { c: [15.1, 11.2], r1: 6.5, a0: 2.9, a1: 4.6 }, onda = [[-24.5, -17.1], [-22.1, -18.2], [-19.5, -17.1], [-17.1, -18.2], [-14.6, -17.6]];
  return {
    anel: { id: 'anel', closed: true, path: ellipse(a.c[0], a.c[1], a.rx, a.rz, a.rot, 260, 0.025, 2), modulos: 8,
      cortes: [0, 0.11, 0.24, 0.37, 0.5, 0.62, 0.75, 0.88, 1].map((v) => v + 0.03), aberturas: [2, 5], abertura: 1.2, passo: 0.32, ponta: 2.4, pontaDegrau: { leste: true },
      prof: { o0: -3.0, o1: 0, setIn: 0.5, setOut: 0.02, beiral: 0.16, slab: 0.05, curb: 0.04, curbW: 0.08, passeioW: 0.22, passeioAt: 0.25, taludeAndares: 2, fac: 'fac_fita', facIn: 'fac_fita' },
      niveis: 5, arbustoPasso: 0.8, arbustoMax: 900, arbustoFora: 0.4, moitas: true, ripaPasso: 0.2 },
    uni: { id: 'uni', closed: false, path: ellipse(ar.c[0], ar.c[1], ar.rx, ar.rz, ar.rot, 200, 0, 1, ar.a0, ar.a1), modulos: 4, ponta: 0,
      prof: { o0: -1.4, o1: 0, setIn: 0, setOut: 0, fh: 0.44, beiral: 0, curb: 0, curbW: 0.14, celular: true, fac: 'fac_celular', facIn: 'fac_celular', roof: 'roof' }, niveis: 5, ripas: false, arbustoPasso: 1.2 },
    uniElo: { id: 'uniElo', closed: false, path: curve(elo, false, 90), modulos: 2, ponta: 0, prof: { o0: -0.55, o1: 0.55, setIn: 0.12, setOut: 0.12, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3 },
    humanidades: { id: 'humanidades', closed: false, path: ellipse(a.c[0] + 0.3, a.c[1] - 0.2, a.rx - 3.95, a.rz - 3.65, a.rot, 90, 0.02, 3, 3.9, 5.55), modulos: 1,
      prof: { o0: -0.95, o1: 0, setIn: 0.24, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3, arbustos: true },
    anelBib: { id: 'anelBib', closed: false, path: ellipse(b.c[0], b.c[1], b.r1, b.r1 * 0.92, 0, 120, 0, 1, b.a0, b.a1), modulos: 3, ponta: 0.6,
      prof: { o0: -2.8, o1: 0, setIn: 0, setOut: 0.5, fh: 0.55, fac: 'fac_fita', facIn: 'fac_colmeia', caminho: 'grey' }, niveis: 3 },
    santuario: { id: 'santuario', closed: false, path: curve(arco(s.centro[0], s.centro[1], s.r, s.a0, s.a1, 40), false, 220), modulos: 5, cortes: [0, 0.2, 0.4, 0.6, 0.8, 1], passo: 0.24, ponta: 1.6,
      prof: { o0: -s.largura, o1: 0, setIn: 0.12, setOut: 0.03, curbMat: 'fasciaBeiral', fac: 'fac_ambar', facIn: 'fac_ambar', roof: 'roof', passeio: false }, niveis: 4, arbustoPasso: 0.9, arbustoMax: 400 },
    sede: { id: 'sede', closed: false, path: curve(sdPath, false, 260), modulos: 4, passo: 0.32, ponta: 0, ponta1: 0, andaresExtra: 1,
      prof: { o0: -2.1, o1: 0, setIn: 0, setOut: 0, beiral: 0.22, slab: 0.07, curb: 0.14, curbW: 0.03, curbMat: 'fasciaBeiral', fac: 'fac_fita', facIn: 'fac_fita', roof: 'roofMetal', passeio: false }, niveis: 4, arbustos: false, ripas: false },
    onda: { id: 'onda', closed: false, path: curve(onda, false, 120), modulos: 1, prof: { o0: -0.5, o1: 0.7, setIn: 0, setOut: 0.28, fac: 'fac_lab', facIn: 'fac_quente' }, niveis: 3 },
    escolaBloco: { id: 'escolaBloco', closed: false, path: curve([[-25.6, 15.7], [-24.4, 17.2], [-22.4, 16.9], [-20.9, 18.0001]], false, 60), modulos: 1, ponta: 1.0, passo: 0.26,
      prof: { o0: -0.5, o1: 0.5, setIn: 0.12, setOut: 0.12, beiral: 0.12, slab: 0.05, curb: 0.04, curbW: 0.08, passeioW: 0.12, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3 },
  };
}
// triângulos medidos em HEAD (antes da rodada Trevo), com a faixa.js de então: n<nível> = [fundido, arbustos+ripas] com
// setTodos(nível); lotes = todos os módulos no lote vazio; andar = [acabado, esqueleto] de andar(0, 0, max),
// andar(0, max-1, max) e andar(último, 1, 2); geo = _geo(i, max) por módulo
const ANTES = {"anel":{"n5":[23623,12190],"n2":[13518,7148],"n1":[8598,3706],"lotes":1218,"andar":[[276,344],[1058,344],[1150,380]],"geo":[2714,2572,3123,3186,2769,3123,3186,2950]},"uni":{"n5":[2704,312],"n2":[1936,312],"n1":[1680,312],"lotes":384,"andar":[[130,248],[360,248],[360,248]],"geo":[680,672,672,680]},"uniElo":{"n3":[6564,2100],"n2":[4812,1500],"n1":[3060,912],"lotes":432,"andar":[[730,548],[1674,548],[1674,548]],"geo":[3282,3282]},"humanidades":{"n3":[5214,1080],"n2":[3822,936],"n1":[2430,576],"lotes":342,"andar":[[1160,856],[2658,856],[2658,856]],"geo":[5214]},"anelBib":{"n3":[4944,1230],"n2":[3624,884],"n1":[2304,550],"lotes":324,"andar":[[410,300],[938,300],[938,300]],"geo":[1842,1260,1842]},"santuario":{"n4":[16278,4280],"n2":[9174,2380],"n1":[5622,1514],"lotes":882,"andar":[[610,460],[1278,460],[1278,460]],"geo":[3354,3190,3190,3190,3354]},"sede":{"n4":[20500,0],"n2":[9484,0],"n1":[5812,0],"lotes":912,"andar":[[770,564],[1614,564],[1614,564]],"geo":[5158,5092,5092,5158]},"onda":{"n3":[4764,1170],"n2":[3492,852],"n1":[2220,522],"lotes":312,"andar":[[1060,776],[2428,776],[2428,776]],"geo":[4764]},"escolaBloco":{"n3":[2750,552],"n2":[1982,468],"n1":[1214,288],"lotes":186,"andar":[[516,468],[1462,468],[1462,468]],"geo":[2750]}};
// o Anel antigo sem pontaDegrau, em HEAD (a correção do degrau só muda o módulo do degrau)
const ANTES_SEM_DEGRAU = {"n5":[24174,12326],"n2":[13518,7148],"n1":[8598,3706],"lotes":1218,"andar":[[276,344],[1058,344],[1150,380]],"geo":[2714,3123,3123,3186,2769,3123,3186,2950]};
// o que muda de propósito com tampa: false: o degrau do Anel (em HEAD o trecho da ponta ficava com todos os andares e o
// corpo com 4 no máximo; agora o corpo tem 5, o degrau 4 e a ponta 2, como em andar())
const DEGRAU_ANEL = { n5: [23941, 12190], geo: [2714, 2890, 3123, 3186, 2769, 3123, 3186, 2950] };
// com a tampa acabada (padrão) nas pontas retas: uni, uniElo e sede mudam só nas pontas
const PADRAO = {"anel":{"n5":[23941,12190],"n2":[13518,7148],"n1":[8598,3706],"lotes":1218,"andar":[[276,344],[1058,344],[1150,380]],"geo":[2714,2890,3123,3186,2769,3123,3186,2950]},"uni":{"n5":[2708,312],"n2":[1940,312],"n1":[1684,312],"lotes":384,"andar":[[132,248],[360,248],[360,248]],"geo":[682,672,672,682]},"uniElo":{"n3":[6540,2088],"n2":[4796,1492],"n1":[3052,908],"lotes":432,"andar":[[728,548],[1670,548],[1670,548]],"geo":[3270,3270]},"humanidades":{"n3":[5214,1080],"n2":[3822,936],"n1":[2430,576],"lotes":342,"andar":[[1160,856],[2658,856],[2658,856]],"geo":[5214]},"anelBib":{"n3":[4944,1230],"n2":[3624,884],"n1":[2304,550],"lotes":324,"andar":[[410,300],[938,300],[938,300]],"geo":[1842,1260,1842]},"santuario":{"n4":[16278,4280],"n2":[9174,2380],"n1":[5622,1514],"lotes":882,"andar":[[610,460],[1278,460],[1278,460]],"geo":[3354,3190,3190,3190,3354]},"sede":{"n4":[20500,0],"n2":[9484,0],"n1":[5812,0],"lotes":912,"andar":[[772,564],[1614,564],[1614,564]],"geo":[5158,5092,5092,5158]},"onda":{"n3":[4764,1170],"n2":[3492,852],"n1":[2220,522],"lotes":312,"andar":[[1060,776],[2428,776],[2428,776]],"geo":[4764]},"escolaBloco":{"n3":[2750,552],"n2":[1982,468],"n1":[1214,288],"lotes":186,"andar":[[516,468],[1462,468],[1462,468]],"geo":[2750]}};
// passeio do teto (pontos por linha) no máximo, no nível 2 e no 1: não muda
const CAMINHO = {"anel":["63,40","66,40","66,40"],"uni":["33","33","33"],"uniElo":["37","37","37"],"humanidades":["30","30","30"],"anelBib":["28","28","28"],"santuario":["","",""],"sede":["","",""],"onda":["27","27","27"],"escolaBloco":["17","17","17"]};
function medir(d) {
  const F = new Faixa(d); const r = {}; const cam = [];
  for (const n of [F.max, 2, 1]) { F.setTodos(n); r['n' + n] = [tri(F.merged), tri(F.extras)]; cam.push(F.caminhoTeto().map((l) => l.length).join(',')); }
  F.setTodos(0); for (const m of F.mods) m.lote = true; F.refresh(); r.lotes = tri(F.lotes);
  r.andar = [[0, 0, F.max], [0, F.max - 1, F.max], [F.mods.length - 1, 1, 2]].map(([i, fl, FF]) => { const a = F.andar(i, fl, FF); return [tri(a.acabado), tri(a.esqueleto)]; });
  r.geo = F.mods.map((m, i) => triMapa(F._geo(i, F.max))); return { r, cam };
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (process.argv.includes('--medir')) { const out = {}; for (const [k, d] of Object.entries(defsAntigas())) out[k] = medir(d).r; console.log(JSON.stringify(out)); process.exit(0); }
secao('antigas', () => { for (const [k, d] of Object.entries(defsAntigas())) {
  const semTampa = medir({ ...d, tampa: false }).r, esperado = { ...ANTES[k], ...(k === 'anel' ? DEGRAU_ANEL : {}) };
  for (const q of Object.keys(esperado)) f(igual(semTampa[q], esperado[q]), `antigas ${k} (tampa: false) ${q}: ${JSON.stringify(semTampa[q])} (esperado ${JSON.stringify(esperado[q])})`);
  const { r, cam } = medir(d); for (const q of Object.keys(PADRAO[k])) f(igual(r[q], PADRAO[k][q]), `antigas ${k} ${q}: ${JSON.stringify(r[q])} (esperado ${JSON.stringify(PADRAO[k][q])})`);
  f(igual(cam, CAMINHO[k]), `antigas ${k} caminhoTeto ${JSON.stringify(cam)} (antes ${JSON.stringify(CAMINHO[k])})`);
} });
secao('anel antigo sem degrau', () => { const d = defsAntigas().anel; delete d.pontaDegrau; const { r } = medir({ ...d, tampa: false }); for (const q of Object.keys(ANTES_SEM_DEGRAU)) f(igual(r[q], ANTES_SEM_DEGRAU[q]), `anel antigo sem degrau ${q}: ${JSON.stringify(r[q])} (antes ${JSON.stringify(ANTES_SEM_DEGRAU[q])})`); });
// pontas afinadas: a tampa acabada não muda nada (mesma geometria, vértice a vértice)
secao('afinadas', () => { for (const k of ['anel', 'santuario', 'anelBib', 'onda']) { const a = new Faixa(defsAntigas()[k]), b = new Faixa({ ...defsAntigas()[k], tampa: false }); a.setTodos(a.max); b.setTodos(b.max); f(tri(a.merged) === tri(b.merged) && perto(soma(a.merged), soma(b.merged), 1e-3), `afinadas ${k}: a tampa acabada mudou a geometria`); } });
// extraGeo e decor continuam: entram só com todos os módulos no máximo
secao('extraGeo e decor', () => {
  const d = defsAntigas().uniElo; let chamadas = 0;
  const F = new Faixa({ ...d, extraGeo: () => { chamadas++; return new Map([['concreto', new THREE.BoxGeometry(1, 1, 1).toNonIndexed().setIndex([...Array(36).keys()])]]); }, decor: () => [new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))] });
  F.setTodos(2); const semExtra = tri(F.merged); f(!F.extras.children.some((c) => c.name.endsWith('-decor')), 'decor antes do máximo');
  F.setTodos(F.max); f(F.merged.children.some((c) => c.userData.matKey === 'concreto') && chamadas === 1 && semExtra > 0, 'extraGeo não entrou no máximo'); f(F.extras.children.some((c) => c.name.endsWith('-decor')), 'decor não entrou no máximo');
});

// ------------------------------------------------------------------ ordem: o módulo do jogo i no trecho ordem[i]
secao('ordem', () => {
  const path = ellipse(0, 0, 10, 7, 0, 160, 0, 1, 0, Math.PI); const base = { id: 'o', closed: false, path, modulos: 4, aberturas: [2], abertura: 1.0, ponta: 0, prof: { o0: -1, o1: 1, setIn: 0.2, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3, arbustos: 'teto' };
  const ordem = [2, 0, 3, 1]; const A = new Faixa({ ...base, ordem }), B = new Faixa(base);
  f(A.trechos.length === 4 && A.trechos.every((m, t) => m.t === t), 'ordem: trechos fora da ordem do caminho');
  ordem.forEach((t, i) => { f(A.mods[i].t === t && A.mods[i].i === i && A.trechos[t] === A.mods[i], `ordem: mods[${i}] não é o trecho ${t}`); f(igual(A.mods[i].path, B.mods[t].path), `ordem: caminho do módulo ${i}`); const [x, z] = A.centro(i), [x2, z2] = B.centro(t); f(perto(x, x2) && perto(z, z2), `ordem: centro(${i}) fora do trecho ${t}`); });
  A.setNivel(0, 3); B.setNivel(ordem[0], 3); f(tri(A.merged) === tri(B.merged) && caixaDe(A.merged).equals(caixaDe(B.merged)), 'ordem: setNivel(0) não subiu o trecho ordem[0]');
  const a1 = A.andar(1, 1, 3), b1 = B.andar(ordem[1], 1, 3); f(tri(a1.acabado) === tri(b1.acabado) && caixaDe(a1.acabado).equals(caixaDe(b1.acabado)), 'ordem: andar(1) não é o do trecho ordem[1]');
  A.setTodos(3); B.setTodos(3); f(tri(A.merged) === tri(B.merged) && perto(soma(A.merged), soma(B.merged), 1e-2), 'ordem: a fusão não junta tudo na ordem do caminho');
  f(tri(A.extras) === tri(B.extras), 'ordem: arbustos e ripas'); f(igual(A.caminhoTeto(), B.caminhoTeto()), 'ordem: caminhoTeto');
  for (const [i, n] of [[0, 1], [1, 3], [2, 2], [3, 0]]) { A.mods[i].nivel = n; B.mods[ordem[i]].nivel = n; } A.refresh(); B.refresh(); f(igual(A.caminhoTeto(), B.caminhoTeto()) && tri(A.merged) === tri(B.merged), 'ordem: níveis misturados');
  let erro = false; try { new Faixa({ ...base, ordem: [0, 0, 1, 2] }); } catch (_) { erro = true; } f(erro, 'ordem inválida não deu erro');
  // anel fechado: o laço do passeio junta o último e o primeiro trecho, com a ordem trocada
  const fech = { id: 'of', closed: true, path: ellipse(0, 0, 9, 7, 0, 180), modulos: 4, aberturas: [2], ponta: 0, prof: { o0: -2, o1: 0, setIn: 0.2, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 3 };
  const C1 = new Faixa({ ...fech, ordem: [3, 1, 0, 2] }), C2 = new Faixa(fech); C1.setTodos(3); C2.setTodos(3); f(igual(C1.caminhoTeto(), C2.caminhoTeto()) && C1.caminhoTeto().length === 1, 'ordem: laço do caminhoTeto no anel fechado');
});

// ------------------------------------------------------------------ aberturaDe: vão com largura própria por corte
secao('aberturaDe', () => {
  const F = new Faixa({ id: 'ab', closed: false, path: reta(0, 20), cortes: [0, 0.25, 0.5, 0.75, 1], aberturas: [1, 2, 3], aberturaDe: { 1: 2.0, 3: 4.0 }, abertura: 1.0, ponta: 0, prof: { o0: -1, o1: 1 }, niveis: 2 });
  const vao = (t) => F.trechos[t + 1].path[0][0] - F.trechos[t].path.at(-1)[0];
  f(perto(vao(0), 2.0) && perto(vao(1), 1.0) && perto(vao(2), 4.0), `aberturaDe: vãos ${[0, 1, 2].map((t) => vao(t).toFixed(3))} (esperado 2, 1, 4)`);
  const G = new Faixa({ id: 'abf', closed: true, path: ellipse(0, 0, 10, 10, 0, 400), modulos: 4, aberturas: [0, 2], aberturaDe: { 0: 3.0 }, abertura: 1.5, ponta: 0, prof: { o0: -1, o1: 1 }, niveis: 2 });
  const arcoEntre = (p, q) => { const a = Math.atan2(p[1], p[0]), b = Math.atan2(q[1], q[0]); let d = b - a; while (d < 0) d += 2 * Math.PI; return d * 10; };
  f(perto(arcoEntre(G.trechos[3].path.at(-1), G.trechos[0].path[0]), 3.0, 0.02) && perto(arcoEntre(G.trechos[1].path.at(-1), G.trechos[2].path[0]), 1.5, 0.02), 'aberturaDe no anel fechado (corte 0 e corte 2)');
});

// ------------------------------------------------------------------ nós (tambores)
secao('nós', () => {
  const prof = { o0: -1.5, o1: 1.5, setIn: 0.22, setOut: 0.02, fh: 0.5, beiral: 0.16, slab: 0.05, curb: 0.04, curbW: 0.08, fac: 'fac_fita', facIn: 'fac_fita' }; const md = medidas(prof);
  const F = new Faixa({ id: 'no', closed: false, path: reta(0, 20), cortes: [0, 0.5, 1], aberturas: [1], aberturaDe: { 1: 6.74 }, ordem: [1, 0], nos: [{ c: [10, 0], r: 3, modulo: 1 }], ponta: 0, prof, niveis: 5, andaresExtra: 2 });
  const no = F.mods[1].nos[0]; f(F.mods[1].t === 0 && no && F.mods[0].nos.length === 0, 'nós: o tambor não ficou com o módulo do jogo 1');
  const naRoda = (o, r0, r1) => vertices(o).filter(([x, , z]) => { const d = Math.hypot(x - 10, z); return d >= r0 && d <= r1; });
  F.setTodos(0); f(naRoda(F.merged, 0, 3.3).length === 0, 'nós: tambor no nível 0');
  F.mods[1].lote = true; F.refresh(); f(naRoda(F.lotes, 0, 3.05).length > 0, 'nós: o lote vazio não desenha o tambor no chão');
  F.setNivel(0, 5); f(naRoda(F.merged, 0, 3.3).length === 0, 'nós: o tambor apareceu com o outro módulo');
  F.setNivel(1, 5); const Fg = 7, topo = md.y(Fg) + md.slab;
  const casca = naRoda(F.merged, 1.5, 3.3), lant = naRoda(F.merged, 0, 1.3); f(casca.length > 0 && lant.length > 0, 'nós: o tambor não apareceu no nível máximo');
  const yCasca = Math.max(...casca.map((v) => v[1])), yLant = Math.max(...lant.map((v) => v[1]));
  f(perto(yCasca, topo + md.curb) && perto(yCasca, F.alturaTopo(5) - 0.1 + md.slab + md.curb), `nós: topo do tambor ${yCasca.toFixed(3)} fora da altura da fita (alturaTopo ${F.alturaTopo(5)})`);
  const yFita = Math.max(...vertices(F.merged).filter(([x]) => x < 6).map((v) => v[1])); f(perto(yCasca, yFita), `nós: tambor ${yCasca.toFixed(3)} e fita ${yFita.toFixed(3)} em alturas diferentes`);
  f(perto(yLant, md.y(Fg) + 0.35) && perto(yLant, 3.85), `nós: lanterna ${yLant.toFixed(3)} (esperado 3,85: teto 3,5 + 0,35, como no plano)`);
  const cx = F.caixa(1); f(cx.max.y >= yLant - 1e-6 && cx.min.x <= 10 - 3 && cx.max.x >= 10 + 3 && cx.max.z >= 3, 'nós: caixa(1) sem o tambor');
  const pg = F.pegada(1); f(pg.length === 2 && pg[1].length === 24 && pg[1].every(([x, z]) => perto(Math.hypot(x - 10, z), 3)), 'nós: pegada(1) sem o círculo do tambor');
  f(F.dentro(1, 10, 2.5) && !F.dentro(0, 10, 2.5) && F.dentro(1, 10, 0, 1.0) && !F.dentro(1, 10, 0, 9), 'nós: dentro()');
  for (let fl = 0; fl < 5; fl++) {
    const a = F.andar(1, fl, 5), b = F.andar(0, fl, 5); const va = naRoda(a.acabado, 2.0, 3.3);
    f(va.length > 0 && va.every((v) => v[1] >= md.y(fl) - 1e-6 && v[1] <= md.y(fl + 1) + md.slab + md.curb + 0.36), `nós: andar(1, ${fl}, 5) sem o andar ${fl} do tambor`);
    f(naRoda(b.acabado, 0, 3.3).length === 0, `nós: andar(0, ${fl}, 5) com o tambor`);
    f(naRoda(a.esqueleto, 0, 3.1).length > 0, `nós: esqueleto do andar ${fl} sem a laje do tambor`);
    const vg = (o) => o.esqueleto.children.find((c) => c.isInstancedMesh).count; f(vg(a) === vg(F.andar(1, fl, 5)) && vg(a) >= 12 + 2, `nós: vigas do tambor no andar ${fl}`);
  }
  f(naRoda(F.andar(1, 4, 5).acabado, 0, 1.3).length > 0, 'nós: a lanterna não sobe com o último andar da obra');
  const t7 = triMapa(F._tamborGeo(no, 7)), t8 = triMapa(F._tamborGeo(no, 8)), t1 = triMapa(F._tamborGeo(no, 1));
  f(t7 > 1500 && t7 < 2800 && t8 < 3000, `nós: tambor com ${t7} triângulos (alvo ~2,4 mil)`); console.log(`tambor: ${t1} triângulos com 1 andar, ${t7} com 7 (Anel), ${t8} com 8 (Sede)`);
});

// ------------------------------------------------------------------ pilares (do chão até prof.y0)
secao('pilares', () => {
  const larga = new Faixa({ id: 'pl', closed: false, path: reta(-4, 4, 0), modulos: 1, ponta: 0, pilares: { passo: 1.9, r: 0.08 }, prof: { o0: -1.5, o1: 1.5, y0: 1.55, fh: 1.0, setIn: 0 }, niveis: 1 });
  larga.setTodos(1); const conc = vertices(larga.merged).filter((v) => v[6] === 'concreto');
  f(conc.length === 2 * 4 * 32, `pilares: ${conc.length / 32} pilares na fita larga (esperado 8)`);
  f(conc.length && Math.min(...conc.map((v) => v[1])) <= 0 && perto(Math.max(...conc.map((v) => v[1])), 1.55), 'pilares: não vão do chão até y0');
  f(conc.every((v) => perto(Math.abs(v[2]), 1.35, 0.081)), 'pilares: fora das bordas (o0 + 0,15 e o1 - 0,15)');
  const sof = vertices(larga.merged).filter((v) => perto(v[1], 1.55) && perto(v[4], -1)); f(sof.length > 0, 'pilares: fita no alto sem a face de baixo');
  f(larga.caixa(0).min.y <= 0, 'pilares: caixa(0) não chega ao chão');
  const a0 = larga.andar(0, 0, 1).acabado; f(vertices(a0).some((v) => v[6] === 'concreto' && v[1] <= 0), 'pilares: fora do acabado do andar 0 da obra');
  const estreita = new Faixa({ id: 'pe', closed: false, path: reta(-4, 4, 0), modulos: 1, ponta: 0, pilares: { passo: 2, r: 0.07 }, prof: { o0: -0.75, o1: 0.75, y0: 0.9, fh: 0.7, setIn: 0 }, niveis: 2 });
  estreita.setTodos(2); const ce = vertices(estreita.merged).filter((v) => v[6] === 'concreto');
  f(ce.length === 4 * 32 && ce.every((v) => Math.abs(v[2]) <= 0.071), 'pilares: a fita estreita (< 1,6) não tem os pilares só no eixo');
  f(!vertices(estreita.andar(0, 1, 2).acabado).some((v) => v[6] === 'concreto'), 'pilares: no andar 1 da obra');
  // portal do plano: 4 pilares nas quinas da boca (pontas: true), fora da faixa do Bulevar (|x| < 0,95) e dentro das pontas
  const portal = new Faixa({ id: 'pq', closed: false, path: [[1.935, 8.412], [-1.935, 8.412]], modulos: 1, ponta: 0, pilares: { pontas: true, passo: 4, r: 0.08 }, prof: { o0: -1.5, o1: 1.5, y0: 1.55, fh: 0.5, setIn: 0, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 2 });
  portal.setTodos(2); const cq = vertices(portal.merged).filter((v) => v[6] === 'concreto'); const xs = [...new Set(cq.map((v) => Math.round(v[0] * 20) / 20))];
  f(cq.length === 4 * 32 && cq.every((v) => Math.abs(v[0]) >= 0.95 + 0.5 && Math.abs(v[0]) <= 1.935 - 0.06 && perto(Math.abs(v[2] - 8.412), 1.35, 0.081)), `pilares: portal sem os 4 pilares nas quinas (${cq.length / 32} pilares, x ${xs.slice(0, 6)})`);
  const sem = new Faixa({ id: 'ps', closed: false, path: reta(-4, 4, 0), modulos: 1, ponta: 0, prof: { o0: -1, o1: 1, y0: 1.2 }, niveis: 1 }); sem.setTodos(1); f(!sem.merged.children.some((c) => c.userData.matKey === 'concreto'), 'pilares sem def.pilares');
});

// ------------------------------------------------------------------ tampa acabada (pontas retas)
secao('tampa', () => {
  const prof = { o0: -1, o1: 1, setIn: 0.2, setOut: 0.1, fac: 'fac_fita', facIn: 'fac_fita' }; const md = medidas(prof); const B = md.B;
  const nova = new Faixa({ id: 'ta', closed: false, path: reta(0, 10), modulos: 1, ponta: 0, prof, niveis: 3 }), velha = new Faixa({ id: 'tv', closed: false, path: reta(0, 10), modulos: 1, ponta: 0, tampa: false, prof, niveis: 3 });
  nova.setTodos(3); velha.setTodos(3); const vN = vertices(nova.merged), vV = vertices(velha.merged);
  const ponta = (vs, mat, x, sx) => vs.filter((v) => v[6] === mat && perto(v[0], x, 1e-3) && perto(v[3], sx, 1e-3));
  f(ponta(vN, 'fac_fita', 10 - B, 1).length > 0 && ponta(vN, 'fac_fita', B, -1).length > 0, 'tampa: sem a fachada recuada nas duas pontas');
  f(ponta(vV, 'fac_fita', 10, 1).length === 0 && ponta(vV, 'fac_fita', 10 - B, 1).length === 0 && ponta(vV, 'fasciaBeiral', 10, 1).length > 0, 'tampa: a tampa antiga (tampa: false) mudou');
  const caras = ponta(vN, 'fasciaBeiral', 10, 1);
  f(caras.length > 0, 'tampa: sem as lajes fechando a ponta');
  const noVidro = (y) => [0, 1, 2].some((fl) => y > md.y(fl) + md.slab + md.curb + 0.01 && y < md.y(fl + 1) - 0.01); f(!caras.some((v) => noVidro(v[1])), 'tampa: face crua de laje no meio do vidro');
  // gap (vão total em cada corte interno, gap / 2 de cada lado, como a Vila do plano: def.gap 0,2): cada casa com as duas pontas acabadas
  const casas = new Faixa({ id: 'tg', closed: false, path: reta(0, 12), modulos: 3, gap: 0.2, ponta: 0, prof: { ...prof, fac: 'whiteSmooth' }, niveis: 3 }); casas.setTodos(3);
  const vc = vertices(casas.merged);
  for (const m of casas.trechos) for (const [x, sx] of [[m.path[0][0] + B, -1], [m.path.at(-1)[0] - B, 1]]) f(ponta(vc, 'whiteSmooth', x, sx).length > 0, `tampa: junta do gap sem a ponta acabada (x ${x.toFixed(2)})`);
  f(perto(casas.trechos[1].path[0][0] - casas.trechos[0].path.at(-1)[0], 0.2) && perto(casas.trechos[0].path[0][0], 0) && perto(casas.trechos[2].path.at(-1)[0], 12), 'gap: vão de 0,2 entre as casas (e nada nas pontas da fita)');
  // corte interno ao lado de um vizinho mais baixo (lote vazio): a ponta fica acabada; nível igual: nada
  const par = new Faixa({ id: 'tp', closed: false, path: reta(0, 12), modulos: 2, ponta: 0, prof, niveis: 3 });
  par.setTodos(3); f(ponta(vertices(par.merged), 'fac_fita', 6 - B, 1).length === 0, 'tampa: corte interno com os vizinhos no mesmo nível');
  par.setNivel(1, 0); f(ponta(vertices(par.merged), 'fac_fita', 6 - B, 1).length > 0, 'tampa: módulo pronto ao lado do lote vazio sem a ponta acabada');
  par.setNivel(1, 1); const deg = ponta(vertices(par.merged), 'fac_fita', 6 - B, 1); f(deg.length > 0 && deg.every((v) => v[1] >= md.y(1) + md.slab - 1e-6), 'tampa: degrau ao lado do vizinho mais baixo');
  // talude ao lado de um vizinho mais baixo sem talude (nível 2): a rampa fecha com a cunha de arrimo nos andares 0 e 1
  const tal = new Faixa({ id: 'tt', closed: false, path: reta(0, 10), modulos: 2, ponta: 0, prof: { o0: -1.5, o1: 1.5, setIn: 0.22, fh: 0.5, beiral: 0.16, slab: 0.05, curb: 0.04, curbW: 0.08, taludeAndares: 2 }, niveis: 5 });
  tal.mods[0].nivel = 5; tal.mods[1].nivel = 2; tal.refresh(); // o lado de dentro (o0) fica em +z
  const cunha = vertices(tal.merged).filter((v) => v[6] === 'fasciaBeiral' && perto(v[0], 5) && perto(v[3], 1) && v[1] < 1.0 - 1e-3 && v[2] > 1.3);
  f(cunha.length >= 5, `tampa: a rampa do talude ficou aberta ao lado do vizinho sem talude (${cunha.length} vértices)`);
  // parede de células: fecha rente com as células
  const cel = new Faixa({ id: 'tc', closed: false, path: reta(0, 8), modulos: 1, ponta: 0, prof: { o0: -0.7, o1: 0.7, fh: 0.5, beiral: 0, curb: 0, curbW: 0.14, celular: true, fac: 'fac_celular', facIn: 'fac_celular' }, niveis: 3 }); cel.setTodos(3);
  f(ponta(vertices(cel.merged), 'fac_celular', 8, 1).length > 0, 'tampa: parede de células sem as células na ponta');
  // pontaDegrau (leste e oeste) com ponta reta: o corpo com todos os andares, a ponta com 2 (como em andar())
  for (const lado of ['leste', 'oeste']) {
    const D = new Faixa({ id: 'td', closed: false, path: reta(0, 10), modulos: 1, ponta: 0, pontaDegrau: { [lado]: true }, prof: { o0: -0.5, o1: 0.5, setIn: 0.1 }, niveis: 5 }); D.setTodos(5);
    const alt = (x0, x1) => Math.max(...vertices(D.merged).filter((v) => v[0] >= x0 && v[0] <= x1).map((v) => v[1])); const mdd = medidas(D.prof);
    const pontaX = lado === 'leste' ? [9.85, 10] : [0, 0.15], corpo = [4.5, 5.5];
    f(perto(alt(...corpo), mdd.y(5) + mdd.slab + mdd.curb) && perto(alt(...pontaX), mdd.y(2) + mdd.slab + mdd.curb), `pontaDegrau ${lado}: corpo ${alt(...corpo).toFixed(2)}, ponta ${alt(...pontaX).toFixed(2)}`);
    f(D.mods[0].degrau === (lado === 'leste' ? 'fim' : 'ini'), `pontaDegrau ${lado}: lado errado`);
  }
});

// ------------------------------------------------------------------ caixa(i, n) contém a geometria do módulo (beiral, talude, platibanda,
// floreira do teto, tambor com a lanterna e pilares; folga de 1e-3: nos degraus a normal do trecho cortado difere um pouco)
// e o cache das tampas parciais não cresce
secao('caixa', () => {
  const extra = { cel: { id: 'cx', closed: false, path: reta(0, 8), modulos: 2, ponta: 0, prof: { o0: -0.7, o1: 0.7, fh: 0.5, beiral: 0, curb: 0, curbW: 0.14, celular: true, fac: 'fac_celular', facIn: 'fac_celular' }, niveis: 3 },
    pilares: { id: 'cp', closed: false, path: reta(-2, 2, 8), modulos: 1, ponta: 0, pilares: { pontas: true, passo: 4, r: 0.08 }, prof: { o0: -1.5, o1: 1.5, y0: 1.55, fh: 0.5, setIn: 0 }, niveis: 2 } };
  for (const [k, d] of Object.entries({ ...defsAntigas(), ...extra })) { const F = new Faixa(d);
    for (let n = 1; n <= F.max; n++) for (let i = 0; i < F.mods.length; i++) { const b = new THREE.Box3(); for (const g of F._geo(i, n).values()) { g.computeBoundingBox(); b.union(g.boundingBox); } const c = F.caixa(i, n).expandByScalar(1e-3); f(c.containsBox(b), `caixa: ${k} caixa(${i}, ${n}) não contém o módulo`); }
  }
  const T = new Faixa({ id: 'ct', closed: false, path: reta(0, 20), cortes: [0, 0.5, 1], aberturas: [1], aberturaDe: { 1: 6.74 }, nos: [{ c: [10, 0], r: 3, modulo: 1 }], ponta: 0, prof: { o0: -1.5, o1: 1.5, setIn: 0.22, fh: 0.5, beiral: 0.16, slab: 0.05, curb: 0.04, curbW: 0.08, taludeAndares: 2 }, niveis: 5, andaresExtra: 2 });
  for (let n = 1; n <= 5; n++) { const b = new THREE.Box3(); for (const g of T._geo(1, n).values()) { g.computeBoundingBox(); b.union(g.boundingBox); } f(T.caixa(1, n).expandByScalar(1e-3).containsBox(b), `caixa: tambor no nível ${n}`); }
  const P = new Faixa({ id: 'cz', closed: false, path: reta(0, 12), modulos: 3, ponta: 0, prof: { o0: -1, o1: 1, setIn: 0.2 }, niveis: 5 }); const antes = P.cache.size;
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) { P.mods[0].nivel = a; P.mods[1].nivel = 5; P.mods[2].nivel = b; P.refresh(); }
  f(P.cache.size - antes <= 3 * 5 + 1, `caixa: o cache das tampas parciais cresceu para ${P.cache.size}`);
});

// ------------------------------------------------------------------ largura(s), centroLargura, talude, moitas, celular
secao('largura', () => {
  const F = new Faixa({ id: 'lw', closed: false, path: reta(0, 12), modulos: 2, ponta: 0, largura: (s) => 0.7 + 0.3 * Math.min(1, s / 6), centroLargura: 0.5, prof: { o0: -1, o1: 1, setIn: 0.24, taludeAndares: 2, fac: 'fac_fita', facIn: 'fac_fita' }, niveis: 4, moitas: true });
  F.setTodos(4); f(finito(F.group) && tri(F.merged) > 0 && tri(F.extras) > 0, 'largura/centroLargura/talude/moitas: geometria');
  const z0 = vertices(F.merged).filter((v) => v[0] < 0.05).map((v) => v[2]); f(Math.min(...z0) > -1.4 && Math.max(...z0) < 1.4, 'largura(s): a ponta estreita não afinou');
});

// ------------------------------------------------------------------ o Anel do plano mestre (revisão 6)
secao('anel do plano', () => {
  const C = [0, -3.5], ang = [-15.28]; for (let a = -15; a <= 195; a++) ang.push(a); ang.push(195.28);
  const path = ang.map((a) => [C[0] + 16 * Math.cos((a * Math.PI) / 180), C[1] + 12 * Math.sin((a * Math.PI) / 180)]);
  const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1])); const L = cum.at(-1);
  const sA = (a) => cum[ang.indexOf(a)] / L;
  const prof = { o0: -1.5, o1: 1.5, setIn: 0.22, setOut: 0.02, fh: 0.5, beiral: 0.16, slab: 0.05, curb: 0.04, curbW: 0.08, passeioW: 0.22, passeioAt: 0.25, taludeAndares: 2, fac: 'fac_fita', facIn: 'fac_fita' };
  const nos = [{ c: [-13.856, 2.5], r: 3.0, modulo: 4 }, { c: [13.856, 2.5], r: 3.0, modulo: 5 }];
  const F = new Faixa({ id: 'anel', closed: false, path, cortes: [0, ...[0, 30, 60, 90, 120, 150, 180].map(sA), 1], aberturas: [2, 4, 6], aberturaDe: { 2: 6.74, 4: 4.2, 6: 6.74 }, ordem: [4, 3, 5, 2, 6, 1, 7, 0], nos, ponta: 0, passo: 0.32, prof, niveis: 5, andaresExtra: 2, arbustoPasso: 0.8, arbustoMax: 900, ripaPasso: 0.2, moitas: true });
  f(F.mods.length === 8 && F.mods[4].nos[0]?.c === nos[0].c && F.mods[5].nos[0]?.c === nos[1].c && F.mods.filter((m) => m.nos.length).length === 2, 'anel do plano: tambores fora dos módulos 4 e 5');
  f(F.mods[4].t === 6 && F.mods[5].t === 1 && F.mods[0].t === 4 && F.mods[1].t === 3, 'anel do plano: ordem');
  // vãos ao longo da linha média: 6,74 nos tambores (cortes 2 e 6) e 4,2 no portal (corte 4)
  const sDe = (q) => { let best = 1e9, s = 0; for (let k = 1; k < path.length; k++) { const a = path[k - 1], b = path[k], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / l2)); const d = Math.hypot(a[0] + dx * t - q[0], a[1] + dz * t - q[1]); if (d < best) { best = d; s = cum[k - 1] + Math.sqrt(l2) * t; } } return s; };
  for (const [c, w] of [[2, 6.74], [4, 4.2], [6, 6.74]]) f(perto(sDe(F.trechos[c].path[0]) - sDe(F.trechos[c - 1].path.at(-1)), w, 0.01), `anel do plano: vão no corte ${c}`);
  for (const [t, no] of [[5, nos[0]], [6, nos[0]], [1, nos[1]], [2, nos[1]]]) { const m = F.trechos[t]; const d = Math.min(...[m.path[0], m.path.at(-1)].map((q) => Math.hypot(q[0] - no.c[0], q[1] - no.c[1]))); f(d >= no.r + 0.12, `anel do plano: trecho ${t} a ${d.toFixed(3)} do tambor (junta 0,12)`); }
  let nan = false;
  for (const n of [1, 2, 3, 4, 5]) { F.setTodos(n); if (!finito(F.group)) nan = true; }
  F.setTodos(5); const fita = tri(F.merged), arb = tri(F.extras);
  for (let i = 0; i < 8; i++) { for (let fl = 0; fl < 5; fl++) { const a = F.andar(i, fl, 5); if (!finito(a.acabado) || !finito(a.esqueleto)) nan = true; } const b = F.caixa(i); if (![b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].every(Number.isFinite)) nan = true; if (F.pegada(i).flat(2).some((v) => !Number.isFinite(v))) nan = true; }
  [0, 1, 3, 5, 2, 0, 5, 4].forEach((n, i) => { F.mods[i].nivel = n; F.mods[i].lote = n === 0; }); F.refresh(); if (!finito(F.group)) nan = true;
  f(!nan, 'anel do plano: NaN na geometria'); f(F.caminhoTeto().every((l) => l.every((q) => q.every(Number.isFinite))), 'anel do plano: NaN no caminhoTeto');
  console.log(`anel do plano: fita ${fita} triângulos, arbustos e ripas ${arb}; trechos ${F.trechos.map((m) => { let s = 0; for (let k = 1; k < m.path.length; k++) s += Math.hypot(m.path[k][0] - m.path[k - 1][0], m.path[k][1] - m.path[k - 1][1]); return s.toFixed(2); }).join(' ')}`);
});

if (falhas.length) { console.log(falhas.join('\n')); process.exit(1); }
console.log('teste-faixa ok');
