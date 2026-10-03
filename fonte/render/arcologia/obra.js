// Obra das etapas da Arcologia (D26, D49; dona: X1b), desenhada pelo domínio 'arcologia' (planos.js):
//   lago.e1    a cava do Mirror Lake já desce no aplainar; aqui o leito de terra da obra, o tapume em volta da praça
//              (aberto nas avenidas) e o canteiro (contêineres e montes de brita e areia)
//   torre.e1-4 o par sobe pelo corte por lado (torre.cortePorLado: a Blade na frente, a Legacy um passo atrás, a Dream
//              Bridge só quando as duas passam de 330 m) e duas gruas de torre, uma em cada torre, acompanham a altura
//              (a da Blade até uns 540 m, acima do mastro de 520 m), com a lança girando devagar e a luz de obstáculo
// As alturas saem das etapas do espelho (data/arcologia.js, as mesmas que a simulação usa para o Mural). Tudo nos
// materiais fixos da Arcologia (torre.js): nada compila quando a obra começa. O mastro da grua é uma malha só até o
// topo, mostrada por trechos (drawRange): subir não refaz geometria.
import * as THREE from 'three';
import { ETAPA } from '../../contratos/flags.js';
import { avancoDaTorre, alturaBlade, alturaLegacy, ALTURA_PONTE } from '../../data/arcologia.js';
import { PAR, PODIO, LAGO, PRACA, AVENIDAS, TORRE_LAMINA, TORRE_IRMA, torresDoPar } from '../../data/arcologia-plano.js';
import { Malha, acab, LUZ, PADRAO, bloco, barra, cilindro, parede, geometriaDe } from './torre.js';

const RAD = Math.PI / 180;

/** Acabamentos da obra: a grua branca (Liebherr), o contrapeso de concreto, a cabine, o tapume e a terra. */
const KO = {
  grua: acab('#d9d5cc', { rugo: 0.5, metal: 0.35 }),
  gruaEscura: acab('#5a5d61', { rugo: 0.6, metal: 0.5 }),
  contrapeso: acab('#8f8a80', { rugo: 0.9, padrao: PADRAO.pedra }),
  cabine: acab('#ece9e2', { rugo: 0.4, metal: 0.2 }),
  vidroCabine: acab('#2a3036', { rugo: 0.15, metal: 0.6 }),
  obstaculo: acab('#b41a12', { rugo: 0.4, luz: LUZ.obstaculo }),
  tapume: acab('#e4e0d6', { rugo: 0.85 }),
  faixa: acab('#b8a684', { rugo: 0.35, metal: 1, padrao: PADRAO.metal }),
  terra: acab('#6c5844', { rugo: 0.95, padrao: PADRAO.grama }),
  brita: acab('#8c8a86', { rugo: 0.95, padrao: PADRAO.grama }),
  areia: acab('#b9a283', { rugo: 0.95, padrao: PADRAO.grama }),
  conteiner: acab('#c9c4b8', { rugo: 0.6, metal: 0.3 }),
  conteinerHolding: acab('#a89470', { rugo: 0.5, metal: 0.4 }),
  concreto: acab('#aaa59c', { rugo: 0.9, padrao: PADRAO.pedra }),
  nucleo: acab('#8f8b84', { rugo: 0.9, padrao: PADRAO.pedra }),
  forma: acab('#c9a227', { rugo: 0.6, metal: 0.3 }),
  tela: acab('#3d5560', { rugo: 0.95 }),
};

/** Grua de torre: seção do mastro, trecho, lança, contralança e quanto o topo passa da obra. */
export const GRUA = Object.freeze({ lado: 2.2, trecho: 6, lanca: 62, contra: 22, folga: 26, topoBlade: 545, topoLegacy: 480, afastamento: 9 });

/**
 * A frente de obra no topo de cada torre: 3 pavimentos de 4,2 m em esqueleto de concreto (lajes e pilares) acima do
 * vidro já montado, com o núcleo subindo 2 pavimentos na frente (como numa torre de verdade).
 */
export const FRENTE = Object.freeze({ andares: 3, pe: 4.2, nucleo: 2, pilares: 6 });
export const ALTURA_FRENTE = FRENTE.andares * FRENTE.pe;

