// Modelos dos prédios da Holding (R5, D34, D60): canteiro de megaprojeto, pedreira, areal, olaria, concreteira e os do
// M1b e da linha de corte (mina, cimenteira, vidraria, serraria, manejo). A cor da Holding entra pelo bit HOLDING da
// tabela de prédios: o shader da fachada pinta inteiros os toldos e letreiros (tapumes, contêineres, faixas dos silos,
// cabines e tambores das betoneiras) e puxa os caixilhos para ela. O nível do prédio (1 a 3, as linhas de produção)
// acrescenta equipamento. Puro: sem three.
import { mat, F, ENTERRA } from './pecas.js';
import { lote, COR } from './servicos.js';

const TAU = Math.PI * 2;

/** Pintura na cor da Holding (o shader troca a cor do toldo pela dela). */
const corHolding = () => mat(F.TOLDO, '#8a7a55');

/** Letreiro da Holding sobre dois postes (de noite acende). */
function letreiro(b, x, y, z, w, h, giro = 0, op = {}) {
  if (b.fora(op)) return;
  const metal = mat(F.METAL, COR.grafite);
  b.em(x, y, z, giro, () => {
    b.caixa(0, h * 0.9, 0, w, h, 0.3, mat(F.LETREIRO, '#2e4a63'), { topo: metal, l1: op.l1 });
    if (b.lod === 0) for (const s of [-1, 1]) b.tubo([s * (w / 2 - 0.4), -0.2, 0], [s * (w / 2 - 0.4), h * 0.9, 0], 0.08, metal, { lados: 4 });
  });
}

/** Pilha cônica (brita, areia, argila) com a borda irregular pela semente. */
function pilha(b, x, z, r, h, cor, k, op = {}) {
  const m = mat(F.CONCRETO, cor, { dg: 0.5, v: 1 });
  const P = b.lod ? [[r, 0], [r * 0.45, h * 0.6], [0, h]] : [[r * (1 + 0.04 * b.r(k)), 0], [r * 0.82, h * 0.2], [r * 0.5, h * 0.55], [r * 0.2, h * 0.86], [0, h]];
  b.torno(x, z, P, m, { liso: true, l1: true, rz: op.rz ?? 0.9 + 0.2 * b.r(k + 1), ladosBase: 12, lados1: 4 });
}

/** Correia transportadora inclinada de a até b2 ([x, y, z]), com os pés a cada ~7 m e a cobertura da esteira. */
function correia(b, a, b2, op = {}) {
  if (b.fora(op)) return;
  const aco = mat(F.METAL, op.cor ?? '#8e9396');
  const capa = mat(F.METAL, '#b8bab6');
  b.viga(a, b2, op.larg ?? 1.1, 0.45, aco, { l1: op.l1 });
  if (b.lod === 1) return;
  // a cobertura de chapa em meia-cana sobre a esteira (pela face de cima, mais clara)
  b.viga([a[0], a[1] + 0.32, a[2]], [b2[0], b2[1] + 0.32, b2[2]], (op.larg ?? 1.1) * 0.8, 0.12, capa, {});
  const L = Math.hypot(b2[0] - a[0], b2[2] - a[2]);
  const n = Math.max(1, Math.floor(L / 7));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const p = [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, a[2] + (b2[2] - a[2]) * t];
    if (p[1] < 1.2) continue;
    b.tubo([p[0], -0.2, p[2]], [p[0], p[1] - 0.25, p[2]], 0.12, aco, { lados: 4 });
  }
}

/** Telhado de duas águas com a cumeeira ao longo de x: w (x) por d (z), da cota y0 até y0 + h, com os oitões. */
function telhado(b, cx, y0, cz, w, d, h, mTelha, mOitao, op = {}) {
  if (b.fora(op)) return;
  const hw = w / 2;
  const hd = d / 2;
  const L = Math.hypot(hd, h);
  b.em(cx, y0, cz, 0, () => {
    b.quad([-hw, 0, hd], [hw, 0, hd], [hw, h, 0], [-hw, h, 0], mTelha, { n: [0, hd / L, h / L], u: [0, w, w, 0], v: [0, 0, L, L], larg: w });
    b.quad([hw, 0, -hd], [-hw, 0, -hd], [-hw, h, 0], [hw, h, 0], mTelha, { n: [0, hd / L, -h / L], u: [0, w, w, 0], v: [0, 0, L, L], larg: w });
    for (const s of [-1, 1]) b.tri([s * hw, 0, hd], [s * hw, 0, -hd], [s * hw, h, 0], mOitao, { n: [s, 0, 0], uv: [[0, 0], [d, 0], [hd, h]] });
  });
}

/** Galpão: paredes de chapa (fachada de galpão), telhado de duas águas, portão e o lanternim opcional. */
function galpao(b, cx, cz, w, d, h, op = {}) {
  const parede = op.parede ?? mat(F.GALPAO, op.cor ?? '#b9bcbb', { a: h, v: 5, c2: '#5d6468', uso: 3 });
  const telha = op.telha ?? mat(F.TELHA_METAL, '#9aa1a4');
  const hc = op.cumeeira ?? Math.max(1.2, d * 0.09);
  b.caixa(cx, -ENTERRA, cz, w, h + ENTERRA, d, parede, { topo: false, faces: op.faces, vBase: 0, l1: true });
  telhado(b, cx, h, cz, w + 0.6, d + 0.6, hc, telha, parede, { l1: true });
  if (op.lanternim && b.lod === 0) {
    b.caixa(cx, h + hc - 0.3, cz, w * 0.8, 1.1, 2, mat(F.BRISE_H, '#9aa1a4', { a: 1.1, v: 1.2, uso: 3 }), { topo: false });
    telhado(b, cx, h + hc + 0.8, cz, w * 0.8 + 0.4, 2.6, 0.5, telha, telha, {});
  }
  if (op.portao) b.caixa(cx + (op.portaoX ?? 0), 0.05, cz + d / 2 + 0.06, op.portao, Math.min(h - 1, 6), 0.12, mat(F.GARAGEM, '#8e9396', { v: 5 }), { topo: false });
}

