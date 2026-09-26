// Plano diretor da Arcologia de Held (eixo e quadras). Coordenadas em unidades do mundo: x de -40 (oeste, à
// esquerda na vista padrão) a 40 (leste), z de -30 (fundo, norte) a 26 (frente, sul, onde chega a cidade).
//
//   - Eixo monumental em x = 0: do portão sul (anel viário) passa pela Praça da Entrada, sobe o Bulevar Verde até a
//     rotatória e segue até o lago da Sede. A Sede da Holding fecha o eixo: fita em U aberta para o sul, com o lago
//     no meio e a Torre da Holding (heliponto no topo) ao fundo.
//   - Avenida transversal em z = 1 (oeste a leste), com a rotatória no cruzamento com o eixo.
//   - Anel viário (retângulo arredondado) em volta de tudo, com saídas para a cidade: sul (Bairro Sul), norte
//     (Bairro Norte), leste (Bairro Leste) e oeste (o Porto).
//   - Quadras por função: o Saber a oeste (Campus Universitário, Ciências e o Anel com a Escola, o campo e as
//     faculdades); a Vida a leste (a Cúpula de vidro, abraçada pela fita do Santuário, e a estufa anexa); perto da
//     entrada a Biblioteca e a Vila; ao fundo a energia e a indústria (Acelerador, pátio de obras).
//
// Cada conjunto antigo (desenhado na planta da foto) anda inteiro para a sua quadra: DESLOC[conjunto] = [dx, dz]
// (a função mov desloca os pontos dos dados; os modelos com números fixos usam o mesmo deslocamento).
export const MESA = { x0: -40, x1: 40, z0: -30, z1: 26 };

// Vista padrão: do portão sul, olhando o eixo até a Sede (o nome ficou da vista da foto)
export const VISTA_FOTO = { x: 0, z: -2.5, dist: 76, yaw: 0, pitch: 0.66, fov: 34, roll: 0 };

export const DESLOC = {
  anel: [-9, 5.2],        // Anel do Campus (Escola, campo, Engenharia, Instituto, Humanidades): quadra sudoeste
  uni: [-1, -10.5],       // Campus Universitário: fundo a oeste
  ciencias: [-14, -9],    // Faculdade de Ciências: entre o Universitário e a avenida, com a rampa encostada na Sede
  biblio: [0.2, 3.1],     // Biblioteca, CRD e anel da Biblioteca: quadra sudeste, junto da praça
  vila: [7, 0.3],         // Vila e anfiteatro: leste da Biblioteca
  acel: [0.2, -42.6],     // Acelerador: fundo, entre a Sede e a Cúpula
  canteiro: [-6, -37.5],  // pátio de obras: canto noroeste
};
const fr = (n) => (Number.isInteger(n) ? n + 1e-4 : n); // (par só de inteiros vira outro tipo de vetor no motor de JS)
const LOCAIS = new Set(['mods', 'torres', 'torreW', 'torreH', 'linhas', 'degraus', 'tambor']);
// desloca os pontos de um conjunto (pares [x, z], ternos [x, z, h]; repasse é [x, y, z]); campos locais ficam
export function mov(q, o) {
  const [dx, dz] = DESLOC[q];
  const ponto = (v) => Array.isArray(v) && (v.length === 2 || v.length === 3) && v.every((n) => typeof n === 'number');
  const f = (v, k) => {
    if (LOCAIS.has(k)) return v;
    if (ponto(v)) return k === 'repasse' ? [fr(v[0] + dx), v[1], fr(v[2] + dz)] : [fr(v[0] + dx), fr(v[1] + dz), ...v.slice(2)];
    if (Array.isArray(v)) return v.map((x) => f(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, f(x, kk)]));
    return v;
  };
  return f(o);
}
export const mv = (q, x, z) => [fr(x + DESLOC[q][0]), fr(z + DESLOC[q][1])];