/** Quanto do vão sobe com as torres antes da Dream Bridge: o pódio e as marquises do pé delas (até 47,6 m). */
export const VAO_PE = 8;

/**
 * Espessura da frente de obra (m) com a torre na altura h: nasce no pódio (a parte de baixo fica dentro dele) e fecha
 * nos últimos 12,6 m antes do topo do vidro, para o vidro chegar à coroa sem salto. O vidro vai até h menos ela.
 */
export function espessuraFrente(h, spec) {
  if (!(h > PODIO.altura)) return 0;
  return Math.min(ALTURA_FRENTE, Math.max(0, spec.altura - 2 - h));
}

/** Até onde o vidro da torre sobe com a obra em h (contínuo: nunca abaixo do pódio, nunca salta). */
export function alturaVidro(h, spec) {
  if (!(h > PODIO.altura)) return h;
  return Math.max(PODIO.altura, h - espessuraFrente(h, spec));
}

// ------------------------------------------------------------------------------------------------ estado

/**
 * Estado da obra pelas etapas (as do espelho, ou as que uma cena pedir): o avanço do par (0 a 4, -1 sem obra), se o par
 * está em obra (começou e a torre.e4 não ficou pronta), a lago.e1 em obra e as alturas (metros acima da gleba).
 */
export function estadoObra(etapas = []) {
  const e = (id) => etapas.find((x) => x.id === id);
  const g = avancoDaTorre(etapas);
  const pronta = e('torre.e4')?.estado === ETAPA.PRONTA;
  const torre = g >= 0 && !pronta;
  const blade = torre ? alturaBlade(g) : 0;
  const legacy = torre ? alturaLegacy(g) : 0;
  const ponte = Math.min(blade, legacy) >= ALTURA_PONTE;
  return {
    g,
    torre,
    lago: e('lago.e1')?.estado === ETAPA.EM_OBRA,
    blade,
    legacy,
    // o vão (a Dream Bridge, o pódio entre as torres e as marquises do pé delas, a 47 m): sobe com o pódio e as
    // marquises e espera as duas passarem da ponte
    vao: ponte ? Math.min(blade, legacy) : Math.min(blade, legacy, PODIO.altura + VAO_PE),
    ponte,
  };
}

// ------------------------------------------------------------------------------------------------ a grua

/**
 * Mastro de treliça de 0 a `ate` metros em trechos de 6 m, cada trecho com o mesmo número de índices: 4 montantes e
 * as 4 diagonais. Devolve a malha e os índices por trecho (drawRange).
 */
export function malhaMastro(ate = GRUA.topoBlade + GRUA.trecho) {
  const m = new Malha('opaco');
  const h = GRUA.lado / 2;
  const T = GRUA.trecho;
  const n = Math.ceil(ate / T);
  let porTrecho = 0;
  for (let k = 0; k < n; k++) {
    const y0 = k * T;
    const y1 = y0 + T;
    const antes = m.i.length;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) bloco(m, sx * h - 0.11, y0, sz * h - 0.11, sx * h + 0.11, y1, sz * h + 0.11, KO.grua, { topo: false });
    // uma diagonal por face, alternando o sentido de trecho em trecho
    const s = k % 2 ? 1 : -1;
    barra(m, [-h, y0, -h], [h, y1, -h * 1], 0.06, 3, KO.grua);
    barra(m, [h, y0, -h], [h, y1, h], 0.06, 3, KO.grua);
    barra(m, [h * s, y0, h], [-h * s, y1, h], 0.06, 3, KO.grua);
    barra(m, [-h, y0, h], [-h, y1, -h], 0.06, 3, KO.grua);
    porTrecho = m.i.length - antes;
  }
  return { malha: m, porTrecho, trechos: n };
}

