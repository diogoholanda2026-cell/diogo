// Helicóptero da Holding (D61; dona: X1b): depois da torre.e4 ele pousa no heliponto da Blade Tower (o ponto POUSO do
// plano, a 500 m), num ciclo de uns 2,5 min reais: chega do mar, faz a aproximação final de frente para a proa do
// heliponto, pousa, espera com o rotor em marcha lenta, decola e volta para o mar. Biturbina de 13 m (o porte de um
// AW139 ou H160 executivo) na cor da Holding (D34), com a faixa champanhe, as janelas escuras, o farol de pouso e a luz
// de anticolisão. Só visual, sem simulação. Materiais do conjunto fixo da Arcologia (nada compila quando ele aparece).
//   ctx.dominio('helicoptero').fixar(t)   congela o ciclo no segundo t (as cenas); null volta ao relógio
//   ctx.dominio('helicoptero').forcar(b)  mostra (true), esconde (false) ou volta às etapas (null)
import * as THREE from 'three';
import { ETAPA } from '../../contratos/flags.js';
import { POUSO, TORRE_POSICAO, GLEBA_ENVELOPE } from '../../data/arcologia-plano.js';
import { Malha, acab, LUZ, bloco, barra, cilindro, geometriaDe, materiais } from './torre.js';

/** O ciclo (segundos reais) e os trechos dele: chegada, aproximação, descida, no chão, subida e partida. */
export const CICLO = Object.freeze({ total: 150, chegada: 30, aproximacao: 15, descida: 10, chao: 45, subida: 10 });
/** Pés dos esquis abaixo da origem do helicóptero (m). */
const ESQUI = 1.35;

/** Fuselagem em seções elípticas ao longo de x (o nariz em +x), com a cauda cônica. */
function fuselagem(m, k, kVidro) {
  // estações [x, meia largura, meia altura, centro em y]
  const E = [
    [6.3, 0.05, 0.05, 0.2], [6.0, 0.45, 0.55, 0.25], [5.2, 0.85, 0.95, 0.35], [4.0, 1.08, 1.15, 0.45],
    [2.0, 1.15, 1.2, 0.5], [0, 1.12, 1.18, 0.5], [-1.6, 0.95, 1.0, 0.55], [-2.8, 0.55, 0.62, 0.75],
    [-4.0, 0.34, 0.36, 0.95], [-8.2, 0.2, 0.22, 1.05],
  ];
  const seg = 14;
  const anel = [];
  for (const [x, w, h, cy] of E) {
    const l = [];
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const y = cy + Math.sin(a) * h;
      const z = Math.cos(a) * w;
      // a faixa de janelas: o terço de cima da cabine, da frente até o meio
      const janela = x > -1.4 && x < 5.6 && Math.sin(a) > 0.05 && Math.sin(a) < 0.75;
      l.push(m.v(x, y, z, 0, Math.sin(a), Math.cos(a), x, a * w, janela ? kVidro : k));
    }
    anel.push(l);
  }
  for (let j = 0; j + 1 < anel.length; j++) {
    for (let s = 0; s < seg; s++) {
      const a = anel[j][s];
      const b = anel[j][(s + 1) % seg];
      const c = anel[j + 1][(s + 1) % seg];
      const d = anel[j + 1][s];
      m.tri(a, b, c);
      m.tri(a, c, d);
    }
  }
}

/** O helicóptero (sem os rotores): fuselagem, faixa, deriva, estabilizador, esquis, mastro e as luzes. */
export function malhaHelicoptero(cor = '#c9a86a') {
  const m = new Malha('opaco');
  const k = acab(cor, { rugo: 0.25, metal: 0.55 });
  const kVidro = acab('#1b2026', { rugo: 0.08, metal: 0.7 });
  const kEscuro = acab('#2d3034', { rugo: 0.5, metal: 0.4 });
  const kFaixa = acab('#b8a684', { rugo: 0.3, metal: 1 });
  fuselagem(m, k, kVidro);
  // faixa champanhe na lateral e o capô das turbinas sobre a cabine
  bloco(m, -1.6, 0.0, -1.14, 4.2, 0.18, 1.14, kFaixa, { topo: false });
  bloco(m, -1.8, 1.55, -0.65, 1.8, 2.05, 0.65, k);
  // deriva e estabilizador
  bloco(m, -8.4, 1.0, -0.06, -7.0, 3.1, 0.06, k);
  bloco(m, -7.4, 0.95, -1.5, -6.6, 1.05, 1.5, k);
  // esquis com os montantes
  for (const z of [-1.15, 1.15]) {
    barra(m, [-2.4, -ESQUI + 0.05, z], [3.2, -ESQUI + 0.05, z], 0.07, 6, kEscuro);
    barra(m, [3.2, -ESQUI + 0.05, z], [3.6, -ESQUI + 0.35, z], 0.07, 6, kEscuro);
    for (const x of [-1.2, 2.0]) barra(m, [x, -ESQUI + 0.05, z], [x, -0.45, z * 0.75], 0.06, 6, kEscuro);
  }
  // mastro do rotor
  cilindro(m, 0.3, 0, 2.05, 2.6, 0.22, 0.18, 8, kEscuro);
  // luzes: anticolisão vermelha na deriva e o farol de pouso sob o nariz
  bloco(m, -8.1, 3.1, -0.1, -7.8, 3.3, 0.1, acab('#c0281c', { luz: LUZ.obstaculo }));
  bloco(m, 4.6, -0.75, -0.18, 4.95, -0.62, 0.18, acab('#fff3dc', { luz: LUZ.aro }));
  return m;
}