// pista (retângulo arredondado, superelipse): forma antiga do Santuário, mantida para quem ainda a usa
export function pistaPts(cx, cz, rx, rz, rot, n = 220) {
  const out = []; const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a); const k = 3.2; const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / k) * rx, z = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / k) * rz; out.push([cx + x * c - z * s, cz + x * s + z * c]); }
  return out;
}
// pegada aproximada de um trecho de fita: um quadrilátero por segmento da polilinha (alongado 0,3 nas pontas),
// entre os deslocamentos oA e oB da normal [tz, -tx] (a mesma convenção de geom.normals para caminhos abertos)
function pegadaFita(pts, oA, oB) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i]; let tx = bx - ax, tz = bz - az; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = tz, nz = -tx;
    const a = [ax - tx * 0.3, az - tz * 0.3], b = [bx + tx * 0.3, bz + tz * 0.3];
    out.push([[a[0] + nx * oA, a[1] + nz * oA], [b[0] + nx * oA, b[1] + nz * oA], [b[0] + nx * oB, b[1] + nz * oB], [a[0] + nx * oB, a[1] + nz * oB]]);
  }
  return out;
}
// arco de círculo (ângulos em radianos, medidos de +x para +z) e oval em polígono
export function arco(cx, cz, r, a0, a1, n = 24, rz = r) { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([fr(cx + Math.cos(a) * r), fr(cz + Math.sin(a) * rz)]); } return out; }
const oval = (cx, cz, rx, rz, n = 16) => arco(cx, cz, rx, 0, Math.PI * 2, n, rz).slice(0, n);

// ---------------------------------------------------------------- vias do plano
// anel viário: retângulo arredondado (eixo da pista), largura w; saídas para a cidade além da mesa
export const ANEL_VIARIO = { x0: -38.6, z0: -28.6, x1: 38.6, z1: 24.6, r: 7, w: 1.3 };
export const EIXO = { x: 0, meia: 3.2, z0: -8.4, z1: 24.6 };           // eixo monumental (piso da praça), do lago ao portão sul
export const AVENIDA = { z: 1, w: 2.0 };                               // avenida transversal (asfalto)
export const ROTATORIA = { c: [0.0001, 1.0001], r: 3.6, ilha: 2.6 };   // pista em anel e ilha com o chafariz
export const SAIDAS = [                                               // saídas do anel viário até a cidade (mundo)
  { id: 'sul', pts: [[0, 25.25], [0, 30.6]] }, { id: 'norte', pts: [[0, -29.25], [0, -36.6]] },
  { id: 'leste', pts: [[39.25, 1], [44.6, 1]] }, { id: 'porto', pts: [[-39.25, 1], [-47, 1]] },
];
function anelViarioPts(n = 10) {
  const { x0, z0, x1, z1, r } = ANEL_VIARIO; const out = []; const H = Math.PI / 2;
  const cantos = [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, H], [x0 + r, z0 + r, 2 * H], [x1 - r, z0 + r, 3 * H]];
  for (const [cx, cz, a] of cantos) out.push(...arco(cx, cz, r, a, a + H, n));
  return out;
}
// distância até o eixo do anel viário (para a mata, os carros e a pintura)
export function distAnelViario(x, z) {
  const { x0, z0, x1, z1, r } = ANEL_VIARIO; const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2 - r, hz = (z1 - z0) / 2 - r;
  const qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz; const fora = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
  return Math.abs(fora - r);
}

