// Teste da planta (node puro, sem three): confere fonte/data/planta.js contra as âncoras do plano mestre "Trevo da
// Holding" (revisão 6: pm/dados.json e pm/fitas.json, embutidos abaixo, tolerância 0,01) e aplica a regra das juntas
// (seção 6 do plano, porte de pm/confere_pm.py):
//   1. nenhuma peça construída entra na pegada de peça de OUTRO projeto: folga >= J entre pegadas, contando a altura
//      (faixas de altura que não se cruzam não colidem); exceções desenhadas: Estufa x Cúpula e Galeria x Estufa;
//   2. nada construído sobre água, fora as pontes e o píer (pas_ponte, ponte privada, pavilhão, repuxos, jatos, Marco);
//   3. a linha de luz fora de obra, água, miolo e pátio; bosquetes fora de obra;
//   4. canteiro dentro da mesa, fora do tapete e a 0,6 ou mais da pista; obras dentro do tapete e a 1,0 da pista;
//   5. raio mínimo de cada fita >= 2,5 x largura, pontas dentro da mesa, caminhos com a normal para fora, ordem do
//      Anel (módulos 0 a 2 no sul, z > C + 8) e nenhum NaN.
// Uso: node ferramentas/teste-planta.mjs   (sai com código 1 se falhar; imprime 'teste-planta ok')
const t0 = performance.now();
const P = await import('../fonte/data/planta.js');
const tCarga = performance.now() - t0;
const { MESA, C, J, ALT, NOS, TAMBOR, PETALAS, CONCORD, ACELERADOR, ANEL_VIARIO, SAIDAS, PASSARELAS, ZONAS, A, FITAS, distAnelViario, trechosDe, trecho, comprimento, reamostra } = P;

const falhas = [];
const falha = (m) => falhas.push(m);
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const TOL = 0.01;
const ponto = (nome, a, b, tol = TOL) => { if (!(d2(a, b) <= tol)) falha(`${nome}: ${JSON.stringify(a)} (esperado ${JSON.stringify(b)})`); };
const numero = (nome, a, b, tol = TOL) => { if (!(Math.abs(a - b) <= tol)) falha(`${nome}: ${a} (esperado ${b})`); };
const pontos = (nome, l, esp, tol = TOL) => { if (!l || l.length !== esp.length) return falha(`${nome}: ${l?.length} pontos (esperado ${esp.length})`); l.forEach((p, i) => ponto(`${nome}[${i}]`, p, esp[i], tol)); };