/** Rotor principal de 5 pás (13,8 m) e o cubo. */
export function malhaRotor() {
  const m = new Malha('opaco');
  const k = acab('#2a2c2f', { rugo: 0.45, metal: 0.4 });
  cilindro(m, 0, 0, 0, 0.35, 0.35, 0.28, 10, k);
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // a pá como uma lâmina fina, larga 0,4 m, de 0,3 a 6,9 m do centro
    const P = (r, w) => [c * r - s * w, 0.2, s * r + c * w];
    for (const [y, n] of [[0.24, 1], [0.16, -1]]) {
      const q = [P(0.3, -0.2), P(6.9, -0.2), P(6.9, 0.2), P(0.3, 0.2)].map((v) => [v[0], y, v[2]]);
      m.quad(...q, [0, n, 0], [0, 0], [1, 0], [1, 1], [0, 1], k);
    }
  }
  return m;
}

/** Rotor de cauda (3 pás de 1,2 m) no plano x-y. */
export function malhaRotorCauda() {
  const m = new Malha('opaco');
  const k = acab('#2a2c2f', { rugo: 0.45, metal: 0.4 });
  for (let p = 0; p < 3; p++) {
    const a = (p / 3) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const P = (r, w) => [c * r - s * w, s * r + c * w, 0];
    for (const n of [1, -1]) m.quad(P(0.1, -0.1), P(1.2, -0.1), P(1.2, 0.1), P(0.1, 0.1), [0, 0, n], [0, 0], [1, 0], [1, 1], [0, 1], k);
  }
  return m;
}

// ------------------------------------------------------------------------------------------------ o voo

const suave = (t) => t * t * (3 - 2 * t);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Pontos do voo no mundo (y absoluto): a almofada (a origem do helicóptero pousado), o ponto acima dela, a
 * aproximação a 180 m da proa e 70 m acima, a chegada e a partida sobre o mar.
 */
export function rotaDoVoo(cota = GLEBA_ENVELOPE.cota) {
  const rot = TORRE_POSICAO.rot;
  // a frente da Blade (a proa do heliponto) no mundo e o lado
  const fx = Math.sin(rot);
  const fz = Math.cos(rot);
  const lx = fz;
  const lz = -fx;
  const pad = [POUSO.x, cota + POUSO.y + ESQUI, POUSO.z];
  const em = (f, l, y) => [POUSO.x + fx * f + lx * l, y, POUSO.z + fz * f + lz * l];
  return {
    pad,
    acima: [pad[0], pad[1] + 25, pad[2]],
    aprox: em(180, 0, pad[1] + 70),
    // em cruzeiro sobre o mar, um pouco acima do heliponto (a aproximação a 500 m não desce para subir de novo)
    chegada: em(1600, 500, pad[1] + 60),
    partida: em(1600, -500, pad[1] + 90),
    frente: Math.atan2(fz, -fx), // de frente para a torre (o nariz em +x local: rumo = atan2(-dz, dx))
  };
}

/** Posição do helicóptero no segundo t do ciclo: { p, rumo (rad, o nariz), rotor (0 a 1), noChao }. */
export function posicaoNoCiclo(t, R) {
  const C = CICLO;
  let s = ((t % C.total) + C.total) % C.total;
  const fim1 = C.chegada;
  const fim2 = fim1 + C.aproximacao;
  const fim3 = fim2 + C.descida;
  const fim4 = fim3 + C.chao;
  const fim5 = fim4 + C.subida;
  if (s < fim1) return { p: lerp3(R.chegada, R.aprox, suave(s / fim1)), rotor: 1, noChao: false };
  if (s < fim2) return { p: lerp3(R.aprox, R.acima, suave((s - fim1) / C.aproximacao)), rotor: 1, noChao: false };
  if (s < fim3) return { p: lerp3(R.acima, R.pad, suave((s - fim2) / C.descida)), rotor: 1, noChao: false };
  if (s < fim4) {
    // no chão: o rotor desce à marcha lenta e volta antes de decolar
    const u = (s - fim3) / C.chao;
    return { p: [...R.pad], rotor: 0.35 + 0.65 * Math.max(0, 1 - 4 * Math.min(u, 1 - u)), noChao: true };
  }
  if (s < fim5) return { p: lerp3(R.pad, R.acima, suave((s - fim4) / C.subida)), rotor: 1, noChao: false };
  s -= fim5;
  return { p: lerp3(R.acima, R.partida, suave(s / (C.total - fim5))), rotor: 1, noChao: false };
}