// ---------------------------------------------------------------- âncoras de cada conjunto
// (usadas pelos modelos 3D, pelo terreno e pela mata). Nos polígonos, cada ponto tem ao menos uma coordenada
// fracionária: um par só de inteiros vira outro tipo de vetor no motor de JS e deixa as consultas do terreno (feitas
// para cada vértice) mais de 2 vezes mais lentas.
const SEDE_C = [0.0001, -15.0001], SEDE_R = 9.5;
export const A = {
  // Anel do Campus: grande anel elíptico em terraços (Escola e Campus Jovem + faculdades), quadra sudoeste
  ...mov('anel', {
    anel: { c: [-9.6, 8.4], rx: 11.4, rz: 9.2, rot: -0.1 },
    campo: { c: [-6.8, 9.2], w: 5.6, d: 3.4, rot: -0.28 },
  }),
  // Campus Universitário: arena elíptica rasa (parede vertical de células, aberta para a frente) com cinco torres na
  // platibanda; na frente, a ala do portal, a fita reta de 2 pavimentos e o laço em U com a escadaria-jardim; o campo
  // com pista fica dentro do oval. O Elo desce pelo oeste da Ciências até a avenida; a Ala em Onda corre entre os dois
  uni: {
    ...mov('uni', { c: [-17.0, -8.8],
      arena: { c: [-15.6, -12.2], rx: 7.7, rz: 3.8, rot: 0, a0: 2.95, a1: 5.64, torres: [0.17, 0.36, 0.51, 0.68, 0.94], torreW: [2.0, 1.2, 1.6, 2.0, 2.0], torreH: [1.1, 0.88, 0.88, 0.88, 1.1] },
      campo: { c: [-17.6, -12.6], w: 4.6, d: 2.5, rot: -0.06, pista: { c: [-17.6, -12.6], rx: 3.3, rz: 1.6, rot: -0.06 } },
      ala: { c: [-21.5, -10.2], w: 3.6, d: 1.2, rot: 0.15, faixas: 8, rampa: 1.1, tambor: { r: 0.5, h: 1.0 } },
      frente: [[-19.5, -9.7], [-14.6, -10.3]], laco: { c: [-12.6, -11.8], w: 3.0, d: 2.6, fita: 0.9, degraus: 8 }, rampa: [[-9.8, -13.6], [-10.9, -12.0]] }),
    elo: [[-24.8, -19.4], [-27.2, -17.2], [-29.2, -12.5], [-29.2, -7.1], [-27.6, -2.6]],
  },
  onda: [[-24.5, -17.1], [-22.1, -18.2], [-19.5, -17.1], [-17.1, -18.2], [-14.6, -17.6]],
  // Faculdade de Ciências Avançadas e Tecnologia (platô de concreto com células de vidro espelhado); a rampa leste
  // desce rumo à avenida e a Ponte Coberta liga a proa à fita oeste da Sede
  ciencias: { ...mov('ciencias', { c: [-5.9, -1.7], rx: 7.4, rz: 3.0, rot: -0.12 }), gota: null },
  // Lago da Sede: oval no eixo, dentro do U da fita (sem ilha: r 0)
  lago: oval(0, -12.1, 5.8, 3.35, 16),
  ilha: { c: [0.0001, -12.1], r: 0 },
  // Sede Administrativa da Holding Guarda-Chuva: fita em U aberta para o sul (path = borda externa: sobe a perna
  // oeste, dá a volta pelo fundo e desce a perna leste); o0 = largura da fita (para dentro). No meio, o lago; ao
  // fundo, a Torre da Holding (torre: centro, lado, andares) com o heliponto no topo; na margem sul do lago, no eixo,
  // o pavilhão "guarda-chuva"; duas piscinas redondas ladeiam a torre. repasse = balão dos repasses (sobre a torre)
  sede: { c: SEDE_C, r: SEDE_R, o0: -2.1,
    path: [[-9.5, -6.2], [-9.5, -9.1], [-9.5, -12.1], ...arco(SEDE_C[0], SEDE_C[1], SEDE_R, Math.PI, Math.PI * 2, 16), [9.5, -12.1], [9.5, -9.1], [9.5, -6.2]],
    torre: { c: [0.0001, -19.3], lado: 3.4, andares: 12, fh: 0.55 },
    piscinas: [{ c: [-4.9, -19.6], r: 1.05 }, { c: [4.9, -19.6], r: 1.05 }],
    pavilhao: { c: [0.0001, -8.1], w: 2.6, d: 1.3, rot: 0, h: 0.7 }, repasse: [0.0001, 8.9, -19.3] },
  // Biblioteca Central (torre) + Centro de Recursos Digitais (casco em leque) + anel em terraços: quadra sudeste
  ...mov('biblio', {
    biblio: { c: [14.9, 8.1], r: 2.75, canopy: 6.5, canopyRot: -0.125, canopyY: 5.2, crd: { c: [14.2, 12.9], rot: -0.32 } },
    anelBib: { c: [14.9, 8.1], r0: 3.7, r1: 6.5, a0: 2.9, a1: 4.6 },
  }),
  // Cúpula da Vida (antigos habitats: a Savana, o Bioma, os Gorilas e o interior do Santuário viram uma cúpula de
  // vidro fechada, com a mata, a água e a névoa por dentro). bioma = a cúpula (c, r, altura h); savana = o chão de
  // dentro; gorilas = a estufa anexa ligada por um tubo de vidro; santuario = a fita residencial em arco que abraça a
  // cúpula pelo norte (r = eixo externo, a0..a1 em radianos, largura para dentro) com o passeio entre as duas;
  // galeria = a entrada envidraçada no sudoeste (santuarioInt), de frente para a Trilha da Cúpula
  bioma: { c: [23.0001, -15.0001], r: 8.0, h: 7.2 },
  savana: { c: [23.0001, -15.0001], r: 7.6 },
  gorilas: { c: [31.0001, -3.8001], r: 3.4, h: 3.3 },
  santuario: { c: [23.0001, -24.6], centro: [23.0001, -15.0001], r: 10.8, largura: 1.2, a0: (-165 * Math.PI) / 180, a1: (15 * Math.PI) / 180 },
  galeria: { c: [15.13, -9.53], rot: 0.61 },
  // Vila Estudantil Expandida: anfiteatro + casas (6 caixas em coordenadas locais: +x = nordeste, +z = frente)
  ...mov('vila', {
    anfiteatro: { c: [20.6, 11.6], r: 2.5 },
    vila: { c: [24.3, 12.4], w: 4.2, d: 2.3, rot: 0.62, mods: [
      { c: [-1.3, 0.5], w: 1.0, d: 0.55, tipo: 'barra' }, { c: [-0.35, 0.55], w: 0.5, d: 0.6, tipo: 'gable' }, { c: [0.5, 0.55], w: 0.8, d: 0.8 },
      { c: [-1.35, -0.5], w: 0.8, d: 0.8 }, { c: [-0.3, -0.5], w: 1.1, d: 0.9 }, { c: [1.05, -0.5], w: 1.4, d: 1.1, tipo: 'grande' }] },
  }),
  // Acelerador de partículas subterrâneo & Centro de Física: ao fundo, entre a Sede e a Cúpula
  acelerador: mov('acel', { c: [11.9, 17.6], rx: 2.6, rz: 1.7 }),
  // Praça da Entrada: simétrica no eixo, entre o portão sul e o Bulevar Verde; dois espelhos d'água e caminhos em
  // leque que saem do pouso do Bulevar
  praca: { poly: [[-6.5, 15.2], [-2.1, 14.4], [2.1, 14.4], [6.5, 15.2], [7.2, 18.5], [6.4, 22.4], [-6.4, 22.4], [-7.2, 18.5]] },
  lagosPraca: [{ c: [-3.7, 19.3], rx: 1.9, rz: 0.95, rot: 0.08 }, { c: [3.7, 19.3], rx: 1.9, rz: 0.95, rot: -0.08 }],
  pracaCaminhos: [
    [[0.0001, 15.1], [-2.1, 16.1], [-4.6, 16.7], [-6.8, 17.1]],
    [[0.0001, 15.1], [2.1, 16.1], [4.6, 16.7], [6.8, 17.1]],
    [[0.0001, 15.1], [-1.3, 15.7], [-1.6, 18.6], [-1.4, 22.3]],
    [[0.0001, 15.1], [1.3, 15.7], [1.6, 18.6], [1.4, 22.3]],
  ],
  // pátio de obras (canto noroeste, junto à saída do anel viário); acesso = por onde entram os caminhões
  canteiro: { ...mov('canteiro', { poly: [[-31.2, 10.2], [-22.0, 10.8], [-19.4, 14.2], [-21.0, 19.4], [-31.2, 19.4]], c: [-26.0, 15.0] }), acesso: [-37.2, -17.6] },
  // vias no nível do chão: o anel viário (fechado), a avenida transversal (dos dois lados da rotatória) e a pista da
  // rotatória; w = largura. Os carros da Arcologia rodam nelas
  vias: [
    { id: 'anel', pts: anelViarioPts(), w: ANEL_VIARIO.w, fechada: true },
    { id: 'avenidaO', pts: [[-38.6, 1.0001], [-26.1, 1.0001], [-13.1, 1.0001], [-3.4, 1.0001]], w: AVENIDA.w },
    { id: 'avenidaL', pts: [[3.4, 1.0001], [13.1, 1.0001], [26.1, 1.0001], [38.6, 1.0001]], w: AVENIDA.w },
    { id: 'rotatoria', pts: arco(ROTATORIA.c[0], ROTATORIA.c[1], (ROTATORIA.r + ROTATORIA.ilha) / 2, 0, Math.PI * 2, 32).slice(0, 32), w: ROTATORIA.r - ROTATORIA.ilha, fechada: true },
    // o começo das saídas para a cidade (o resto, fora da mesa, é malha do plano: models/plano.js)
    ...SAIDAS.map((q) => ({ id: 'saida-' + q.id, pts: [[...q.pts[0]], [Math.max(MESA.x0 + 0.05, Math.min(MESA.x1 - 0.05, q.pts[1][0])), Math.max(MESA.z0 + 0.05, Math.min(MESA.z1 - 0.05, q.pts[1][1]))]], w: ANEL_VIARIO.w })),
  ],
  trilhasMata: [],
  // aldeia de casinhas de telhado terracota entre ciprestes, no bosque do oeste (entre o Elo e o anel viário)
  aldeia: { c: [-34.2, -8.6], rx: 2.2, rz: 4.2, n: 9 },
};
// onde a mata não nasce: a pegada da fita do Santuário (em arco em volta da cúpula)
{ const s = A.santuario; A.semMata = pegadaFita(arco(s.centro[0], s.centro[1], s.r, s.a0, s.a1, 24), -s.largura - 0.3, 0.3); }