// ---------------------------------------------------------------- âncoras (pm/dados.json, pm/fitas.json)
const ESP = {
  NOS: {SE: [13.856, 2.5], SO: [-13.856, 2.5], NO: [-13.856, -9.5], NE: [13.856, -9.5]},
  SAT: {SE: [25.97, 7.745], SO: [-25.97, 7.745], NO: [-27.53, -15.421], NE: [27.53, -15.421]},
  gota: {
    SE: {phi: -156.59, a1: -104.59, a2: 151.41, ini: [16.923, 1.927], fim: [15.537, 5.129], L: 43.55},
    SO: {phi: -23.41, a1: 28.59, a2: 284.59, ini: [-15.537, 5.129], fim: [-16.923, 1.927], L: 43.55},
    NO: {phi: 23.41, a1: 73.41, a2: 333.41, ini: [-16.923, -8.927], fim: [-15.537, -12.129], L: 50.68},
    NE: {phi: 156.59, a1: 206.59, a2: 466.59, ini: [15.537, -12.129], fim: [16.923, -8.927], L: 50.68},
  },
  concord: {
    onda: {F: [-37.708, -2.408], T1: [-32.414, 2.171], T2: [-33.395, -7.922], A: [40.86, -51.97], L: 11.34},
    uniElo: {F: [37.708, -2.408], T1: [32.414, 2.171], T2: [33.395, -7.922], A: [139.14, 231.97], L: 11.34},
    humanidades: {F: [-18.3, 28.972], T1: [-23.058, 15.805], T2: [-5.784, 22.699], A: [-109.87, -26.62], L: 20.34},
    casas: {F: [18.3, 28.972], T1: [23.058, 15.805], T2: [5.784, 22.699], A: [-70.13, -153.38], L: 20.34},
    eloO: {F: [-12.632, -27.8], T1: [-20.323, -21.409], T2: [-3.544, -23.627], A: [140.28, 24.66], L: 20.18},
    eloL: {F: [12.632, -27.8], T1: [20.323, -21.409], T2: [3.544, -23.627], A: [39.72, 155.34], L: 20.18},
  },
  TAMBORES: {SE: [[13.856, 2.5], 3.5, 'anel', 5], SO: [[-13.856, 2.5], 3.5, 'anel', 4], NO: [[-13.856, -9.5], 4.4, 'sede', 0], NE: [[13.856, -9.5], 4.4, 'sede', 3]},
  FIS: [205.84, 334.16],
  PORTICO: [264.13, 275.87],
  PORTAL: [[1.935, 8.412], [-1.935, 8.412]],
  PONTE: [[0, 3.28], [0, 0.3]],
  PONTE_PRIVADA: [[0, -7.3], [0, -12]],
  PAVILHAO: [0, 4.7],
  CAMPO: [[-26.429, 7.944], 66.6],
  ARQ: [-57.4, 10.6],
  CIEN: [[25.97, 7.745], -156.6],
  PONTE_COBERTA: [[16.72, 3.74], [22.556, 6.267]],
  CRD: [4.52, 11.78],
  CUP: [27.989, -15.619],
  EST: [22.345, -13.175],
  GAL: [20.051, -12.182],
  TRILHA: [[16.72, -10.74], [19.023, -11.737]],
  PASSEIO: [179.3, 493.8],
  PRACA: [[0, 19.8], 3.88],
  CANTEIROS_PRACA: [[2.086, 21.886], [-2.086, 21.886], [-2.086, 17.714], [2.086, 17.714]],
  FRENTE: [[0, 25.95], [0, 21.8]],
  BULEVAR: [[0, 17.8, 0.06], [0, 15, 0.75], [0, 9, 0.75], [0, 6.3, 0.06]],
  EIXO_BOCA: [[-1.3, 6.1], [1.3, 6.1], [1.3, 10.08], [-1.3, 10.08]],
  EIXO_N: [[-1.3, -12], [1.3, -12], [1.3, -19.98], [-1.3, -19.98]],
  RAMPAS: {caracol: [-8.446, 9.804], vila: [8.446, 9.804]},
  MORROS: [[-13.1, 13.1], [-10.65, 12.85]],
  PISCINA_ESCOLA: [-11.6, 14.75],
  PALCO: [[10.9, 13.8], [13.1, 13.8], [13.1, 14.8], [10.9, 14.8]],
  VALE: {
    onda: [[-17.62, -26.56], [-28.163, -3.5], [-22.09, 4.07]],
    uniElo: [[17.62, 26.56], [28.163, -3.5], [22.09, 4.07]],
  },
  BOSQ_N: [[-6.6, -17.3], [6.6, -17.3]],
  BOSQ_JARDIM: [[9.122, 2.935], [-9.122, 2.935], [-9.122, -9.935], [9.122, -9.935]],
  CLARABOIAS: [[0, 25.45], [0, -26.9], [-31.885, -2.975], [31.885, -2.975]],
  LAGO: [
    [11.3, -3.5], [10.915, -1.611], [9.786, 0.15], [7.99, 1.662], [5.65, 2.822], [2.925, 3.551], [0, 3.8], [-2.925, 3.551],
    [-5.65, 2.822], [-7.99, 1.662], [-9.786, 0.15], [-10.915, -1.611], [-11.3, -3.5], [-10.915, -5.389], [-9.786, -7.15], [-7.99, -8.662],
    [-5.65, -9.822], [-2.925, -10.551], [0, -10.8], [2.925, -10.551], [5.65, -9.822], [7.99, -8.662], [9.786, -7.15], [10.915, -5.389],
  ],
  DOSSEL: {engenharia: [22.621, 1.864], instituto: [18.714, 8.539]},
  FR_SE: [0.241, 0.759],
  CANTEIRO: {
    c: [-27.5, -28.4],
    acesso: [-26, -31.75],
    lotes: {escritorio: [-35.6, -24.85], almox: [-19.7, -27.3], usina1: [-30.3, -29.75], usina2: [-27.65, -29.75], usina3: [-25, -29.75], carpintaria: [-27.65, -27.3], concreto: [-22.35, -29.75], serralheria: [-19.7, -29.75], vidracaria: [-25, -27.3], eletrica: [-22.35, -27.3], horto: [-32.95, -27.3], laboratorio: [-30.3, -27.3]},
  },
  ORDEM: [4, 3, 5, 2, 6, 1, 7, 0],
};
const PEDACOS = {
  'anel.t0': [[15.435, -6.662], [16, -3.5], 3.228], 'anel.t1': [[16, -3.5], [15.435, -0.338], 3.228], 'anel.t2': [[11.368, 4.944], [6.969, 7.302], 5.01],
  'anel.t3': [[6.969, 7.302], [2.094, 8.397], 5.009], 'anel.t4': [[-2.094, 8.397], [-6.969, 7.302], 5.009], 'anel.t5': [[-6.969, 7.302], [-11.368, 4.944], 5.01],
  'anel.t6': [[-15.435, -0.338], [-16, -3.5], 3.228], 'anel.t7': [[-16, -3.5], [-15.435, -6.662], 3.228], 'sede.t0': [[-11.368, -11.944], [-6.828, -14.352], 5.159],
  'sede.t1': [[-6.828, -14.352], [-1.796, -15.424], 5.159], 'sede.t2': [[1.796, -15.424], [6.828, -14.352], 5.159], 'sede.t3': [[6.828, -14.352], [11.368, -11.944], 5.159],
  onda: [[-32.414, 2.171], [-33.395, -7.922], 11.341], uniElo: [[33.395, -7.922], [32.414, 2.171], 11.341], humanidades: [[-5.784, 22.699], [-23.058, 15.805], 20.341],
  'casas.m0': [[23.058, 15.805], [19.861, 15.06], 3.29], 'casas.m1': [[19.662, 15.039], [16.479, 15.091], 3.19], 'casas.m2': [[16.281, 15.119], [13.204, 15.933], 3.19],
  'casas.m3': [[13.018, 16.007], [10.226, 17.536], 3.19], 'casas.m4': [[10.063, 17.652], [7.719, 19.806], 3.19], 'casas.m5': [[7.589, 19.957], [5.784, 22.699], 3.29],
  'pas_frente2.O': [[-1.452, 24.27], [-1.607, 15.383], 11.647], 'pas_frente2.L': [[1.607, 15.383], [1.452, 24.27], 11.647], 'pas_elo.O': [[-20.323, -21.409], [-3.579, -23.555], 20.095],
  'pas_elo.L': [[3.579, -23.555], [20.323, -21.409], 20.095], 'acelerador.e4': [[-3.51, -23.7], [3.51, -23.7], 8.732], escola: [[-15.537, 5.129], [-16.923, 1.927], 43.552],
  engenharia: [[16.923, 1.927], [27.241, 1.475], 10.388], instituto: [[22.267, 12.962], [15.537, 5.129], 10.388], 'uni.m0': [[27.475, 1.527], [31.695, 4.892], 5.571],
  'uni.m1': [[31.695, 4.892], [31.841, 10.288], 5.571], 'uni.m2': [[31.841, 10.288], [27.806, 13.872], 5.571], 'uni.m3': [[27.806, 13.872], [22.465, 13.098], 5.57],
  'anelBib.m0': [[-16.923, -8.927], [-33.027, -10.469], 16.895], 'anelBib.m1': [[-33.027, -10.469], [-27.68, -22.818], 16.895], 'anelBib.m2': [[-27.68, -22.818], [-15.537, -12.129], 16.895],
  'santuario.m0': [[15.537, -12.129], [21.767, -20.058], 10.136], 'santuario.m1': [[21.767, -20.058], [30.926, -21.992], 10.136], 'santuario.m2': [[30.926, -21.992], [34.646, -13.401], 10.136],
  'santuario.m3': [[34.646, -13.401], [26.969, -8.045], 10.135], 'santuario.m4': [[26.969, -8.045], [16.923, -8.927], 10.137],
};