// ------------------------------------------------------------------------------------------------ domínio

function criarDominio(ctx) {
  const mats = materiais(ctx);
  const grupo = new THREE.Group();
  grupo.name = 'arcologia:helicoptero';
  grupo.visible = false;
  ctx.cena.add(grupo);
  let corpo = null;
  let cor = null;
  const rotor = new THREE.Mesh(geometriaDe(malhaRotor()), mats.opaco);
  rotor.position.set(0.3, 2.6, 0);
  rotor.name = 'heli:rotor';
  const cauda = new THREE.Mesh(geometriaDe(malhaRotorCauda()), mats.opaco);
  cauda.position.set(-7.9, 2.0, 0.22);
  cauda.name = 'heli:cauda';
  for (const o of [rotor, cauda]) ctx.medidas?.familia(o, 'arcologia');
  grupo.add(rotor, cauda);
  let fixo = null;
  let forcado = null;
  let rota = null;
  let anterior = null;
  let giro = 0;
  let tAnt = 0;

  function montarCorpo(c) {
    if (corpo) {
      grupo.remove(corpo);
      corpo.geometry.dispose();
    }
    corpo = new THREE.Mesh(geometriaDe(malhaHelicoptero(c)), mats.opaco);
    corpo.name = 'heli:corpo';
    ctx.medidas?.familia(corpo, 'arcologia');
    grupo.add(corpo);
    cor = c;
  }

  const visivel = () => {
    if (forcado !== null) return forcado;
    const etapas = ctx.dominio('arcologia')?.etapas?.() ?? ctx.sim?.espelho?.arcologia?.etapas ?? [];
    return etapas.some((e) => e.id === 'torre.e4' && e.estado === ETAPA.PRONTA);
  };

  return {
    nome: 'helicoptero',
    quadro(tMs) {
      const vis = visivel();
      grupo.visible = vis;
      if (!vis) return;
      const c = ctx.sim?.espelho?.holding?.cor ?? '#c9a86a';
      if (c !== cor) montarCorpo(c);
      rota ??= rotaDoVoo();
      const t = fixo ?? tMs / 1000;
      const q = posicaoNoCiclo(t, rota);
      grupo.position.set(q.p[0], q.p[1], q.p[2]);
      // o rumo pela direção do voo (no chão e pairando, o da aproximação: de frente para a torre)
      const prox = posicaoNoCiclo(t + 0.25, rota).p;
      const dx = prox[0] - q.p[0];
      const dz = prox[2] - q.p[2];
      const rumo = Math.hypot(dx, dz) > 0.05 ? Math.atan2(-dz, dx) : rota.frente;
      const alvoRumo = q.noChao || Math.hypot(dx, dz) < 0.5 ? rota.frente : rumo;
      anterior = anterior === null ? alvoRumo : anterior + Math.atan2(Math.sin(alvoRumo - anterior), Math.cos(alvoRumo - anterior)) * 0.08;
      grupo.rotation.set(0, anterior, 0);
      // nariz um pouco para baixo em cruzeiro
      grupo.rotation.z = q.noChao ? 0 : -0.06 * Math.min(1, Math.hypot(dx, dz) / 6);
      const dt = Math.min(0.1, Math.max(0, (tMs - tAnt) / 1000));
      tAnt = tMs;
      giro += dt * 38 * q.rotor;
      rotor.rotation.y = fixo !== null ? fixo * 3.1 : giro;
      cauda.rotation.z = (fixo !== null ? fixo * 3.1 : giro) * 4.5;
    },
    /** Congela o ciclo no segundo t (cenas); null volta ao relógio. */
    fixar(t) {
      fixo = Number.isFinite(t) ? t : null;
      anterior = null;
    },
    /** Mostra, esconde ou volta às etapas (null). */
    forcar(b) {
      forcado = b === null || b === undefined ? null : !!b;
    },
    get grupo() {
      return grupo;
    },
    descartar() {
      ctx.cena.remove(grupo);
      grupo.traverse((o) => o.geometry?.dispose());
    },
  };
}

export function registrar(api) {
  api.registrarDominio('helicoptero', criarDominio);
}