/** Cabeça da grua (no topo do mastro, a lança para +x): giro, cabine, torre de topo, lança, contralança e tirantes. */
export function malhaCabeca() {
  const m = new Malha('opaco');
  const L = GRUA.lanca;
  const C = GRUA.contra;
  bloco(m, -1.7, 0, -1.7, 1.7, 2.6, 1.7, KO.gruaEscura);
  // cabine do operador, ao lado da lança
  bloco(m, 1.2, 0.4, 1.3, 3.8, 3.0, 3.4, KO.cabine);
  bloco(m, 3.78, 0.9, 1.5, 3.86, 2.8, 3.2, KO.vidroCabine);
  // torre de topo (a ponta da pirâmide a 14 m)
  const apice = [0, 15, 0];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) barra(m, [sx * 1.1, 2.6, sz * 1.1], apice, 0.12, 4, KO.grua);
  bloco(m, -0.35, 15, -0.35, 0.35, 15.6, 0.35, KO.obstaculo);
  // lança de treliça triangular: dois banzos embaixo e um em cima, com as diagonais a cada 3 m
  const yb = 2.6;
  const yt = 4.6;
  barra(m, [2, yb, -0.9], [L, yb, -0.9], 0.1, 4, KO.grua);
  barra(m, [2, yb, 0.9], [L, yb, 0.9], 0.1, 4, KO.grua);
  barra(m, [2, yt, 0], [L - 1.5, yt - 0.8, 0], 0.1, 4, KO.grua);
  for (let x = 2; x < L - 2; x += 3) {
    const t = (x - 2) / (L - 3.5);
    const ytop = yt - 0.8 * t;
    barra(m, [x, yb, -0.9], [x + 1.5, ytop, 0], 0.05, 3, KO.grua);
    barra(m, [x, yb, 0.9], [x + 1.5, ytop, 0], 0.05, 3, KO.grua);
  }
  bloco(m, L - 0.4, yb - 0.3, -0.3, L + 0.2, yb + 0.3, 0.3, KO.obstaculo);
  // contralança com a passarela e os contrapesos de concreto na ponta
  barra(m, [-1.5, yb, -1.0], [-C, yb, -1.0], 0.12, 4, KO.grua);
  barra(m, [-1.5, yb, 1.0], [-C, yb, 1.0], 0.12, 4, KO.grua);
  bloco(m, -C, yb - 0.1, -0.8, -1.5, yb + 0.05, 0.8, KO.gruaEscura, { base: true });
  for (let k = 0; k < 4; k++) bloco(m, -C + k * 1.25, yb - 3.2, -1.4, -C + k * 1.25 + 1.15, yb, 1.4, KO.contrapeso, { base: true });
  // tirantes do ápice à lança e à contralança
  barra(m, apice, [L * 0.48, yt - 0.4, 0], 0.07, 3, KO.gruaEscura);
  barra(m, apice, [L * 0.92, yt - 0.75, 0], 0.07, 3, KO.gruaEscura);
  barra(m, apice, [-C + 1, yb, 0], 0.07, 3, KO.gruaEscura);
  return m;
}

/** O carrinho com o cabo e o gancho (um balde de concreto pendurado), na lança, a 20 m abaixo dela. */
export function malhaCarrinho() {
  const m = new Malha('opaco');
  bloco(m, -0.8, 1.6, -1.1, 0.8, 2.4, 1.1, KO.gruaEscura);
  barra(m, [0, 1.6, 0], [0, -18, 0], 0.04, 3, KO.gruaEscura);
  cilindro(m, 0, 0, -21, -18, 0.6, 0.9, 8, KO.conteiner, { base: true });
  return m;
}

// ------------------------------------------------------------------------------------------------ a frente de obra

/**
 * Esqueleto da frente de obra no espaço da torre, com z de 0 (a face lisa) a 50 (as penas): o render encolhe o z
 * para a planta da altura (as lâminas recuam) e põe a base no topo do vidro.
 */
export function malhaFrente() {
  const m = new Malha('opaco');
  const H = ALTURA_FRENTE;
  const P = FRENTE.pilares;
  // lajes com a borda fina, uma por pavimento (a de cima é a fôrma da próxima)
  for (let k = 0; k <= FRENTE.andares; k++) bloco(m, -18, k * FRENTE.pe - 0.3, 0, 18, k * FRENTE.pe, 50, KO.concreto, { base: true });
  // pilares no perímetro, a cada 6 m
  for (let x = -18; x <= 18 + 1e-6; x += P) for (const z of [0.6, 49.4]) bloco(m, x - 0.45, 0, z - 0.45, x + 0.45, H, z + 0.45, KO.concreto);
  for (let z = P; z < 50 - 1e-6; z += P) for (const x of [-17.4, 17.4]) bloco(m, x - 0.45, 0, z - 0.45, x + 0.45, H, z + 0.45, KO.concreto);
  // o núcleo (elevadores e escadas) sobe na frente, com a fôrma trepante amarela no alto
  bloco(m, -7, 0, 14, 7, H + FRENTE.nucleo * FRENTE.pe, 30, KO.nucleo);
  bloco(m, -7.4, H + FRENTE.nucleo * FRENTE.pe - 3, 13.6, 7.4, H + FRENTE.nucleo * FRENTE.pe, 30.4, KO.forma, { topo: false });
  // a tela de proteção na borda das lajes de cima
  for (const z of [-0.2, 50.2]) bloco(m, -18.2, H - FRENTE.pe, z - 0.05, 18.2, H + 1.2, z + 0.05, KO.tela, { topo: false });
  for (const x of [-18.2, 18.2]) bloco(m, x - 0.05, H - FRENTE.pe, -0.2, x + 0.05, H + 1.2, 50.2, KO.tela, { topo: false });
  return m;
}