// ---------------------------------------------------------------- 1. âncoras
for (const k of ['SE', 'SO', 'NO', 'NE']) {
  const g = ESP.gota[k], p = PETALAS[k], [c, h, fita, mod] = ESP.TAMBORES[k], t = TAMBOR.nos[k];
  ponto('NOS.' + k, NOS[k], ESP.NOS[k]); ponto(`PETALAS.${k}.S`, p.S, ESP.SAT[k]);
  numero(`PETALAS.${k}.phi`, p.phi, g.phi); numero(`PETALAS.${k}.a1`, p.a1, g.a1); numero(`PETALAS.${k}.a2`, p.a2, g.a2);
  ponto(`PETALAS.${k} ponta ini`, p.pontas[0], g.ini); ponto(`PETALAS.${k} ponta fim`, p.pontas[1], g.fim); numero(`PETALAS.${k}.L`, p.L, g.L, 0.02);
  ponto('TAMBOR.nos.' + k, t.c, c); numero(`TAMBOR.nos.${k}.h`, t.h, h);
  if (t.fita !== fita || t.modulo !== mod || TAMBOR.de[k][0] !== fita || TAMBOR.de[k][1] !== mod) falha(`TAMBOR.${k}: dono ${t.fita} ${t.modulo} (esperado ${fita} ${mod})`);
}
for (const [k, e] of Object.entries(ESP.concord)) {
  const c = CONCORD[k]; if (!c) { falha('CONCORD sem ' + k); continue; }
  ponto(`CONCORD.${k}.F`, c.F, e.F); ponto(`CONCORD.${k}.T1`, c.T1, e.T1); ponto(`CONCORD.${k}.T2`, c.T2, e.T2); numero(`CONCORD.${k}.A0`, c.A[0], e.A[0]); numero(`CONCORD.${k}.A1`, c.A[1], e.A[1]); numero(`CONCORD.${k}.L`, c.L, e.L, 0.02);
}
numero('crescente a0', ACELERADOR.crescente.a0, ESP.FIS[0]); numero('crescente a1', ACELERADOR.crescente.a1, ESP.FIS[1]);
numero('pórtico a0', A.sedePatio.portico.a[0], ESP.PORTICO[0]); numero('pórtico a1', A.sedePatio.portico.a[1], ESP.PORTICO[1]);
ponto('portal ini', A.portal.caminho[0], ESP.PORTAL[0]); ponto('portal fim', A.portal.caminho.at(-1), ESP.PORTAL[1]);
pontos('ponte', A.ponte.pts, ESP.PONTE); pontos('ponte privada', A.sedePatio.pontePrivada, ESP.PONTE_PRIVADA); ponto('pavilhão', A.sedePatio.pavilhao.c, ESP.PAVILHAO);
ponto('campo', A.campo.c, ESP.CAMPO[0]); numero('campo rot', A.campo.rot, ESP.CAMPO[1]); numero('arquibancada a0', A.campo.arquibancada.a0, ESP.ARQ[0]); numero('arquibancada a1', A.campo.arquibancada.a1, ESP.ARQ[1]);
ponto('ciências', A.ciencias.c, ESP.CIEN[0]); numero('ciências rot', A.ciencias.rot, ESP.CIEN[1]); pontos('ponte coberta', A.ponteCoberta.pts, ESP.PONTE_COBERTA);
numero('crd r0', A.crd.r0, ESP.CRD[0]); numero('crd r1', A.crd.r1, ESP.CRD[1]);
ponto('cúpula', A.bioma.c, ESP.CUP); ponto('estufa', A.gorilas.c, ESP.EST); ponto('galeria', A.galeria.c, ESP.GAL); pontos('trilha', A.trilha.pts, ESP.TRILHA);
numero('passeio a0', A.passeioSant.a0, ESP.PASSEIO[0]); numero('passeio a1', A.passeioSant.a1, ESP.PASSEIO[1]);
ponto('praça', A.praca.c, ESP.PRACA[0]); ponto('praça centro', A.praca.centro, ESP.PRACA[0]); numero('praça r', A.praca.r, ESP.PRACA[1]); pontos('canteiros da praça', A.praca.canteiros.map((c) => c.c), ESP.CANTEIROS_PRACA);
pontos('frente', A.frente.pts, ESP.FRENTE); pontos('bulevar', A.bulevar.pts, ESP.BULEVAR); A.bulevar.pts.forEach((p, i) => numero(`bulevar altura ${i}`, p[2], ESP.BULEVAR[i][2]));
pontos('eixo da boca', A.praca.eixoBoca, ESP.EIXO_BOCA); pontos('eixo norte', A.eixoN.poly, ESP.EIXO_N);
for (const [k, c] of Object.entries(ESP.RAMPAS)) ponto('rampa ' + k, PASSARELAS[k].c, c);
pontos('morros', A.patios.escola.morros.map((m) => m.c), ESP.MORROS); ponto('piscina da escola', A.patios.escola.piscina.c, ESP.PISCINA_ESCOLA); pontos('palco', A.anfiteatro.palco.poly, ESP.PALCO);
for (const [k, [canal, rep, bos]] of Object.entries(ESP.VALE)) {
  const v = A.vales[k]; numero(k + ' canal x0', v.canal.x0, canal[0]); numero(k + ' canal x1', v.canal.x1, canal[1]); ponto(k + ' repuxo', v.repuxo.c, rep); numero(k + ' bosquete x', v.bosquetes[0].c[0], bos[0]); numero(k + ' bosquete rx', v.bosquetes[0].rx, bos[1]);
}
pontos('bosques norte', A.bosquesN.map((b) => b.c), ESP.BOSQ_N); pontos('bosquetes do jardim', A.bosquetes.map((b) => b.c), ESP.BOSQ_JARDIM); pontos('claraboias', ACELERADOR.claraboias, ESP.CLARABOIAS);
pontos('lago', A.lago, ESP.LAGO); ponto('dossel da Engenharia', A.engenharia.dossel.c, ESP.DOSSEL.engenharia); ponto('dossel do Instituto', A.instituto.dossel.c, ESP.DOSSEL.instituto);
numero('fração Engenharia/uni', A.uni.fracoes[0], ESP.FR_SE[0], 1e-3); numero('fração uni/Instituto', A.uni.fracoes[1], ESP.FR_SE[1], 1e-3);
ponto('canteiro c', A.canteiro.c, ESP.CANTEIRO.c); ponto('canteiro acesso', A.canteiro.acesso, ESP.CANTEIRO.acesso);
for (const [k, p] of Object.entries(ESP.CANTEIRO.lotes)) { const l = A.canteiro.lotes[k]; if (!l) falha('lote sem ' + k); else ponto('lote ' + k, [l.x, l.z], p); }
if (JSON.stringify(A.anel.ordem) !== JSON.stringify(ESP.ORDEM)) falha('ordem do Anel ' + JSON.stringify(A.anel.ordem));
ponto('C', C, [0, -3.5]); numero('J', J, 0.12, 1e-9);
if (MESA.x0 !== -40 || MESA.x1 !== 40 || MESA.z0 !== -34 || MESA.z1 !== 28) falha('MESA ' + JSON.stringify(MESA));
for (const [k, v] of Object.entries({ x0: -38.6, x1: 38.6, z0: -32.4, z1: 26.6, r: 7, w: 1.3 })) numero('ANEL_VIARIO.' + k, ANEL_VIARIO[k], v, 1e-9);
for (const [id, a, b] of [['sul', [0, 26.6], [0, 30.4]], ['norte', [0, -32.4], [0, -36.6]], ['leste', [38.6, -3.5], [44.4, -3.5]], ['porto', [-38.6, -3.5], [-47, -3.5]]]) {
  const s = SAIDAS.find((q) => q.id === id); if (!s) { falha('saída sem ' + id); continue; } ponto('saída ' + id, s.pts[0], a); ponto('saída ' + id + ' fim', s.pts[1], b);
}
for (const [k, [fh, niveis, extra]] of Object.entries({ anel: [0.5, 5, 2], sede: [0.55, 4, 4], escola: [0.5, 3, 1], uni: [0.5, 5, 1], anelBib: [0.55, 3, 1], santuario: [0.5, 4, 1], casas: [0.5, 3, 1] })) {
  const a = ALT[k]; if (a.fh !== fh || a.niveis !== niveis || a.extra !== extra) falha(`ALT.${k} ${JSON.stringify(a)}`); if (A[k].niveis !== niveis || A[k].extra !== extra || A[k].fh !== fh) falha(`A.${k}: níveis da mecânica mudaram`);
}
for (const [k, n] of Object.entries({ anel: 8, sede: 4, uni: 4, anelBib: 3, santuario: 5, casas: 6 })) { if (A[k].modulos !== n || trechosDe(A[k]).length !== n) falha(`A.${k}: ${A[k].modulos} módulos (esperado ${n})`); }
// pedaços de fita: o recorte de cada fita (trechosDe) cai nas pontas e no comprimento de pm/fitas.json
const vistos = new Set();
const confere = (nome, pts) => { const e = PEDACOS[nome]; if (!e) return falha('pedaço desconhecido ' + nome); vistos.add(nome); ponto(nome + ' ini', pts[0], e[0]); ponto(nome + ' fim', pts.at(-1), e[1]); numero(nome + ' comprimento', comprimento(pts), e[2], 0.03); };
for (const [k, pref] of Object.entries({ anel: 'anel.t', sede: 'sede.t', uni: 'uni.m', anelBib: 'anelBib.m', santuario: 'santuario.m', casas: 'casas.m' })) trechosDe(A[k]).forEach(([a, b], i) => confere(pref + i, trecho(A[k].caminho, a, b)));
for (const k of ['escola', 'engenharia', 'instituto', 'onda', 'uniElo', 'humanidades']) confere(k, A[k].caminho);
for (const s of ['O', 'L']) { confere('pas_frente2.' + s, A.colunata.caminhos[s]); confere('pas_elo.' + s, A.eloSant.caminhos[s]); }
confere('acelerador.e4', ACELERADOR.crescente.caminho);
for (const k of Object.keys(PEDACOS)) if (!vistos.has(k)) falha('pedaço sem conferência ' + k);