/** Contêiner de escritório (12,2 x 2,45 x 2,6 m) ao longo de x, com janelas ou na cor da Holding. */
function conteiner(b, x, y, z, m, op = {}) {
  b.caixa(x, y, z, 12.2, 2.6, 2.45, m, { topo: mat(F.METAL, '#a3a6a4'), l1: op.l1 });
}

/** Grua de torre (Liebherr de canteiro): mastro treliçado, cabine, lança, contralança com contrapesos e o cabo. */
function grua(b, x, z, H, lanca, giro, op = {}) {
  const branco = mat(F.METAL, '#d8d6cf');
  const amarelo = mat(F.METAL, '#c4a046');
  const lado = 2;
  b.em(x, 0, z, giro, () => {
    // mastro: quatro montantes e as diagonais
    const r = lado / 2;
    const ladosT = 4;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.tubo([sx * r, -0.5, sz * r], [sx * r, H, sz * r], 0.1, branco, { lados: ladosT });
    const passo = b.ultra ? 3 : 6;
    const faces = b.ultra ? 4 : 2;
    if (b.lod === 0) {
      for (let y = 0, k = 0; y + passo <= H; y += passo, k++) {
        for (let f = 0; f < faces; f++) {
          const [ax, az, bx, bz] = [[-r, r, r, r], [r, r, r, -r], [r, -r, -r, -r], [-r, -r, -r, r]][f];
          const inv = k % 2;
          b.tubo([inv ? bx : ax, y, inv ? bz : az], [inv ? ax : bx, y + passo, inv ? az : bz], 0.05, branco, { lados: 4 });
        }
      }
    }
    b.caixa(0, -0.5, 0, lado, H + 0.5, lado, branco, { so1: true, topo: branco });
    // base de concreto e a cabine com vidro
    b.caixa(0, -ENTERRA, 0, 5, ENTERRA + 0.6, 5, mat(F.CONCRETO, '#a9a399'), {});
    b.caixa(1.6, H - 3.2, 1.4, 2.2, 2.6, 2.2, mat(F.CORTINA, '#9aa1a6', { a: 2.6, v: 1.1, c2: '#3c4144' }), { topo: branco });
    // lança (treliça triangular pela média: banzos e diagonais) e contralança
    const yL = H + 0.3;
    b.tubo([0, yL, 0], [lanca, yL, 0.6], 0.08, amarelo, { lados: 4, l1: true });
    b.tubo([0, yL, 0], [lanca, yL, -0.6], 0.08, amarelo, { lados: 4 });
    b.tubo([0, yL + 1.6, 0], [lanca, yL + 0.3, 0], 0.08, amarelo, { lados: 4 });
    if (b.lod === 0) {
      const n = Math.floor(lanca / (b.ultra ? 2.5 : 5));
      for (let i = 0; i < n; i++) {
        const xa = (lanca * i) / n;
        const xb = (lanca * (i + 1)) / n;
        const ya = yL + 1.6 - 1.3 * (xa / lanca);
        b.tubo([xa, yL, i % 2 ? 0.6 : -0.6], [xb, ya - 1.3 * ((xb - xa) / lanca), 0], 0.04, amarelo, { lados: 4 });
      }
    }
    b.caixa(lanca / 2, yL - 0.2, 0, lanca, 1.6, 1.2, amarelo, { so1: true });
    const cl = op.contra ?? lanca * 0.32;
    b.caixa(-cl / 2, yL - 0.4, 0, cl, 0.6, 2, branco, { l1: true });
    // contrapesos e a faixa da Holding na contralança
    b.caixa(-cl + 1.6, yL - 2.6, 0, 3, 2.4, 2.2, mat(F.CONCRETO, '#9c978d'), { l1: true });
    b.caixa(-cl / 2 + 1, yL + 0.2, 0, cl * 0.55, 1.4, 0.2, corHolding(), {});
    // torre do topo (cabeça) e os tirantes
    b.tubo([0, yL, 0], [0, yL + 5.5, 0], 0.18, branco, { lados: 4, l1: true });
    if (b.lod === 0) {
      b.tubo([0, yL + 5.3, 0], [lanca * 0.62, yL + 1.6 - 1.3 * 0.62, 0], 0.03, branco, { lados: 4 });
      b.tubo([0, yL + 5.3, 0], [-cl, yL, 0], 0.03, branco, { lados: 4 });
    }
    // carrinho, cabo e a carga içada
    const xc = lanca * (op.carro ?? 0.55);
    const yc = op.gancho ?? H * 0.45;
    b.caixa(xc, yL - 0.5, 0, 1.4, 0.5, 1.4, amarelo, {});
    b.tubo([xc, yL - 0.5, 0], [xc, yc + 1, 0], 0.03, mat(F.METAL, COR.grafite), { lados: 4 });
    b.caixa(xc, yc - 0.6, 0, 3, 1.4, 1.2, mat(F.METAL, '#7a5a48'), {});
  });
}

// ------------------------------------------------------------------------------------------------ Escritório de Obra

/**
 * Escritório de Obra (canteiros de Hudson Yards): tapume na cor da Holding com o portão e o letreiro, a pilha de
 * contêineres de escritório com escada e passarelas, o galpão-armazém, a grua de torre e o pátio de material.
 */