/** Até onde (z local) a planta da torre vai na altura y: as três lâminas, depois duas, uma e a coroa. */
export function plantaNaAltura(spec, y) {
  const L = spec.laminas;
  if (y < L[2].topo) return 25;
  if (y < L[1].topo) return 15;
  if (y < L[0].topo) return 1;
  return -25 + spec.coroa.fundo;
}

// ------------------------------------------------------------------------------------------------ o canteiro do lago

/** Coroa plana (terra do leito) de r0 a r1 em n trechos, na cota y. */
function coroaPlana(m, cx, cz, r0, r1, y, k, n) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const P = [[r0, a0], [r0, a1], [r1, a1], [r1, a0]].map(([r, a]) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)]);
    m.quad(...P, [0, 1, 0], ...P.map((q) => [q[0], q[2]]), k);
  }
}

/** Tapume em círculo de raio r (2,4 m com a faixa champanhe da Holding), aberto nas 8 avenidas (meia abertura 16 m). */
function tapume(m, cx, cz, r, y, abrir = 16) {
  const passo = 4;
  const n = Math.ceil((2 * Math.PI * r) / passo);
  const meia = (abrir / r) / RAD;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 360;
    const a1 = ((i + 1) / n) * 360;
    const meio = (a0 + a1) / 2;
    if (AVENIDAS.some((g) => Math.abs(((meio - g + 540) % 360) - 180) < meia)) continue;
    const ax = cx + r * Math.cos(a0 * RAD);
    const az = cz + r * Math.sin(a0 * RAD);
    const bx = cx + r * Math.cos(a1 * RAD);
    const bz = cz + r * Math.sin(a1 * RAD);
    // as duas faces (de dentro e de fora)
    parede(m, ax, az, bx, bz, y, y + 2.1, KO.tapume);
    parede(m, bx, bz, ax, az, y, y + 2.1, KO.tapume);
    parede(m, ax, az, bx, bz, y + 2.1, y + 2.4, KO.faixa);
    parede(m, bx, bz, ax, az, y + 2.1, y + 2.4, KO.faixa);
  }
}

/** Contêineres de obra e montes de material num ângulo da praça (graus), a r metros do centro. */
function canteiro(m, cx, cz, r, graus, y, semente) {
  const a = graus * RAD;
  const ux = Math.cos(a);
  const uz = Math.sin(a);
  const px = -uz;
  const pz = ux;
  const em = (dr, dl) => [cx + ux * (r + dr) + px * dl, cz + uz * (r + dr) + pz * dl];
  // dois contêineres de escritório empilhados (um com a cor da Holding) e um de ferramentas
  for (const [dr, dl, k, y0] of [[0, -9, KO.conteinerHolding, 0], [0, -9, KO.conteiner, 2.6], [0, 4, KO.conteiner, 0]]) {
    const [x, z] = em(dr, dl);
    caixaOrientada(m, x, z, ux, uz, 6.05, 1.22, y + y0, y + y0 + 2.59, k);
  }
  // montes de brita e areia
  const montes = [[-12, 16, KO.brita, 4.5], [-6, 24, KO.areia, 5.5], [-16, 28, KO.brita, 3.8]];
  montes.forEach(([dr, dl, k, raio], i) => {
    const [x, z] = em(dr, dl);
    cilindro(m, x, z, y, y + raio * 0.55, raio, 0.4, 10, k, { a0: semente + i });
  });
}