// ---------------------------------------------------------------- geometria plana (polígonos [[x, z]])
const dentro = (p, P_) => { let d = false; for (let i = 0, j = P_.length - 1; i < P_.length; j = i++) { const [xi, zi] = P_[i], [xj, zj] = P_[j]; if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) d = !d; } return d; };
const distSeg = (p, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1], l = vx * vx + vz * vz; const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / l)) : 0; return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vz * t); };
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const cruzam = (a, b, c, d) => orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
const caixa = (P_) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of P_) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x0, z0, x1, z1]; };
const longe = (a, b, m) => a[0] > b[2] + m || b[0] > a[2] + m || a[1] > b[3] + m || b[1] > a[3] + m;
const bordaDist = (p, P_) => { let d = 1e9; for (let i = 0; i < P_.length; i++) d = Math.min(d, distSeg(p, P_[i], P_[(i + 1) % P_.length])); return d; };
// os interiores se cruzam (arestas que se cortam ou um vértice dentro do outro, fora da borda)
function sobrepoe(P_, Q_) {
  for (let i = 0; i < P_.length; i++) for (let j = 0; j < Q_.length; j++) if (cruzam(P_[i], P_[(i + 1) % P_.length], Q_[j], Q_[(j + 1) % Q_.length])) return true;
  return P_.some((p) => dentro(p, Q_) && bordaDist(p, Q_) > 1e-6) || Q_.some((p) => dentro(p, P_) && bordaDist(p, P_) > 1e-6);
}
function distPoly(P_, Q_) {
  if (sobrepoe(P_, Q_)) return 0; let d = 1e9;
  for (const p of P_) d = Math.min(d, bordaDist(p, Q_)); for (const p of Q_) d = Math.min(d, bordaDist(p, P_)); return d;
}
const circ = (c, r, rz = r, n = 48) => Array.from({ length: n }, (_, i) => [c[0] + Math.cos((2 * Math.PI * i) / n) * r, c[1] + Math.sin((2 * Math.PI * i) / n) * rz]);
// setor de anel elíptico (ângulos em graus): borda de fora (rx, rz) e de dentro (rx - w, rz - w)
const setor = (c, rx, rz, w, a0, a1) => { const n = Math.max(12, Math.floor((Math.abs(a1 - a0) / 180) * 60)); const arc = (px, pz) => Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [c[0] + Math.cos(a) * px, c[1] + Math.sin(a) * pz]; }); return [...arc(rx, rz), ...arc(rx - w, rz - w).reverse()]; };
// faixa de largura w ao longo de uma polilinha (normais nos vértices, como pm/esboco.py)
const faixa = (pts, w) => { const E = [], D = []; pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l; E.push([p[0] + (nx * w) / 2, p[1] + (nz * w) / 2]); D.push([p[0] - (nx * w) / 2, p[1] - (nz * w) / 2]); }); return [...E, ...D.reverse()]; };
const pedacos = (pts, max = 3.5) => { const n = Math.max(1, Math.ceil(comprimento(pts) / max)); return Array.from({ length: n }, (_, k) => trecho(pts, k / n, (k + 1) / n)); };
const ret = (c, w, d, a) => { const ca = Math.cos((a * Math.PI) / 180), sa = Math.sin((a * Math.PI) / 180); return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [c[0] + u * ca - v * sa, c[1] + u * sa + v * ca]); };