function escritorioObra(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const chao = mat(F.PISO, '#8e8170');
  const laje = mat(F.CONCRETO, '#a8a297');
  const branco = mat(F.JANELA, '#d4d3cd', { a: 2.6, v: 2, c2: '#5d6468', uso: 2, dg: 0.25 });
  const aco = mat(F.METAL, COR.aco);
  lote(b, chao);
  // tapume em volta (frente e lados), com o vão do portão
  const ht = 2.6;
  const tap = corHolding();
  const xg0 = hw - 14;
  const xg1 = hw - 5;
  b.parede(-hw + 0.2, hd - 0.2, xg0, hd - 0.2, 0, ht, tap, {});
  b.parede(xg1, hd - 0.2, hw - 0.2, hd - 0.2, 0, ht, tap, {});
  b.parede(hw - 0.2, hd - 0.2, hw - 0.2, -hd + 0.2, 0, ht, tap, {});
  b.parede(-hw + 0.2, -hd + 0.2, -hw + 0.2, hd - 0.2, 0, ht, tap, {});
  b.parede(xg0, hd - 0.2, -hw + 0.2, hd - 0.2, 0, ht, mat(F.MADEIRA, '#8a6d52', { v: 1.2 }), { ao: 0.85 });
  letreiro(b, (xg0 + xg1) / 2, 0.05, hd - 0.4, 9, 1.6, 0, { l1: false });
  // piso de concreto sob os contêineres e o pátio
  b.plano(-hw + 1, -2, -hw + 19, hd - 1.5, 0.08, laje, {});
  // contêineres de escritório: três de base, três no meio, dois em cima; dois na cor da Holding
  const cx = -hw + 8.5;
  for (let nivel = 0; nivel < 3; nivel++) {
    const n = nivel === 2 ? 2 : 3;
    for (let j = 0; j < n; j++) {
      const holding = (nivel === 1 && j === 1) || (nivel === 2 && j === 0);
      conteiner(b, cx, 0.1 + nivel * 2.6, 3 + j * 2.5, holding ? corHolding() : branco, {});
    }
    // passarela da frente com o guarda-corpo
    if (nivel > 0) {
      b.laje(cx, 0.1 + nivel * 2.6, 3 + n * 2.5 - 0.6, 12.2, 1.3, 0.15, mat(F.METAL, '#6f7477'), {});
      if (b.lod === 0) b.parede(cx - 6.1, 3 + n * 2.5, cx + 6.1, 3 + n * 2.5, 0.1 + nivel * 2.6, 1.2 + nivel * 2.6, aco, {});
    }
  }
  b.caixa(cx, 0.1, 5.5, 12.2, 7.8, 7.5, branco, { so1: true });
  // escada metálica na ponta (lances inclinados)
  if (b.lod === 0) for (let k = 0; k < 2; k++) b.placa([cx + 6.3, 0.1 + k * 2.6, 9.6], [cx + 7.5, 0.1 + k * 2.6, 9.6], [cx + 7.5, 2.7 + k * 2.6, 3.6 + k * 0.4], [cx + 6.3, 2.7 + k * 2.6, 3.6 + k * 0.4], 0.12, mat(F.METAL, '#6f7477'), {});
  // galpão-armazém no fundo à direita
  const gw = b.nivel >= 2 ? 26 : 20;
  galpao(b, hw - 1.5 - gw / 2, -hd + 9, gw, 14, 8, { portao: 7, cor: '#bfc1bd', lanternim: true });
  b.caixa(hw - 1.5 - gw / 2, 8.6, -hd + 16.1, 10, 1.4, 0.25, mat(F.LETREIRO, '#2e4a63'), { topo: false });
  // grua de torre (a mais alta)
  grua(b, -hw + 10.5, -hd + 8, 40, 32, -0.35, { contra: 9 });
  // pátio de material: vergalhões, blocos em paletes, fôrmas e tubos
  if (b.lod === 0) {
    for (let k = 0; k < 4; k++) b.caixa(4 + k * 2.4, 0.08, hd - 9, 1.6, 0.9, 6, mat(F.METAL, '#7a5a48'), {});
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.caixa(-2 + i * 1.6, 0.08, hd - 4 + j * 1.6, 1.2, 1.1, 1.2, mat(F.CONCRETO, '#b4ada1'), {});
    for (let k = 0; k < 3; k++) b.tubo([12, 0.6 + (k % 2) * 0.9, hd - 13 + k * 1.1], [20, 0.6 + (k % 2) * 0.9, hd - 13 + k * 1.1], 0.45, mat(F.CONCRETO, '#9f9a90'), {});
    b.caixa(-2, 0.08, -2, 5, 1.4, 2.4, mat(F.MADEIRA, '#8a6d52', { v: 1.2 }), {});
  }
  // caminhões do canteiro
  b.veiculo(hw - 9, 0.08, hd - 6, Math.PI, { comp: 9, larg: 2.5, alt: 1.6, mat: corHolding(), corCabine: '#d6d6d0' });
  b.veiculo(1, 0.08, 6, Math.PI / 2, { comp: 8.5, larg: 2.5, betoneira: true, mat: corHolding(), corCabine: '#d6d6d0' });
}

// ------------------------------------------------------------------------------------------------ pedreira e mina

/**
 * Cava em bancadas (pedreira de granito, mina de calcário): degraus de rocha que sobem para o fundo, cada um mais
 * estreito, com a frente irregular pela semente, as bermas de cascalho e o mato no alto.
 */
function bancadas(b, z0, z1, nB, hB, rocha, berma, topo, k0) {
  const hw = b.w / 2;
  for (let k = 0; k < nB; k++) {
    const recuo = k * (b.w * 0.07);
    const zf = z1 - ((z1 - z0) * k) / nB;
    const n = b.lod ? 2 : b.ultra ? 10 : 6;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = -hw + 0.6 + recuo + ((b.w - 1.2 - 2 * recuo) * i) / n;
      const j = i === 0 || i === n ? 0 : b.lod ? 0 : (b.r(k0 + k * 20 + i) - 0.5) * 2.4;
      pts.push([x, zf + j - (i === 0 || i === n ? 2.5 : 0)]);
    }
    pts.push([hw - 0.6 - recuo, z0], [-hw + 0.6 + recuo, z0]);
    const ehTopo = k === nB - 1;
    b.prisma(pts, -ENTERRA, ENTERRA + hB * (k + 1), rocha, { topo: ehTopo ? topo : berma, l1: true });
  }
}