function caixaOrientada(m, cx, cz, ux, uz, hw, hd, y0, y1, k) {
  // a caixa ao longo da tangente (perpendicular ao raio)
  const tx = -uz;
  const tz = ux;
  const c = (sa, sb) => [cx + tx * hw * sa + ux * hd * sb, cz + tz * hw * sa + uz * hd * sb];
  const P = [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = P[i];
    const [bx, bz] = P[(i + 1) % 4];
    parede(m, ax, az, bx, bz, y0, y1, k);
    parede(m, bx, bz, ax, az, y0, y1, k);
  }
  m.quad([P[0][0], y1, P[0][1]], [P[1][0], y1, P[1][1]], [P[2][0], y1, P[2][1]], [P[3][0], y1, P[3][1]], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1], k);
}

/** Malha do canteiro do lago (o leito de terra, o tapume e dois canteiros) no centro (cx, cz), cota da gleba y. */
export function malhaCanteiroLago(cx, cz, y) {
  const m = new Malha('opaco');
  coroaPlana(m, cx, cz, LAGO.r0 - 6, LAGO.r1 + 6, y + LAGO.fundo + 0.04, KO.terra, 96);
  tapume(m, cx, cz, PRACA.r0 + 4, y);
  canteiro(m, cx, cz, PRACA.r0 + 18, 112, y, 1);
  canteiro(m, cx, cz, PRACA.r0 + 18, 292, y, 2);
  return m;
}

/** Malha do canteiro da torre: os contêineres e os montes na praça, dos dois lados do par. */
export function malhaCanteiroTorre(cx, cz, y) {
  const m = new Malha('opaco');
  canteiro(m, cx, cz, PRACA.r0 + 16, 22, y, 3);
  canteiro(m, cx, cz, PRACA.r0 + 16, 202, y, 4);
  canteiro(m, cx, cz, PRACA.r0 + 16, 158, y, 5);
  return m;
}

// ------------------------------------------------------------------------------------------------ no render

/**
 * A obra no render: as duas gruas (mastro por trechos e a cabeça girando), o canteiro do lago e o da torre. O domínio
 * chama montar(plano, cota) uma vez por montagem e quadro(tMs, est) a cada quadro.
 * @param {object} ctx   o contexto do render
 * @param {THREE.Material} material  o 'arcologia:opaco' do conjunto fixo
 */