// ---------------------------------------------------------------- 2. peças construídas (pegada, projeto, faixa de altura)
const obras = [];
const obra = (proj, nome, poly, y0, y1) => obras.push({ proj, nome, poly, y0, y1, bb: caixa(poly) });
for (const k of FITAS) for (const [a, b] of trechosDe(A[k])) for (const p of pedacos(trecho(A[k].caminho, a, b))) obra(k, k, faixa(p, A[k].w), 0, A[k].hMax);
for (const t of Object.values(TAMBOR.nos)) for (const [r, y0, y1] of t.niveis) obra(t.fita, 'tambor ' + t.id, circ(t.c, r), y0, y1);
const pt = A.sedePatio.portico; obra('sedePatio', 'pórtico', faixa(pt.caminho, pt.w), pt.y0, pt.topo);
const pp = A.sedePatio.pontePrivada; obra('sedePatio', 'pontePrivada', faixa(pp, pp.w), 0, pp.h);
for (const p of A.sedePatio.piscinas) obra('sedePatio', 'deckPiscina', circ(p.c, p.rx + p.deck, p.rz + p.deck), 0, 0.06);
for (const [r, y0, y1] of [...A.torre.camadas, A.torre.coroa, A.torre.heliponto]) obra('sedePatio', 'torre', circ(A.torre.c, r), y0, y1);
for (const [r, y0, y1] of A.sedePatio.pavilhao.niveis) obra('sedePatio', 'pavilhao', circ(A.sedePatio.pavilhao.c, r), y0, y1);
for (const s of ['O', 'L']) { for (const p of pedacos(A.colunata.caminhos[s])) obra('pas_frente2', 'colunata', faixa(p, A.colunata.w), 0, A.colunata.h); for (const p of pedacos(A.eloSant.caminhos[s])) obra('pas_elo', 'elo', faixa(p, A.eloSant.w), 0, A.eloSant.topo); }
for (const p of pedacos(ACELERADOR.crescente.caminho)) obra('acelerador', 'crescente', faixa(p, ACELERADOR.crescente.w), 0, ACELERADOR.crescente.h);
obra('pas_anel', 'portal', faixa(A.portal.caminho, A.portal.w), A.portal.y0, A.portal.topo);
for (const p of A.uni.torresPts) obra('uni', 'torreUni', circ(p, A.uni.torreR), 0, A.uni.torreTopo);
for (const k of ['engenharia', 'instituto']) { const d = A[k].dossel; obra(k, 'dossel', circ(d.c, d.haste), 0, d.y0); obra(k, 'dossel', circ(d.c, d.r), d.y0, d.topo); }
const aq = A.campo.arquibancada; obra('campo', 'arquibancada', setor(aq.c, aq.r1, aq.r1, aq.r1 - aq.r0, aq.a0, aq.a1), 0, aq.h);
for (const p of A.campo.torresLuz) obra('campo', 'torreLuz', circ(p, A.campo.torreLuz.r), 0, A.campo.torreLuz.h);
obra('ciencias', 'ciencias', A.ciencias.poly, 0, A.ciencias.h); obra('ponteCoberta', 'ponteCoberta', faixa(A.ponteCoberta.pts, A.ponteCoberta.w), A.ponteCoberta.y0, A.ponteCoberta.topo);
for (const [r, y0, y1] of A.biblio.niveis) obra('biblioteca', 'biblioteca', circ(A.biblio.c, r), y0, y1);
obra('crd', 'crd', A.crd.poly, 0, A.crd.h);
obra('bioma', 'cupula', circ(A.bioma.c, A.bioma.r), 0, A.bioma.h); obra('gorilas', 'estufa', circ(A.gorilas.c, A.gorilas.r), 0, A.gorilas.h); obra('santuarioInt', 'galeria', circ(A.galeria.c, A.galeria.r), 0, A.galeria.h);
obra('pas_trilhaBioma', 'trilha', faixa(A.trilha.pts, A.trilha.w), A.trilha.y0, A.trilha.topo);
obra('praca', 'marco', circ(A.praca.marco.c, A.praca.marco.r), 0, A.praca.marco.h); for (const f of A.fontes) obra('praca', 'jato', circ(f.c, f.jato.r), 0, f.jato.h);
const bl = A.bulevar.pts; for (let i = 1; i < bl.length; i++) { const h0 = Math.min(bl[i - 1][2], bl[i][2]), h1 = Math.max(bl[i - 1][2], bl[i][2]); obra('pas_bulevar', 'bulevar', faixa([bl[i - 1], bl[i]], A.bulevar.w), h0 < 0.3 ? 0 : h0 - 0.2, h1 + 0.05); }
obra('pas_ponte', 'ponte', faixa(A.ponte.pts, A.ponte.w), 0, A.ponte.h);
for (const k of ['caracol', 'vila']) { const r = PASSARELAS[k]; obra('pas_' + k, 'rampa', setor(r.c, r.r, r.r, r.w, 0, 180), 0, r.h); obra('pas_' + k, 'rampa', setor(r.c, r.r, r.r, r.w, 180, 360), 0, r.h); obra('pas_' + k, 'patamar', ret(r.patamar.c, r.patamar.w, r.patamar.d, r.patamar.rot), 0, r.h); }
for (const m of A.patios.escola.morros) obra('escola', 'morro', circ(m.c, m.rx, m.rz), 0, m.h);
const an = A.anfiteatro; obra('anfiteatro', 'arquibancada', setor(an.c, an.rx, an.rz, an.w, an.a0, an.a1), 0, an.h); obra('anfiteatro', 'palco', an.palco.poly, 0, an.palco.h);
for (const r of A.repuxos) obra('lago', 'repuxo', circ(r.c, r.jato.r), 0, r.jato.h);
for (const d of A.lagoDiques) obra('lago', 'dique', d.poly, 0, d.h);