/** Britagem: tremonha sobre o muro, o britador na cor da Holding e a torre de peneiras sobre pés. */
function britagem(b, x, z, op = {}) {
  const conc = mat(F.CONCRETO, '#aaa49a');
  const aco = mat(F.METAL, '#8e9396');
  b.caixa(x, -ENTERRA, z, 6, ENTERRA + 5, 6, conc, { l1: true });
  b.torno(x, z, [[1.4, 5], [3.4, 8.2]], aco, { topo: false, l1: true });
  b.caixa(x + 6.5, 0, z, 6, 6.5, 5, corHolding(), { topo: mat(F.METAL, '#9aa1a4'), l1: true });
  // torre de peneiras
  const tx = x + (op.dx ?? 15);
  const tz = z - (op.dz ?? 2);
  if (b.lod === 0) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.tubo([tx + sx * 2.4, -0.3, tz + sz * 2], [tx + sx * 2.4, 9, tz + sz * 2], 0.18, aco, { lados: 4 });
  b.caixa(tx, 8.6, tz, 5.6, 4.6, 4.8, mat(F.GALPAO, '#a7adb0', { a: 4.6, v: 2.4, uso: 3, c2: '#5d6468' }), { topo: mat(F.METAL, '#9aa1a4'), l1: true });
  b.caixa(tx, -ENTERRA, tz, 4.8, ENTERRA + 8.6, 4, aco, { so1: true, topo: false });
  correia(b, [x + 9, 5.5, z], [tx - 2.6, 12.5, tz], { l1: true });
  return [tx, tz];
}

/**
 * Pedreira (pedreiras de brita reais): a frente de lavra em bancadas de granito no fundo, a britagem com a tremonha,
 * o britador e a torre de peneiras, as correias até as pilhas cônicas de brita, a pá carregadeira, o caminhão e o
 * escritório com o letreiro.
 */
function pedreira(b, op = {}) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const chao = mat(F.PISO, op.chao ?? '#9a9284');
  const rocha = mat(F.PEDRA, op.rocha ?? '#8e8a84', { v: 1.6, dg: 0.6 });
  const berma = mat(F.PISO, op.berma ?? '#a39a8a');
  const mato = mat(F.VERDE, COR.gramaEscura);
  lote(b, chao);
  const nB = 4;
  const hB = op.hB ?? 4.6;
  bancadas(b, -hd + 0.6, -hd + b.d * 0.48, nB, hB, rocha, berma, mato, 300);
  // árvores no alto da cava
  for (let k = 0; k < 5; k++) b.arvore(-hw * 0.6 + k * (b.w * 0.15), nB * hB, -hd + 2.6, { alt: b.entre(320 + k, 5, 7), raio: 2, especie: 'oiti' });
  if (op.semBritagem) {
    for (let k = 0; k < 3; k++) pilha(b, -hw + 10 + k * 13, hd - 10 + (k % 2) * 2, 5.5, 4.5, op.cor ?? '#8f8b85', 340 + k * 3);
  } else {
    const [tx, tz] = britagem(b, -hw + 9, hd * 0.12, { dx: 15, dz: 1 });
    // pilhas de brita (uma por produto) com as correias radiais
    const np = 2 + b.nivel;
    for (let k = 0; k < np; k++) {
      const a = -0.2 + (k / Math.max(1, np - 1)) * 1.4;
      const px = tx + Math.cos(a) * 15;
      const pz = Math.min(hd - 7.5, tz + Math.sin(a) * 13);
      pilha(b, Math.min(hw - 7.5, px), pz, 6.2, 5.6 + b.r(350 + k), op.cor ?? '#8f8b85', 360 + k * 3);
      correia(b, [tx + 2.4, 12.2, tz], [Math.min(hw - 7.5, px), 6.4, pz], { larg: 0.9 });
    }
  }
  // escritório (contêiner) e o letreiro na entrada
  conteiner(b, -hw + 8, 0.08, hd - 3, mat(F.JANELA, '#d4d3cd', { a: 2.6, v: 2, c2: '#5d6468', uso: 2 }), {});
  letreiro(b, -hw + 19, 0.05, hd - 0.8, 7, 1.4);
  // pá carregadeira e caminhão basculante na cor da Holding
  b.veiculo(hw * 0.15, 0.08, hd - 6, 0.8, { comp: 8, larg: 2.8, alt: 1.8, mat: corHolding(), corCabine: '#d6d6d0' });
  b.veiculo(-hw * 0.3, 0.08, hd * 0.05 + 8, -0.4, { comp: 6.5, larg: 2.6, alt: 1.2, mat: mat(F.METAL, '#b8962f'), corCabine: '#b8962f' });
}

/** Mina de calcário: a mesma cava, clara, sem britagem (o calcário vai cru para a cimenteira). */
function mina(b) {
  pedreira(b, { chao: '#b9b1a1', rocha: '#cfc6b3', berma: '#c4bba8', cor: '#cdc5b4', hB: 4.2, semBritagem: true });
}

// ------------------------------------------------------------------------------------------------ areal

/**
 * Areal (areais de rio): a cava inundada com o dique em volta, a draga flutuante com o pórtico e a lança, a tubulação
 * sobre boias até o classificador, as pilhas cônicas de areia, a pá e o escritório.
 */