export function criarObra(ctx, material) {
  const grupo = new THREE.Group();
  grupo.name = 'arcologia:obra';
  let gruas = null;
  let lago = null;
  let torre = null;
  let base = null; // { x, z, y, rot }
  const mesh = (m, nome) => {
    const o = new THREE.Mesh(geometriaDe(m), material);
    o.name = nome;
    ctx.medidas?.familia(o, 'arcologia');
    return o;
  };

  function criarGruas() {
    const cabeca = geometriaDe(malhaCabeca());
    const carrinho = geometriaDe(malhaCarrinho());
    const frente = geometriaDe(malhaFrente());
    gruas = [TORRE_LAMINA, TORRE_IRMA].map((spec, k) => {
      const mm = malhaMastro(k === 0 ? GRUA.topoBlade + GRUA.trecho : GRUA.topoLegacy + GRUA.trecho);
      const mastro = mesh(mm.malha, `obra:grua${k}:mastro`);
      const c = new THREE.Mesh(cabeca, material);
      c.name = `obra:grua${k}:cabeca`;
      ctx.medidas?.familia(c, 'arcologia');
      const car = new THREE.Mesh(carrinho, material);
      car.name = `obra:grua${k}:carrinho`;
      ctx.medidas?.familia(car, 'arcologia');
      c.add(car);
      const g = new THREE.Group();
      g.add(mastro, c);
      grupo.add(g);
      const esq = new THREE.Mesh(frente, material);
      esq.name = `obra:frente${k}`;
      ctx.medidas?.familia(esq, 'arcologia');
      esq.visible = false;
      grupo.add(esq);
      return { g, mastro, cabeca: c, carrinho: car, esq, porTrecho: mm.porTrecho, topo: k === 0 ? GRUA.topoBlade : GRUA.topoLegacy, lado: k === 0 ? -1 : 1, altura: -1, spec };
    });
  }

  const api = {
    grupo,
    /** Posição do par e cota da gleba; refaz os canteiros na cota. */
    montar(plano, cota) {
      const [cx, cz] = plano.centro;
      base = { x: plano.torre.x, z: plano.torre.z, y: cota, rot: plano.torre.rot ?? PAR.rot };
      for (const o of [lago, torre]) if (o) {
        grupo.remove(o);
        o.geometry.dispose();
      }
      lago = mesh(malhaCanteiroLago(cx, cz, cota), 'obra:lago');
      torre = mesh(malhaCanteiroTorre(cx, cz, cota), 'obra:canteiroTorre');
      grupo.add(lago, torre);
      lago.visible = false;
      torre.visible = false;
      if (!gruas) criarGruas();
      const torres = torresDoPar({ x: base.x, z: base.z, rot: base.rot });
      for (const gr of gruas) {
        gr.torre = torres[gr.lado < 0 ? 0 : 1];
        // ao lado de fora de cada torre, no eixo do par: a 32 + 18 + afastamento metros do centro
        const d = PAR.distancia / 2 + 18 + GRUA.afastamento;
        const c = Math.cos(base.rot);
        const s = Math.sin(base.rot);
        gr.g.position.set(base.x + c * gr.lado * d, cota, base.z - s * gr.lado * d);
        gr.g.visible = false;
      }
    },
    /** Mostra e sobe a obra pelo estado (estadoObra) e anima as lanças. */
    quadro(tMs, est) {
      if (lago) lago.visible = !!est?.lago;
      if (torre) torre.visible = !!est?.torre;
      if (!gruas) return;
      for (const gr of gruas) {
        const h = gr.lado < 0 ? est?.blade ?? 0 : est?.legacy ?? 0;
        const vis = !!est?.torre;
        gr.g.visible = vis;
        // a frente de obra: do topo do vidro até a obra, na planta da altura; nasce no pódio e fecha na coroa
        const e = vis ? espessuraFrente(h, gr.spec) : 0;
        const frente = e > 0.05;
        gr.esq.visible = frente;
        if (frente) {
          const t = gr.torre;
          const y0 = h - e;
          const zMax = plantaNaAltura(gr.spec, Math.max(PODIO.altura, y0) + Math.min(FRENTE.pe, e));
          // a malha vai de z 0 a 50: a origem na face lisa (z local -25) e o z encolhido até a planta
          const c = Math.cos(t.rot);
          const s = Math.sin(t.rot);
          gr.esq.position.set(t.x + s * -25, base.y + y0, t.z + c * -25);
          gr.esq.rotation.set(0, t.rot, 0);
          gr.esq.scale.set(1, e / ALTURA_FRENTE, Math.max(0.2, (zMax + 25) / 50));
        }
        if (!vis) continue;
        // o topo da grua passa a obra por uma folga, até o máximo (a da Blade acima do mastro de 520 m)
        const alvo = Math.min(gr.topo, Math.max(GRUA.folga + 12, h + GRUA.folga));
        const n = Math.ceil(alvo / GRUA.trecho);
        if (n !== gr.altura) {
          gr.altura = n;
          gr.mastro.geometry.setDrawRange(0, n * gr.porTrecho);
          gr.cabeca.position.set(0, n * GRUA.trecho, 0);
        }
        // a lança gira devagar e o carrinho anda nela (fase própria de cada grua)
        const t = tMs / 1000 + (gr.lado < 0 ? 0 : 37);
        gr.cabeca.rotation.y = gr.lado * 0.6 + 0.9 * Math.sin(t * 0.045) + (gr.lado < 0 ? Math.PI : 0) + base.rot;
        gr.carrinho.position.x = 18 + 28 * (0.5 + 0.5 * Math.sin(t * 0.11));
      }
    },
    /** Triângulos das gruas na altura de agora (o teste e o resultado das cenas leem). */
    get triangulos() {
      if (!gruas) return 0;
      let n = 0;
      for (const gr of gruas) if (gr.g.visible) n += (gr.altura * gr.porTrecho) / 3 + gr.cabeca.geometry.index.count / 3 + gr.carrinho.geometry.index.count / 3;
      return n;
    },
    descartar() {
      grupo.parent?.remove(grupo);
      grupo.traverse((o) => o.geometry?.dispose());
    },
  };
  return api;
}

export function registrar() {}