// regra 1: folga >= J entre pegadas de projetos diferentes cujas faixas de altura se cruzam (o arco em polígono custa
// até 0,02, a mesma folga de pm/confere_pm.py)
const LIVRE = new Set(['bioma|gorilas', 'gorilas|santuarioInt']);
let folgaMin = 1e9, parMin = '';
for (let i = 0; i < obras.length; i++) for (let j = i + 1; j < obras.length; j++) {
  const a = obras[i], b = obras[j]; if (a.proj === b.proj || LIVRE.has([a.proj, b.proj].sort().join('|'))) continue;
  if (a.y1 <= b.y0 + 1e-6 || b.y1 <= a.y0 + 1e-6 || longe(a.bb, b.bb, J)) continue;
  const d = distPoly(a.poly, b.poly); if (d < folgaMin) { folgaMin = d; parMin = `${a.proj}/${a.nome} x ${b.proj}/${b.nome}`; }
  if (d < J - 0.02) falha(`junta: ${a.proj}/${a.nome} x ${b.proj}/${b.nome} com folga ${d.toFixed(3)} (mínimo ${J})`);
}
// regra 2: nada construído sobre água (fora pontes e píer); a água do próprio projeto conta como desenho dele
const aguas = [...A.lago.bacias.map((p) => ['lago', p]), ...A.sedePatio.piscinas.map((p) => ['sedePatio', circ(p.c, p.rx, p.rz)]), ['biblioteca', circ(A.biblio.espelho.c, A.biblio.espelho.r)],
  ['praca', circ(A.praca.espelho.c, A.praca.espelho.r)], ...A.fontes.map((f) => ['praca', circ(f.c, f.rx, f.rz)]), ...Object.values(A.vales).flatMap((v) => [['lago', v.canal.poly], ['lago', circ(v.repuxo.c, v.repuxo.r)]]),
  ['escola', circ(A.patios.escola.piscina.c, A.patios.escola.piscina.rx, A.patios.escola.piscina.rz)]].map(([proj, poly]) => ({ proj, poly, bb: caixa(poly) }));