function areal(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const areia = mat(F.PISO, '#b8aa8a');
  const dique = mat(F.CONCRETO, '#a8997b', { dg: 0.5 });
  const agua = mat(F.AGUA, '#3c5a52');
  const aco = mat(F.METAL, '#8e9396');
  lote(b, areia);
  // cava inundada no fundo, com o dique de terra
  const n = b.lod ? 8 : b.ultra ? 20 : 12;
  const lago = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = 1 + 0.08 * Math.sin(3 * a + 1);
    lago.push([Math.cos(a) * (hw - 3) * r, -hd * 0.42 - Math.sin(a) * hd * 0.42 * r]);
  }
  b.piso(lago, 0.62, agua, { l1: true });
  b.faixa([...lago, lago[0]], 0.95, 1.4, dique, { esp: 1, pontas: false });
  b.faixa([...lago, lago[0]], 0.95, 1.4, dique, { so1: true });
  // draga: flutuador, casa da draga na cor da Holding, pórtico em A e a lança mergulhada
  const dx = -hw * 0.25;
  const dz = -hd * 0.42;
  b.caixa(dx, 0.3, dz, 9, 1.1, 4.2, mat(F.METAL, '#4d5356'), { l1: true });
  b.caixa(dx - 1.6, 1.4, dz, 3.4, 2.6, 3.2, corHolding(), { topo: mat(F.METAL, '#d6d6d0'), l1: true });
  if (b.lod === 0) {
    for (const s of [-1, 1]) b.tubo([dx + 3.8, 1.4, dz + s * 1.8], [dx + 2.6, 6.2, dz], 0.12, aco, { lados: 4 });
    b.viga([dx + 4.5, 1.2, dz], [dx + 10.5, -0.6, dz], 0.8, 0.6, aco, {});
    // tubulação sobre boias até a margem e o classificador
    for (let k = 0; k < 5; k++) b.cilindro(dx - 6 - k * 2.6, 0.55, dz + 3 + k * 1.6, 0.45, 0.35, corHolding(), { lados: 8 });
    b.tubo([dx - 4.5, 0.95, dz + 2], [dx - 17, 0.95, dz + 10], 0.25, mat(F.METAL, COR.grafite), {});
  }
  // classificador: torre de aço com os ciclones e a correia de empilhar
  const cx = -hw + 7;
  const cz = 2;
  if (b.lod === 0) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.tubo([cx + sx * 2, -0.3, cz + sz * 1.8], [cx + sx * 2, 7, cz + sz * 1.8], 0.15, aco, { lados: 4 });
  b.caixa(cx, 6.8, cz, 4.6, 2.6, 4.2, mat(F.METAL, '#a7adb0'), { l1: true });
  b.torno(cx, cz, [[0.2, 9.4], [1.1, 10.8], [1.1, 12]], aco, { topo: aco, l1: true, ladosBase: 12, lados1: 4 });
  b.caixa(cx, -ENTERRA, cz, 4, ENTERRA + 6.8, 3.6, aco, { so1: true, topo: false });
  // pilhas de areia (uma a mais por nível)
  const np = 2 + b.nivel;
  for (let k = 0; k < np; k++) {
    const px = -hw + 16 + k * ((b.w - 24) / Math.max(1, np - 1));
    const pz = hd - 8 - (k % 2) * 3;
    pilha(b, px, pz, 5.6, 5 + 2 * b.r(400 + k), '#c2b08c', 410 + k * 3);
    if (k === 0) correia(b, [cx + 2, 8.5, cz + 1], [px, 7.2, pz], { larg: 0.9 });
  }
  conteiner(b, hw - 8, 0.08, hd - 2.5, mat(F.JANELA, '#d4d3cd', { a: 2.6, v: 2, c2: '#5d6468', uso: 2 }), {});
  letreiro(b, hw - 8, 0.05, hd - 0.6, 6, 1.3);
  b.veiculo(hw * 0.2, 0.08, hd - 14, -0.6, { comp: 7.5, larg: 2.6, alt: 1.6, mat: corHolding(), corCabine: '#d6d6d0' });
}

// ------------------------------------------------------------------------------------------------ olaria

/**
 * Olaria (cerâmicas de tijolo): o galpão do forno-túnel de tijolo aparente com o lanternim, a chaminé alta de tijolo,
 * o secador aberto com as gaiolas de tijolo cru, o monte de argila, os paletes de tijolo pronto e o letreiro.
 */
function olaria(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const chao = mat(F.PISO, '#8f6f5a');
  const tijolo = mat(F.TIJOLO, '#9a5d45', { a: 3.2, v: 3, uso: 3 });
  const telha = mat(F.FIBRO, '#8f8e88');
  const cru = mat(F.CONCRETO, '#a8735c', { dg: 0.3, v: 1 });
  const aco = mat(F.METAL, '#6f7477');
  lote(b, chao);
  // galpão do forno-túnel (um a mais no nível 3)
  const fornos = b.nivel >= 3 ? 2 : 1;
  for (let f = 0; f < fornos; f++) {
    const fz = -hd + 9 + f * 13;
    galpao(b, -4, fz, 38, 11, 6.5, { parede: mat(F.GALPAO, '#9a5d45', { a: 6.5, v: 4, c2: '#5d4a3a', uso: 3 }), telha, lanternim: true, portao: 4.5, portaoX: 15 });
  }
  // chaminé de tijolo, afinando para cima, com o anel de concreto
  const chx = hw - 7;
  const chz = -hd + 8;
  b.torno(chx, chz, [[2, -ENTERRA], [1.85, 5], [1.15, 29.4], [1.3, 29.6], [1.3, 30.4]], tijolo, { topo: mat(F.CONCRETO, '#4a4542'), l1: true, ladosBase: 12 });
  b.caixa((chx - 4 + 15) / 2 + 1, 0, chz, chx - 15 + 2, 2.4, 2.2, tijolo, {});
  // secador: cobertura em pilares com as fileiras de tijolo cru
  const sx = -hw + 11;
  const sz = hd - 9;
  const ns = b.nivel >= 2 ? 2 : 1;
  for (let s = 0; s < ns; s++) {
    const zz = sz - s * 12;
    b.laje(sx, 4.6, zz, 18, 10, 0.2, telha, { l1: true });
    if (b.lod === 0) {
      for (let i = 0; i < 4; i++) for (const s2 of [-1, 1]) b.tubo([sx - 8.5 + i * (17 / 3), -0.2, zz + s2 * 4.6], [sx - 8.5 + i * (17 / 3), 4.4, zz + s2 * 4.6], 0.1, aco, { lados: 4 });
      for (let r = 0; r < 3; r++) b.caixa(sx, 0.08, zz - 3 + r * 3, 15, 1.6, 1.4, cru, {});
    }
  }
  // monte de argila e a correia até a extrusora
  pilha(b, hw - 9, hd - 9, 6.5, 5.2, '#7d5442', 500);
  b.caixa(hw - 18, 0, hd - 18, 6, 4.4, 5, mat(F.GALPAO, '#a7adb0', { a: 4.4, v: 3, uso: 3, c2: '#5d6468' }), { topo: telha, l1: true });
  correia(b, [hw - 11, 2.5, hd - 11], [hw - 16, 4.6, hd - 16], { larg: 0.8 });
  // paletes de tijolo pronto e o caminhão
  if (b.lod === 0) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.caixa(2 + i * 2, 0.08, 2 + j * 2, 1.2, 1.2, 1.1, tijolo, {});
  letreiro(b, -hw + 6, 0.05, hd - 0.8, 7, 1.4);
  b.veiculo(hw * 0.25, 0.08, hd - 4, Math.PI / 2, { comp: 9, larg: 2.5, alt: 1.2, mat: corHolding(), corCabine: '#d6d6d0' });
}