// Passarelas elevadas (pontos x, z, altura), retas ao longo do plano: cada uma começa e termina num ponto físico
// (prédio, praça ou chão); 'frente2' e 'caracol' só aparecem com os projetos pas_frente2 e pas_caracol.
const SANT = A.santuario;
export const PASSARELAS = {
  // eixo: da praça à rotatória (Bulevar Verde) e da rotatória ao pavilhão do lago (Passeio da Holding)
  bulevar: { nome: 'Bulevar Verde', pts: [[0.0001, 14.9, 0.08], [0.0001, 12.2, 0.75], [0.0001, 8.4, 0.75], [0.0001, 5.5, 0.08]], w: 0.9 },
  ponte: { nome: 'Passeio da Holding', pts: [[0.0001, -3.5, 0.08], [0.0001, -5.6, 0.5], [0.0001, -7.3, 0.38]], w: 0.9 },
  // da rotatória, em diagonal reta, até a galeria de entrada da Cúpula
  trilhaBioma: { nome: 'Trilha da Cúpula', pts: [[4.3, 0.1, 0.08], [7.4, -2.4, 0.8], [10.5, -4.9, 0.9], [13.2, -7.7, 0.3]], w: 0.7 },
  // da 2ª laje do Anel da Biblioteca, por cima da avenida, até o flanco sul da Cúpula
  elo: { nome: 'Elo do Santuário', pts: [[14.2, 5.1, 1.19], [16.3, 1.2, 1.05], [18.5, -2.8, 0.9], [20.5, -6.4, 0.3]], w: 0.6 },
  // da laje leste da Biblioteca até o anfiteatro da Vila
  vila: { nome: 'Passarela da Vila', pts: [[20.2, 11.4, 0.8], [22.6, 11.6, 0.85], [24.9, 11.8, 0.4]], w: 0.55 },
  // da praça, rente ao anel viário, até a abertura sul do Anel
  frente: { nome: 'Caminho da Frente', pts: [[-6.6, 20.4, 0.12], [-10.4, 21.7, 0.12], [-14.6, 22.8, 0.12], [-17.6, 23.3, 0.12], [-20.0, 23.35, 0.12]], w: 0.9 },
  // da rotatória até o pé do Anel (nordeste)
  anel: { nome: 'Passeio do Anel', pts: [[-4.3, 2.8, 0.08], [-7.0, 4.6, 0.6], [-9.5, 6.3, 0.1]], w: 0.85 },
  // caminho no chão entre a cúpula e a fita do Santuário, de ponta a ponta do arco
  santuario: { nome: 'Passeio do Santuário', pts: arco(SANT.centro[0], SANT.centro[1], 8.85, SANT.a0 + 0.08, SANT.a1 - 0.08, 9).map(([x, z]) => [x, z, 0.1]), w: 0.45 },
  // fita elevada em arco da praça até a frente do CRD
  frente2: { nome: 'Fita da Frente', pts: [[6.6, 20.4, 0.1], [8.4, 20.7, 0.7], [10.3, 20.8, 0.7], [12.1, 20.5, 0.1]], w: 0.8 },
  // rampa em "S" do chão até o Anel, pelo lado de fora: termina num patamar próprio sobre pilares, encostado no
  // módulo 7 do Anel a 1.28 (o terraço do teto com 3 andares, ou o piso do 4º andar com 4 ou 5)
  caracol: { nome: 'Caracol do Anel', ...mov('anel', { pts: [[4.5, 10.2, 0.08], [4.65, 9.3, 0.3], [3.0, 8.8, 0.6], [4.2, 7.6, 0.85], [2.9, 6.9, 1.08], [2.05, 7.4, 1.28]] }), w: 0.45,
    patamar: { ...mov('anel', { c: [2.09, 7.46] }), w: 1.0, d: 0.56, rot: -0.03, em: 'anel' } },
};