const SOBRE_AGUA = new Set(['pas_ponte', 'pontePrivada', 'pavilhao', 'repuxo', 'jato', 'marco', 'ponteCoberta']);
const MESMO = new Set(['praca', 'lago', 'escola', 'sedePatio', 'biblioteca']);
const chao = obras.filter((o) => o.y0 <= 0.3);
for (const o of chao) { if (SOBRE_AGUA.has(o.nome) || SOBRE_AGUA.has(o.proj)) continue; for (const w of aguas) { if (w.proj === o.proj && MESMO.has(o.proj)) continue; if (!longe(o.bb, w.bb, 0) && sobrepoe(o.poly, w.poly)) falha(`sobre a água: ${o.proj}/${o.nome} (água de ${w.proj})`); } }
// regra 3: linha de luz fora de obra, água, miolo e pátio; bosquetes fora de obra
const luz = ACELERADOR.luz; if (d2(luz[0], luz.at(-1)) > 1e-6) falha('a linha de luz não fecha o laço');
const luzes = pedacos(luz, 5).map((p) => { const poly = faixa(p, ACELERADOR.luzW); return { poly, bb: caixa(poly) }; });
const miolos = [['campo', circ(A.campo.gramado.c, A.campo.gramado.r)], ['gramadoUni', circ(A.gramadoUni.c, A.gramadoUni.r)], ['biblioteca', circ(A.biblio.gramado.c, A.biblio.gramado.r)], ['savana', circ(A.savana.gramado.c, A.savana.gramado.r)],
  ['jardim', circ(A.jardim.c, A.jardim.rx, A.jardim.rz, 96)], ['pátio da escola', circ(A.patios.escola.base.c, A.patios.escola.base.rx, A.patios.escola.base.rz)], ['anfiteatro', circ(A.anfiteatro.base.c, A.anfiteatro.base.rx, A.anfiteatro.base.rz)]]
  .map(([nome, poly]) => ({ nome, poly, bb: caixa(poly) }));