// ------------------------------------------------------------------------------------------------ concreteira

/** Silo de cimento: pés, cone de descarga, corpo, faixa da Holding e o filtro do topo. */
function siloCimento(b, x, z, r, h, op = {}) {
  const branco = mat(F.METAL, '#d2d2cd');
  const aco = mat(F.METAL, '#8e9396');
  const pe = op.pe ?? 4.5;
  if (b.lod === 0) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.tubo([x + sx * r * 0.7, -0.3, z + sz * r * 0.7], [x + sx * r * 0.7, pe + 1.6, z + sz * r * 0.7], 0.12, aco, { lados: 4 });
  b.torno(x, z, [[0.3, pe], [r, pe + 2], [r, pe + 2 + h], [r * 0.3, pe + 2.8 + h]], branco, { topo: aco, l1: true, ladosBase: 12, lados1: 4 });
  if (b.lod === 0) b.caixa(x, pe + 1.8 + h, z, 1.2, 1, 1.2, aco, { topo: aco });
  if (b.lod === 0) b.torno(x, z, [[r + 0.04, pe + 2 + h * 0.78], [r + 0.04, pe + 2 + h * 0.88]], corHolding(), { topo: false, ladosBase: 12 });
}

/**
 * Concreteira (centrais de concreto usinado): os silos de cimento com a faixa da Holding (um a mais por nível), a torre
 * dosadora sobre pés com a baia das betoneiras, as baias de agregado com as pilhas, a correia inclinada, a caixa
 * d'água, a cabine de controle e as betoneiras com o tambor na cor da Holding.
 */