// Zonas de chão (pintura do terreno e clareiras da mata). 'quando' = id da etapa que faz a zona aparecer; sempre =
// gramado desde o início (as margens das vias do plano). Só elipses e polígonos de poucos lados: o terreno e a mata
// consultam todas as zonas em cada ponto. tipo 'terra' = piquete de terra batida.
const R_ = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
export const ZONAS = [
  { id: 'anel', tipo: 'grama', elipse: [A.anel.c, A.anel.rx + 0.8, A.anel.rz + 0.8, A.anel.rot] },
  ...mov('uni', [{ id: 'uni', tipo: 'grama', elipse: [[-15.8, -12.6], 8.6, 4.8, 0] }, { id: 'uni', tipo: 'grama', elipse: [[-15.5, -11.2], 7.0, 1.8, -0.1] }]), // a arena, o campo, a ala, a frente e o laço
  { id: 'uni', tipo: 'grama', elipse: [[-28.5, -10.9], 1.9, 9.2, 0] }, { id: 'uni', tipo: 'grama', elipse: [[-19.5, -17.6], 6.4, 1.5, 0] }, // o Elo e a Ala em Onda
  { id: 'ciencias', tipo: 'grama', elipse: [A.ciencias.c, A.ciencias.rx + 1.2, A.ciencias.rz + 1.6, A.ciencias.rot] },
  { id: 'sede', tipo: 'grama', elipse: [SEDE_C, SEDE_R + 2.2, SEDE_R + 1.2, 0] }, { id: 'sede', tipo: 'grama', poly: R_(-11.7, -15.1, 11.7, -5.3) }, // o U, a torre e o lago
  { id: 'santuario', tipo: 'grama', elipse: [SANT.centro, SANT.r + 1.4, SANT.r + 1.4, 0] }, // a fita em arco e o passeio
  { id: 'bioma', tipo: 'grama', elipse: [A.bioma.c, A.bioma.r + 0.9, A.bioma.r + 0.9, 0] },
  { id: 'gorilas', tipo: 'grama', elipse: [A.gorilas.c, A.gorilas.r + 1.0, A.gorilas.r + 1.0, 0] },
  { id: 'biblio', tipo: 'grama', elipse: [A.biblio.c, 8.8, 8.2, 0] }, { id: 'biblio', tipo: 'grama', elipse: [[A.biblio.crd.c[0] - 0.4, A.biblio.crd.c[1] + 1.8], 7.2, 4.0, 0.25] }, // a torre e o CRD
  ...mov('vila', [{ id: 'vila', tipo: 'grama', elipse: [[20.8, 12.0], 3.0, 3.0, 0] }, { id: 'vila', tipo: 'grama', elipse: [[24.4, 12.0], 2.4, 1.4, -0.62] }]),
  { id: 'acelerador', tipo: 'grama', elipse: [A.acelerador.c, A.acelerador.rx + 1.6, A.acelerador.rz + 1.3, 0] },
  { id: 'praca', tipo: 'praca', poly: A.praca.poly },
  { id: 'pracaSul', tipo: 'grama', poly: R_(-7.4, 22.3, 7.4, 23.9) }, // gramado entre a praça e o anel viário
  // eixo monumental: piso da praça do pouso do Bulevar até a rotatória e da rotatória até o lago (com a praça)
  { id: 'eixo', tipo: 'praca', poly: R_(-EIXO.meia, 4.6, EIXO.meia, 14.8) }, { id: 'eixo', tipo: 'praca', poly: R_(-EIXO.meia, EIXO.z0, EIXO.meia, -2.6) },
  { id: 'rotatoria', tipo: 'praca', elipse: [ROTATORIA.c, ROTATORIA.ilha, ROTATORIA.ilha, 0] },
  // margens verdes do eixo, da avenida e da rotatória (sempre)
  { id: 'margem', tipo: 'grama', sempre: true, poly: R_(-5.4, -8.4, 5.4, 14.8) },
  { id: 'margem', tipo: 'grama', sempre: true, poly: R_(-37.95, -1.9, 37.95, 3.9) },
  { id: 'margem', tipo: 'grama', sempre: true, elipse: [ROTATORIA.c, ROTATORIA.r + 1.6, ROTATORIA.r + 1.6, 0] },
  { id: 'canteiro', tipo: 'canteiro', poly: A.canteiro.poly },
];