for (const l of luzes) {
  for (const o of chao) if (!longe(l.bb, o.bb, 0) && sobrepoe(l.poly, o.poly)) falha(`linha de luz sobre ${o.proj}/${o.nome}`);
  for (const w of aguas) if (!longe(l.bb, w.bb, 0) && sobrepoe(l.poly, w.poly)) falha(`linha de luz sobre a água de ${w.proj}`);
  for (const m of miolos) if (!longe(l.bb, m.bb, 0) && sobrepoe(l.poly, m.poly)) falha(`linha de luz dentro do miolo ${m.nome}`);
}
const bosques = [...A.bosquetes, ...A.bosquesN, ...Object.values(A.vales).flatMap((v) => v.bosquetes), ...A.praca.canteiros].map((b) => circ(b.c, b.rx, b.rz));
for (const b of bosques) for (const o of chao) if (!longe(caixa(b), o.bb, 0.1) && distPoly(b, o.poly) < 0.1) falha(`bosquete em ${JSON.stringify(b[0].map((v) => +v.toFixed(2)))} sobre ${o.proj}/${o.nome}`);
// regra 4: tapete, canteiro e pista
const T = A.tapete, borda = (x, z) => distAnelViario(x, z) - ANEL_VIARIO.w / 2;
if (T.length > 100) falha(`tapete com ${T.length} pontos (o terreno consulta por ponto: até 100)`);
for (const o of obras) for (const p of o.poly) { if (!dentro(p, T) && bordaDist(p, T) > 0.01) { falha(`obra fora do tapete: ${o.proj}/${o.nome}`); break; } if (borda(p[0], p[1]) < 1.0) { falha(`obra a menos de 1,0 da pista: ${o.proj}/${o.nome}`); break; } }
const K = A.canteiro.poly; if (sobrepoe(K, T)) falha('canteiro sobre o tapete');
let folgaPista = 1e9; for (let i = 0; i < K.length; i++) { const a = K[i], b = K[(i + 1) % K.length], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1); for (let s = 0; s <= n; s++) folgaPista = Math.min(folgaPista, borda(a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n)); }
if (folgaPista < 0.6) falha(`canteiro a ${folgaPista.toFixed(2)} da pista (mínimo 0,6)`);
if (K.some(([x, z]) => x < MESA.x0 || x > MESA.x1 || z < MESA.z0 || z > MESA.z1)) falha('canteiro fora da mesa');
const areaK = Math.abs(K.reduce((s, p, i) => { const q = K[(i + 1) % K.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2; if (areaK < 100) falha(`canteiro com ${areaK.toFixed(1)} u² (o plano tem 121)`);
// regra 5: raios, pontas na mesa, sentido dos caminhos, ordem do Anel
const raioMin = (pts) => { const q = reamostra(pts, 0.3); let r = 1e9; for (let i = 2; i < q.length - 2; i++) { const a = q[i - 2], b = q[i], c = q[i + 2]; const ab = d2(a, b), bc = d2(b, c), ca = d2(c, a), ar = Math.abs(orient(a, b, c)) / 2; if (ar > 1e-9) r = Math.min(r, (ab * bc * ca) / (4 * ar)); } return r; };
const caminhos = [...FITAS.map((k) => [k, A[k].caminho, A[k].w, ['anel', 'sede', 'onda', 'uniElo', 'humanidades', 'casas'].includes(k) ? C : k === 'escola' ? PETALAS.SO.S : k === 'anelBib' ? PETALAS.NO.S : k === 'santuario' ? PETALAS.NE.S : PETALAS.SE.S]),
  ...['O', 'L'].flatMap((s) => [['colunata ' + s, A.colunata.caminhos[s], A.colunata.w, A.colunata.c], ['elo ' + s, A.eloSant.caminhos[s], A.eloSant.w, C]]), ['crescente', ACELERADOR.crescente.caminho, ACELERADOR.crescente.w, ACELERADOR.crescente.c],
  ['portal', A.portal.caminho, A.portal.w, C], ['pórtico', A.sedePatio.portico.caminho, A.sedePatio.portico.w, C]];
for (const [nome, pts, w, ref] of caminhos) {
  const r = raioMin(pts); if (r < 2.5 * w - 1e-6) falha(`${nome}: raio mínimo ${r.toFixed(2)} < 2,5 x ${w}`);
  if (pts.some(([x, z]) => x < MESA.x0 || x > MESA.x1 || z < MESA.z0 || z > MESA.z1)) falha(`${nome}: fora da mesa`);
  const i = pts.length >> 1, a = pts[i - 1], b = pts[i + 1], m = pts[i]; if ((m[0] - ref[0]) * (b[1] - a[1]) - (m[1] - ref[1]) * (b[0] - a[0]) <= 0) falha(`${nome}: a normal [tz, -tx] não aponta para fora`);
}
const tr = trechosDe(A.anel); for (const m of [0, 1, 2]) { const [a, b] = tr[A.anel.ordem[m]]; const p = trecho(A.anel.caminho, (a + b) / 2, (a + b) / 2)[0]; if (!(p[1] > C[1] + 8)) falha(`módulo ${m} do Anel fora do sul (z ${p[1].toFixed(2)})`); }
for (const [k, [id, m]] of Object.entries(TAMBOR.de)) { const f = A[id], [a, b] = trechosDe(f)[f.ordem ? f.ordem[m] : m]; const pa = trecho(f.caminho, a, a)[0], pb = trecho(f.caminho, b, b)[0]; if (Math.min(d2(pa, NOS[k]), d2(pb, NOS[k])) > 3.6) falha(`tambor ${k} longe do módulo ${m} de ${id}`); if (!f.nos.some((n) => n.id === k && n.modulo === m)) falha(`A.${id}.nos sem o tambor ${k}`); }
// rampas em hélice: o patamar encosta com a junta no módulo dono do Anel (0 no Caracol, 1 na Vila; seção 8) e a
// rampa termina nele, na altura dele
for (const [k, m] of [['caracol', 0], ['vila', 1]]) {
  const r = PASSARELAS[k], pt = r.patamar, box = ret(pt.c, pt.w, pt.d, pt.rot); let dm = 1e9, perto = -1;
  trechosDe(A.anel).forEach(([a, b], t) => { for (const p of pedacos(trecho(A.anel.caminho, a, b))) { const d = distPoly(box, faixa(p, A.anel.w)); if (d < dm) { dm = d; perto = A.anel.ordem.indexOf(t); } } });
  if (pt.modulo !== m || perto !== m || dm > J + 0.05) falha(`${k}: patamar a ${dm.toFixed(3)} do módulo ${perto} do Anel (esperado o módulo ${m}, com a junta)`);
  const e = r.pts.at(-1); if (Math.abs(e[2] - pt.h) > 1e-6 || !dentro(e, box)) falha(`${k}: a rampa não termina no patamar`);
}
// passarelas: ids (pas_ + chave), nomes e tipos
const NOMES = { frente: 'Caminho da Frente', bulevar: 'Bulevar Verde', anel: 'Portal do Anel', frente2: 'Colunata da Praça', ponte: 'Passeio da Holding', caracol: 'Caracol do Anel', vila: 'Rampa da Vila', trilhaBioma: 'Trilha da Cúpula', elo: 'Elo do Santuário', santuario: 'Passeio do Santuário' };
if (Object.keys(PASSARELAS).sort().join() !== Object.keys(NOMES).sort().join()) falha('PASSARELAS: chaves ' + Object.keys(PASSARELAS).join());
for (const [k, p] of Object.entries(PASSARELAS)) { if (p.nome !== NOMES[k]) falha(`PASSARELAS.${k}.nome ${p.nome}`); if (!['chao', 'deck', 'faixa', 'helice'].includes(p.tipo)) falha(`PASSARELAS.${k}.tipo ${p.tipo}`); if (!p.pts?.length || p.pts.some((q) => q.length !== 3)) falha(`PASSARELAS.${k}.pts sem [x, z, altura]`); if (!(p.w > 0)) falha(`PASSARELAS.${k}.w`); }
// zonas: formato e tamanho
for (const Z of ZONAS) { if (!Z.id || !Z.tipo || !(Z.poly || Z.elipse)) falha('zona sem id, tipo ou forma: ' + JSON.stringify(Z).slice(0, 80)); if (Z.poly && Z.poly.length > 100) falha(`zona ${Z.id} com ${Z.poly.length} pontos`); }
if (ZONAS.length > 12) falha(`${ZONAS.length} zonas (o terreno consulta todas por ponto)`);
// nenhum NaN (nem infinito) em nada que a planta exporta; coordenadas fracionárias nos pontos (arcos = pares de ângulos)
let nNum = 0, nInt = 0;
const anda = (v, cam) => { if (typeof v === 'number') { nNum++; if (!Number.isFinite(v)) falha('número inválido em ' + cam); return; } if (Array.isArray(v)) { if (!/\.arcos\./.test(cam) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && Number.isInteger(v[0]) && Number.isInteger(v[1])) nInt++; v.forEach((x, i) => anda(x, cam + '[' + i + ']')); for (const k of Object.keys(v)) if (!/^\d+$/.test(k)) anda(v[k], cam + '.' + k); return; } if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) anda(x, cam + '.' + k); };
for (const [k, v] of Object.entries(P)) if (typeof v !== 'function') anda(v, k);
if (nInt) falha(`${nInt} pares [x, z] só de inteiros (regra fr)`);

if (falhas.length) { console.log(falhas.slice(0, 80).join('\n')); console.log(`teste-planta: ${falhas.length} falha(s)`); process.exit(1); }
console.log(`planta: carga ${tCarga.toFixed(0)} ms, ${obras.length} peças, folga mínima ${folgaMin.toFixed(3)} (${parMin}), canteiro a ${folgaPista.toFixed(2)} da pista, tapete ${T.length} pontos, ${nNum} números`);
console.log('teste-planta ok');