function concreteira(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const chao = mat(F.PISO, '#a39e94');
  const conc = mat(F.CONCRETO, '#b0aaa0');
  const aco = mat(F.METAL, '#8e9396');
  lote(b, chao);
  // silos em fila no fundo à esquerda
  const ns = 2 + b.nivel;
  const r = 1.9;
  const sz = -hd + 7;
  for (let k = 0; k < ns; k++) siloCimento(b, -hw + 5 + k * 4.6, sz, r, 14.5, {});
  // passarela do topo dos silos
  b.laje(-hw + 5 + ((ns - 1) * 4.6) / 2, 21.6, sz, (ns - 1) * 4.6 + 2, 1.2, 0.2, aco, {});
  // torre dosadora: pés (as betoneiras entram por baixo) e o corpo fechado com a faixa
  const tx = -hw + 5 + ns * 4.6 + 4;
  const tz = -hd + 10;
  if (b.lod === 0) for (const [sx, sz2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.tubo([tx + sx * 3, -0.3, tz + sz2 * 3], [tx + sx * 3, 8.6, tz + sz2 * 3], 0.2, aco, { lados: 4 });
  b.caixa(tx, 8.4, tz, 7, 7.5, 7, mat(F.GALPAO, '#c4c6c3', { a: 7.5, v: 3.5, uso: 3, c2: '#5d6468' }), { topo: mat(F.METAL, '#9aa1a4'), l1: true });
  b.caixa(tx, 13.4, tz + 3.56, 6, 1.6, 0.12, mat(F.LETREIRO, '#2e4a63'), { topo: false });
  b.caixa(tx, -ENTERRA, tz, 6, ENTERRA + 8.4, 6, aco, { so1: true, topo: false });
  // roscas dos silos até a torre
  if (b.lod === 0) for (let k = 0; k < ns; k++) b.tubo([-hw + 5 + k * 4.6, 7.2, sz], [tx - 3, 13.5, tz - 2], 0.22, aco, { lados: 4 });
  // baias de agregado com as pilhas (areia, brita 0 e brita 1)
  const bx0 = hw - 22;
  for (let k = 0; k <= 3; k++) b.caixa(bx0 + k * 6.6, -ENTERRA, -hd + 7, 0.5, ENTERRA + 3, 11, conc, {});
  b.caixa(bx0 + 9.9, -ENTERRA, -hd + 7, 20.3, ENTERRA + 3, 11, conc, { so1: true });
  const cores = ['#c2b08c', '#8f8b85', '#7f7b75'];
  for (let k = 0; k < 3; k++) pilha(b, bx0 + 3.3 + k * 6.6, -hd + 7.5, 3.2, 3.4, cores[k], 600 + k * 3, { rz: 1.4 });
  correia(b, [bx0 + 9, 1.2, -hd + 14], [tx + 3, 15, tz + 1], { larg: 1, l1: true });
  // caixa d'água e cabine de controle
  b.cilindro(hw - 5, 0, hd - 14, 2.4, 5.5, mat(F.METAL, '#c9cac5'), { topo: aco });
  b.caixa(tx + 9, 0, tz + 9, 5, 3.2, 3.5, mat(F.JANELA, '#d4d3cd', { a: 3.2, v: 1.6, c2: '#5d6468', uso: 2 }), { topo: aco });
  letreiro(b, -hw + 8, 0.05, hd - 0.8, 7, 1.4);
  // betoneiras: uma sob a torre e duas na fila
  b.veiculo(tx, 0.08, tz, Math.PI / 2, { comp: 9, larg: 2.5, betoneira: true, mat: corHolding(), corCabine: '#d6d6d0' });
  for (let k = 0; k < 2; k++) b.veiculo(tx - 4 + k * 5, 0.08, hd - 7, Math.PI, { comp: 9, larg: 2.5, betoneira: true, mat: corHolding(), corCabine: '#d6d6d0' });
}

// ------------------------------------------------------------------------------------------------ cimenteira

/**
 * Cimenteira (fábricas de cimento com pré-aquecedor): a torre de ciclones (estrutura aberta, os ciclones em pares e o
 * duto de subida), o forno rotativo inclinado sobre os pilares com os anéis, o resfriador, os silos de clínquer de
 * concreto com a galeria de correia e a chaminé.
 */
function cimenteira(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const chao = mat(F.PISO, '#a7a196');
  const conc = mat(F.CONCRETO, '#b6b0a5');
  const aco = mat(F.METAL, '#8e9396');
  const claro = mat(F.METAL, '#c4c6c3');
  lote(b, chao);
  // torre de ciclones
  const tx = -hw + 10;
  const tz = -hd + 11;
  const L = 12;
  const H = 52;
  b.caixa(tx, -ENTERRA, tz, L, ENTERRA + 16, L, mat(F.GALPAO, '#bfc1bd', { a: 8, v: 4, uso: 3, c2: '#5d6468' }), { topo: false, l1: true });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.caixa(tx + sx * (L / 2 - 0.5), 16, tz + sz * (L / 2 - 0.5), 1, H - 16, 1, aco, { topo: false });
  for (let k = 0; k < 5; k++) b.laje(tx, 16 + k * 9, tz, L, L, 0.4, mat(F.METAL, '#7a7f83'), {});
  b.caixa(tx, 16, tz, L, H - 16, L, claro, { so1: true });
  for (let k = 0; k < 4; k++) {
    const y = 18 + k * 9;
    for (const s of [-1, 1]) {
      const x = tx + s * 2.6;
      b.torno(x, tz + 1.2 * s, [[0.5, y], [2, y + 3], [2, y + 6.4], [1.2, y + 7]], claro, { topo: aco, ladosBase: 12 });
    }
  }
  b.tubo([tx - 4, 2, tz - 4], [tx - 4, H - 2, tz - 4], 1.2, aco, {});
  b.caixa(tx, H, tz, 8, 3.5, 7, claro, { topo: aco, l1: true });
  // forno rotativo: do pé da torre para a frente, caindo um pouco, sobre três pilares com os anéis
  const k0 = [tx + 6, 7.5, tz + 2];
  const k1 = [hw - 12, 4.5, tz + 2];
  b.tubo(k0, k1, 2.3, mat(F.METAL, '#6f6a64'), { pontas: true, l1: true, lados: b.lod ? 4 : 12 });
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const p = [k0[0] + (k1[0] - k0[0]) * t, k0[1] + (k1[1] - k0[1]) * t, k0[2]];
    b.caixa(p[0], -ENTERRA, p[2], 3, ENTERRA + p[1] - 2, 6, conc, { l1: true });
    if (b.lod === 0) b.tubo([p[0] - 0.5, p[1], p[2]], [p[0] + 0.5, p[1], p[2]], 2.65, aco, { pontas: true, lados: 12 });
  }
  // resfriador e o galpão do clínquer no fim do forno
  galpao(b, hw - 7, tz + 2, 10, 12, 9, { cor: '#bfc1bd' });
  // silos de clínquer de concreto na frente, com a galeria de correia
  for (const s of [0, 1]) b.cilindro(-6 + s * 16, -ENTERRA, hd - 10, 6.2, ENTERRA + 28, conc, { topo: mat(F.LAJE, '#8f8b84'), l1: true });
  b.caixa(2, 28, hd - 10, 18, 2.4, 3, claro, { l1: true });
  correia(b, [hw - 8, 5, tz + 9], [10, 29, hd - 10], { larg: 1.6, cor: '#a7adb0', l1: true });
  // chaminé alta no fundo (a mais alta)
  b.cilindro(-hw + 3, -ENTERRA, -hd + 3, 1.8, ENTERRA + 60, conc, { topo: mat(F.CONCRETO, '#4a4542'), l1: true });
  if (b.lod === 0) b.torno(-hw + 3, -hd + 3, [[1.9, 56], [1.9, 58]], mat(F.METAL, '#9a3a30'), { topo: false });
  letreiro(b, -hw + 20, 0.05, hd - 0.8, 8, 1.6);
  b.veiculo(hw - 10, 0.08, hd - 7.5, Math.PI, { comp: 12, larg: 2.5, alt: 2.6, mat: corHolding(), corCabine: '#d6d6d0' });
}

// ------------------------------------------------------------------------------------------------ vidraria

/**
 * Vidraria (fábricas de vidro float): o galpão longo do forno e da linha float com o lanternim, a casa de composição
 * alta com a galeria de correia, a chaminé do forno e os cavaletes de chapas de vidro no pátio.
 */
function vidraria(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const chao = mat(F.PISO, '#a7a196');
  const claro = mat(F.GALPAO, '#c4c6c3', { a: 12, v: 6, uso: 3, c2: '#5d6468' });
  lote(b, chao);
  galpao(b, -2, -2, b.w - 16, 16, 11, { parede: claro, lanternim: true, portao: 6, portaoX: (b.w - 16) / 2 - 6 });
  // a parte alta do forno
  b.caixa(-hw + 14, -ENTERRA, -2, 14, ENTERRA + 16, 17, claro, { topo: mat(F.METAL, '#9aa1a4'), l1: true });
  // casa de composição e a galeria
  b.caixa(-hw + 4.5, -ENTERRA, -hd + 7, 7, ENTERRA + 20, 9, mat(F.GALPAO, '#bfc1bd', { a: 5, v: 3, uso: 3, c2: '#5d6468' }), { topo: mat(F.METAL, '#9aa1a4'), l1: true });
  correia(b, [-hw + 8, 18, -hd + 7], [-hw + 12, 15.5, -6], { larg: 1.6, cor: '#a7adb0' });
  b.cilindro(-hw + 20, -ENTERRA, -hd + 4, 1.4, ENTERRA + 30, mat(F.CONCRETO, '#b6b0a5'), { topo: mat(F.CONCRETO, '#4a4542'), l1: true });
  // cavaletes com as chapas de vidro
  if (b.lod === 0) {
    for (let k = 0; k < 4; k++) {
      const x = hw - 26 + k * 6;
      const z = hd - 6;
      b.caixa(x, 0.08, z, 4.5, 0.4, 2.4, mat(F.METAL, '#5c6266'), {});
      b.placa([x - 2.1, 3.2, z - 0.3], [x + 2.1, 3.2, z - 0.3], [x + 2.1, 0.5, z + 0.7], [x - 2.1, 0.5, z + 0.7], 0.3, mat(F.VIDRO, '#5f7d80'), {});
    }
  }
  letreiro(b, -hw + 10, 0.05, hd - 0.8, 8, 1.6);
  b.veiculo(hw - 8, 0.08, hd - 9, Math.PI / 2, { comp: 12, larg: 2.5, alt: 0.6, mat: corHolding(), corCabine: '#d6d6d0' });
}

// ------------------------------------------------------------------------------------------------ serraria

/** Serraria: o galpão aberto de serra, o pátio de toras em pilhas, o silo de serragem e as pilhas de tábuas. */
function serraria(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const chao = mat(F.PISO, '#8f8170');
  const madeira = mat(F.MADEIRA, '#7b5b40', { v: 1.2 });
  const tora = mat(F.MADEIRA, '#6e5039', { v: 0.6 });
  lote(b, chao);
  galpao(b, 7, -5, 30, 18, 7, { parede: mat(F.GALPAO, '#a8996f', { a: 7, v: 4, uso: 3, c2: '#5d4a3a' }), faces: { pz: mat(F.LISO, '#3a3632') }, portao: 0 });
  // pátio de toras: pilhas em pirâmide
  for (let p = 0; p < 3; p++) {
    const px = -hw + 7 + p * 9;
    const pz = hd - 7;
    const camadas = b.lod ? 0 : 4;
    for (let c = 0; c < camadas; c++) for (let i = 0; i < 4 - c; i++) {
      const x = px - 1.6 + 0.37 + i * 0.74 + c * 0.37;
      const y = 0.4 + c * 0.66;
      b.tubo([x, y, pz - 4], [x, y, pz + 4], 0.36, tora, { lados: b.ultra ? 8 : 6, pontas: true });
    }
    b.caixa(px, 0, pz, 3, 2.6, 8, tora, { so1: true });
  }
  // silo de serragem (o mais alto) e o duto
  b.torno(-hw + 6, -hd + 6, [[2.6, -ENTERRA], [2.6, 10], [0.4, 14]], mat(F.METAL, '#b8bab6'), { l1: true, ladosBase: 12 });
  b.tubo([-hw + 8, 12.5, -hd + 6], [-8, 7, -6], 0.35, mat(F.METAL, '#8e9396'), {});
  // pilhas de tábuas com tabiques
  if (b.lod === 0) for (let k = 0; k < 3; k++) b.caixa(hw - 6, 0.08, hd - 4 - k * 3.4, 6, 1.6, 1.4, madeira, {});
  letreiro(b, -hw + 20, 0.05, hd - 0.8, 6, 1.3);
  b.veiculo(hw - 12, 0.08, hd - 8, Math.PI / 2, { comp: 10, larg: 2.5, alt: 1, mat: corHolding(), corCabine: '#d6d6d0' });
}

// ------------------------------------------------------------------------------------------------ manejo

/** Manejo florestal: a casa de madeira com varanda, o viveiro de mudas sob o sombrite, as toras e a mata em volta. */
function manejo(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const chao = mat(F.PISO, '#7f7564');
  const madeira = mat(F.MADEIRA, '#7b5b40', { v: 0.9 });
  const telha = mat(F.TELHA, '#94604c');
  const muda = mat(F.VERDE, '#55603d');
  lote(b, chao);
  // casa de madeira com a varanda
  b.caixa(-hw + 9, 0, hd - 9, 9, 3.2, 6, mat(F.CASA, '#8a6d52', { a: 3.2, v: 2.2, c2: '#4b3f35', uso: 2 }), { topo: false, l1: true });
  telhado(b, -hw + 9, 3.2, hd - 9, 10.4, 9.2, 1.9, telha, madeira, { l1: true });
  // viveiro: sombrite sobre pilaretes e as fileiras de mudas
  b.laje(5, 2.6, 0, 16, 10, 0.05, mat(F.METAL, '#384236'), { l1: true });
  if (b.lod === 0) {
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.tubo([-2.5 + i * 5, -0.2, s * 4.8], [-2.5 + i * 5, 2.6, s * 4.8], 0.06, madeira, { lados: 4 });
    for (let r = 0; r < 4; r++) b.caixa(5, 0.08, -3.6 + r * 2.4, 14, 0.5, 1.2, muda, {});
  }
  // toras e o caminhão na cor da Holding
  for (let i = 0; i < 4; i++) b.tubo([hw - 10, 0.4 + (i % 2) * 0.6, hd - 4 - i * 0.7], [hw - 3, 0.4 + (i % 2) * 0.6, hd - 4 - i * 0.7], 0.35, madeira, { lados: 6, pontas: true });
  b.veiculo(hw - 8, 0.08, -hd + 8, 0.3, { comp: 8, larg: 2.4, alt: 1, mat: corHolding(), corCabine: '#d6d6d0' });
  letreiro(b, -hw + 4, 0.05, hd - 0.8, 4, 1.1);
  // a mata em volta (fundo e lados)
  for (let k = 0; k < 9; k++) {
    const t = k / 8;
    const x = -hw + 2 + t * (b.w - 4);
    const R = b.entre(720 + k, 2.4, 3.2);
    b.arvore(Math.max(-hw + R + 0.3, Math.min(hw - R - 0.3, x)), 0.05, -hd + R + 0.3 + b.entre(700 + k, 0, 2), { alt: b.entre(710 + k, 8, 10), raio: R, especie: k % 2 ? 'oiti' : 'mata2' });
  }
}

/** Geradores dos prédios da Holding (o id é o de data/holding.js). */
export const MODELOS_HOLDING = Object.freeze({
  escritorioObra, pedreira: (b) => pedreira(b), areal, olaria, concreteira, mina, cimenteira, vidraria, serraria, manejo,
});
