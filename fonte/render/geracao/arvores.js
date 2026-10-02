// Árvores por espécie e LOD (desenho do render 7): geradores puros (sem three, sem DOM, sem relógio) que servem à
// thread principal (mundo/vegetacao.js), ao worker oficina (tipo 'arvores') e aos testes. As espécies do M1 com
// silhueta própria, cada uma com LOD0 e LOD1 (o impostor sai do LOD0, geracao/impostor.js):
//   palmeira-imperial (Roystonea oleracea)  estipe liso e cinza, palmito verde e as palmas em arco com os folíolos
//   oiti (Moquilea tomentosa)               a árvore de rua: fuste curto e copa em domo, densa e verde-escura
//   mata (Mata Atlântica)                   três copas de dossel: a emergente em guarda-chuva, a redonda e a estreita
//                                           da mata secundária; e a embaúba (Cecropia), esguia e prateada
//   moita                                   a capoeira e o jundu da restinga, que trocam as moitas pintadas no chão
// A copa não é uma bola: lóbulos presos à ponta de cada galho e cartas de cachos de folhas sobre eles (a textura de
// folhas é um atlas de 4 x 2 feito na GPU, materiais/shaders/folha.glsl.js). LOD1 com poucas cartas grandes só na
// casca de fora da copa, viradas para fora (um lado só: as de trás são descartadas pela face).
//
// Também aqui: a regra das copas da textura de ruído do chão (o mesmo hash da GPU, bit a bit) e a pintura da
// vegetação do chão (terVegetacao do GLSL), para pôr cada árvore de perto na copa que o chão pintou de longe.
//
// Vértices: position, normal, uv (local da célula; a casca repete), color (cor da espécie vezes a oclusão e o tom da
// carta, linear) e aArv (célula do atlas, peso do vento). Medidas em metros, base no chão em (0, 0, 0), +y para cima.
import { hashF } from './ruido.js';

// ------------------------------------------------------------------------------------------------ espécies

/** Células do atlas de folhas (4 colunas x 2 linhas; a casca é a única opaca). */
export const CELULA = Object.freeze({ oiti: 0, mataFina: 1, mataMedia: 2, embauba: 3, palma: 4, moita: 5, mataLarga: 6, casca: 7 });
export const ATLAS_FOLHAS = Object.freeze({ colunas: 4, linhas: 2 });

/**
 * Espécies, na ordem do índice (aArv e os bytes da instância). altura e largura: o modelo de referência (a instância
 * escala); folha e casca: albedo sRGB (desenho 9.2: folhagem de 0,05 a 0,12 linear, nada de verde-limão); cartas:
 * quantas no LOD0 e no LOD1. A folha leva a oclusão das cartas de dentro da copa (0,6 a 1): a cor dela é mais clara
 * que a média, para a copa inteira (a cor por vértice) ficar na faixa da folhagem e não sair preta.
 */
export const ESPECIES = Object.freeze([
  { id: 'palmeira', nome: 'palmeira-imperial', altura: 22, largura: 9, folha: '#3d5126', casca: '#8d887e', extra: '#4c6a2c', palmas: [15, 7] },
  { id: 'oiti', nome: 'oiti', altura: 9, largura: 10, folha: '#3a5329', casca: '#4f463e', celula: [CELULA.oiti], forma: 'domo', fuste: 0.27, baseCopa: 0.26, galhos: 5, abertura: 0.95, lobos: 6, lobo: 0.27, achata: 0.72, cartas: [520, 56], carta: 1.3, raioTronco: 0.24 },
  { id: 'mata1', nome: 'mata, emergente de copa em guarda-chuva', altura: 22, largura: 21, folha: '#405433', casca: '#706a60', celula: [CELULA.mataFina, CELULA.mataMedia], forma: 'guardaChuva', fuste: 0.5, baseCopa: 0.52, galhos: 6, abertura: 1.05, lobos: 8, lobo: 0.21, achata: 0.55, cartas: [680, 62], carta: 2.1, raioTronco: 0.42 },
  { id: 'mata2', nome: 'mata, dossel de copa redonda', altura: 16, largura: 15, folha: '#3e562f', casca: '#544a40', celula: [CELULA.mataMedia, CELULA.mataLarga], forma: 'redonda', fuste: 0.26, baseCopa: 0.28, galhos: 5, abertura: 0.8, lobos: 7, lobo: 0.24, achata: 0.72, cartas: [620, 58], carta: 1.9, raioTronco: 0.3 },
  { id: 'mata3', nome: 'mata secundária, copa estreita', altura: 11, largura: 7, folha: '#495c32', casca: '#5f574d', celula: [CELULA.mataLarga, CELULA.mataFina], forma: 'estreita', fuste: 0.3, baseCopa: 0.32, galhos: 3, abertura: 0.5, lobos: 5, lobo: 0.32, achata: 1.1, cartas: [360, 36], carta: 1.45, raioTronco: 0.17 },
  { id: 'embauba', nome: 'embaúba', altura: 13, largura: 8, folha: '#59634f', casca: '#9d998e', celula: [CELULA.embauba] },
  { id: 'moita', nome: 'moita (capoeira e restinga)', altura: 2.6, largura: 3, folha: '#43532a', casca: '#4a3f33', celula: [CELULA.moita], forma: 'moita', fuste: 0.05, baseCopa: 0.05, galhos: 4, abertura: 0.6, lobos: 3, lobo: 0.36, achata: 0.75, cartas: [72, 14], carta: 0.95, raioTronco: 0.05 },
]);
export const ESPECIE = Object.freeze(Object.fromEntries(ESPECIES.map((e, i) => [e.id, i])));
export const N_ESPECIES = ESPECIES.length;

/** Teto de triângulos por LOD (desenho 7.2): palmeira até 800 e folhosa até 2.000 no LOD0; 150 no LOD1. */
export const TETO_TRIS = Object.freeze({ lod0: { palmeira: 800, outras: 2000 }, lod1: 150 });

const linear = (hex) => {
  const v = (k) => {
    const c = parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [v(0), v(1), v(2)];
};

/** Albedo linear de uma cor sRGB (#rrggbb). */
export const corLinear = linear;

// ------------------------------------------------------------------------------------------------ malha

/** Sorteio determinístico em [0, 1) a partir de uma semente (sem estado global). */
function sorteador(s) {
  let k = 0;
  return () => hashF(k++, s | 0, 0x7a11);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const soma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const esc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const pr = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vet = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const comp = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const l = comp(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mistura = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Direção sorteada na esfera (uniforme). */
function direcao(s) {
  const y = 2 * s() - 1;
  const a = 2 * Math.PI * s();
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return [r * Math.cos(a), y, r * Math.sin(a)];
}

/** Construtor de malha: vértices com posição, normal, uv, cor e (célula, vento); índices. */
export class MalhaArvore {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.cor = [];
    this.arv = [];
    this.idx = [];
  }

  get nv() {
    return this.pos.length / 3;
  }

  v(p, n, u, v, cor, celula, vento) {
    this.pos.push(p[0], p[1], p[2]);
    const l = comp(n) || 1;
    this.nor.push(n[0] / l, n[1] / l, n[2] / l);
    this.uv.push(u, v);
    this.cor.push(cor[0], cor[1], cor[2]);
    this.arv.push(celula, vento);
    return this.nv - 1;
  }

  /**
   * Tronco de cone de a até b (raios ra e rb), `lados` faces, sem tampa; uv: u em volta (0 a 1), v ao longo com o
   * texel quadrado (a casca repete na célula). cor: a da casca; vento nas duas pontas.
   */
  cilindro(a, b, ra, rb, lados, cor, ventoA, ventoB, v0 = 0) {
    const d = sub(b, a);
    const L = comp(d) || 1e-3;
    const t = esc(d, 1 / L);
    const ref = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = unit(vet(t, ref));
    const e2 = vet(t, e1);
    const base = this.nv;
    const perim = 2 * Math.PI * Math.max(0.05, (ra + rb) / 2);
    const v1 = v0 + (L / perim) * 1.6;
    const inc = (ra - rb) / L;
    for (let k = 0; k <= lados; k++) {
      const ang = (2 * Math.PI * k) / lados;
      const dir = soma(esc(e1, Math.cos(ang)), esc(e2, Math.sin(ang)));
      const n = soma(dir, esc(t, inc));
      this.v(soma(a, esc(dir, ra)), n, k / lados, v0, cor, CELULA.casca, ventoA);
      this.v(soma(b, esc(dir, rb)), n, k / lados, v1, cor, CELULA.casca, ventoB);
    }
    for (let k = 0; k < lados; k++) {
      const i = base + 2 * k;
      this.idx.push(i, i + 1, i + 3, i, i + 3, i + 2);
    }
    return v1;
  }

  /**
   * Carta de folhas: quadrado de lado `lado` no centro c, com a face para nc (a frente: o enrolamento anti-horário
   * visto de nc) e girado de `giro` em volta dela; nSombra é a normal de luz (a da copa, não a da carta). uv da célula
   * inteira (espelhada se `espelho`).
   */
  carta(c, nc, lado, giro, nSombra, cor, celula, vento, espelho = false, alongar = 1) {
    const ref = Math.abs(nc[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    let e1 = unit(vet(ref, nc));
    let e2 = vet(nc, e1);
    const cg = Math.cos(giro);
    const sg = Math.sin(giro);
    const r1 = soma(esc(e1, cg), esc(e2, sg));
    const r2 = soma(esc(e1, -sg), esc(e2, cg));
    e1 = esc(r1, lado / 2);
    e2 = esc(r2, (lado / 2) * alongar);
    const u0 = espelho ? 1 : 0;
    const u1 = 1 - u0;
    const a = this.v(sub(sub(c, e1), e2), nSombra, u0, 0, cor, celula, vento);
    const b = this.v(sub(soma(c, e1), e2), nSombra, u1, 0, cor, celula, vento);
    const d = this.v(soma(soma(c, e1), e2), nSombra, u1, 1, cor, celula, vento);
    const e = this.v(soma(sub(c, e1), e2), nSombra, u0, 1, cor, celula, vento);
    this.idx.push(a, b, d, a, d, e);
  }

  /** Triângulos. */
  get tris() {
    return this.idx.length / 3;
  }

  /** Arrays tipados e as medidas do modelo (altura, meia largura, esfera envolvente). */
  saida() {
    const pos = Float32Array.from(this.pos);
    let y0 = Infinity;
    let y1 = -Infinity;
    let rh = 0;
    for (let i = 0; i < pos.length; i += 3) {
      y0 = Math.min(y0, pos[i + 1]);
      y1 = Math.max(y1, pos[i + 1]);
      rh = Math.max(rh, Math.hypot(pos[i], pos[i + 2]));
    }
    const cy = (y0 + y1) / 2;
    let rs = 0;
    for (let i = 0; i < pos.length; i += 3) rs = Math.max(rs, Math.hypot(pos[i], pos[i + 1] - cy, pos[i + 2]));
    const nv = pos.length / 3;
    return {
      atributos: {
        posicao: pos,
        normal: Float32Array.from(this.nor),
        uv: Float32Array.from(this.uv),
        cor: Float32Array.from(this.cor),
        arv: Float32Array.from(this.arv),
      },
      indices: nv > 65535 ? Uint32Array.from(this.idx) : Uint16Array.from(this.idx),
      tris: this.idx.length / 3,
      medidas: { altura: y1, base: y0, raioH: rh, centroY: cy, raio: rs },
    };
  }
}

// ------------------------------------------------------------------------------------------------ folhosas

/**
 * Lóbulos da copa (centro e semi-eixos) presos às pontas dos galhos, pela forma da espécie. O topo do tronco é o
 * ponto de onde os galhos saem.
 */
function lobosDaCopa(P, s) {
  const H = P.altura;
  const W = P.largura;
  const yb = P.baseCopa * H;
  const lobos = [];
  const n = P.lobos;
  const rLobo = W * P.lobo;
  for (let k = 0; k < n; k++) {
    const az = (2 * Math.PI * (k + 0.55 * (s() - 0.5))) / n;
    // lóbulos de tamanhos e alcances bem diferentes: a copa fica recortada, com reentrâncias, e não uma bola
    const rx = rLobo * (0.62 + 0.66 * s());
    const ry = rx * P.achata * (0.75 + 0.5 * s());
    const alcance = Math.max(0, W / 2 - rx) * (0.35 + 0.65 * s());
    let y;
    if (P.forma === 'guardaChuva') y = H - ry * (1.0 + 0.5 * s());
    else if (P.forma === 'estreita') y = yb + ry + (H - yb - 2 * ry) * ((k + 0.5) / n) * (0.75 + 0.5 * s());
    else if (P.forma === 'moita') y = ry * (0.7 + 0.5 * s());
    else y = yb + (H - yb) * (0.3 + 0.42 * s());
    lobos.push({ c: [Math.cos(az) * alcance, Math.min(H - ry * 0.85, Math.max(yb + ry * 0.6, y)), Math.sin(az) * alcance], r: [rx, ry, rx * (0.85 + 0.3 * s())] });
  }
  // o lóbulo do alto, no eixo (o domo e a copa redonda fecham em cima; o guarda-chuva fica chato)
  const rt = rLobo * (P.forma === 'guardaChuva' ? 1.1 : 1.0);
  const ryT = rt * P.achata;
  lobos.push({ c: [0, H - ryT * 0.95, 0], r: [rt, ryT, rt] });
  return lobos;
}

/** Dentro do lóbulo (distância normalizada ao quadrado). */
const dentro2 = (p, L) => ((p[0] - L.c[0]) / L.r[0]) ** 2 + ((p[1] - L.c[1]) / L.r[1]) ** 2 + ((p[2] - L.c[2]) / L.r[2]) ** 2;

/** Copa folhosa (oiti, mata 1 a 3, moita): tronco, galhos até os lóbulos e cartas sobre eles. */
function folhosa(M, P, lod, semente) {
  const s = sorteador(semente);
  const H = P.altura;
  const casca = linear(P.casca);
  const folha = linear(P.folha);
  const lobos = lobosDaCopa(P, s);
  const yb = P.baseCopa * H;
  const centro = [0, (yb + H) / 2, 0];
  const hFuste = Math.max(0.3, P.fuste * H);
  const topo = [(s() - 0.5) * 0.25 * P.raioTronco * 4, hFuste, (s() - 0.5) * 0.25 * P.raioTronco * 4];
  const r0 = P.raioTronco;
  const lados = lod ? 4 : P.forma === 'moita' ? 4 : 7;
  // tronco: base alargada e o fuste até a forquilha
  if (P.forma === 'moita') {
    // moita: hastes finas saindo do chão até cada lóbulo
    if (!lod) {
      for (const L of lobos.slice(0, P.galhos)) {
        const pe = [L.c[0] * 0.2, 0, L.c[2] * 0.2];
        M.cilindro(pe, mistura(pe, L.c, 0.8), 0.04, 0.02, 3, casca, 0, 0.3);
      }
    }
  } else {
    const meio = [topo[0] * 0.4, hFuste * 0.35, topo[2] * 0.4];
    if (lod) M.cilindro([0, -0.3, 0], topo, r0 * 1.15, r0 * 0.75, lados, casca, 0, 0.1);
    else {
      const v = M.cilindro([0, -0.3, 0], [0, 0.6, 0], r0 * 1.45, r0 * 1.05, lados, casca, 0, 0);
      const v2 = M.cilindro([0, 0.6, 0], meio, r0 * 1.05, r0 * 0.92, lados, casca, 0, 0.03, v);
      M.cilindro(meio, topo, r0 * 0.92, r0 * 0.78, lados, casca, 0.03, 0.1, v2);
    }
    // galhos: do topo do fuste ao centro de cada lóbulo (os primeiros `galhos`), com uma curva para cima
    const nG = lod ? Math.min(3, P.galhos) : P.galhos;
    for (let k = 0; k < nG; k++) {
      const L = lobos[k % lobos.length];
      const fim = mistura(topo, L.c, 0.92);
      const cotovelo = soma(mistura(topo, fim, 0.5), [0, -0.12 * comp(sub(fim, topo)) * (1 - P.abertura * 0.5), 0]);
      const rg = r0 * 0.62;
      if (lod) M.cilindro(topo, fim, rg, rg * 0.35, 3, casca, 0.1, 0.35);
      else {
        const v = M.cilindro(topo, cotovelo, rg, rg * 0.68, 5, casca, 0.1, 0.25);
        M.cilindro(cotovelo, fim, rg * 0.68, rg * 0.3, 4, casca, 0.25, 0.45, v);
      }
    }
  }
  // cartas: por lóbulo, na proporção da área; LOD0 na casca e no miolo raso, LOD1 só na casca, viradas para fora
  const total = P.cartas[lod ? 1 : 0];
  const areas = lobos.map((L) => L.r[0] * L.r[1] + L.r[1] * L.r[2] + L.r[0] * L.r[2]);
  const somaA = areas.reduce((a, b) => a + b, 0);
  // as cartas do LOD1 são maiores (menos cartas cobrindo a mesma copa); na moita, que é baixa, menos
  const tamanho = P.carta * (lod ? (P.forma === 'moita' ? 1.5 : 2.15) : 1);
  const celulas = P.celula;
  let feitas = 0;
  let tentativas = 0;
  while (feitas < total && tentativas < total * 8) {
    tentativas++;
    // lóbulo pela área
    let x = s() * somaA;
    let li = 0;
    while (li < lobos.length - 1 && x > areas[li]) x -= areas[li++];
    const L = lobos[li];
    let u = direcao(s);
    // guarda-chuva e domo: poucas cartas por baixo (a copa é aberta embaixo, vê-se o galho)
    if ((P.forma === 'guardaChuva' || P.forma === 'domo') && u[1] < -0.35 && s() < 0.6) u = [u[0], -u[1] * 0.5, u[2]];
    // LOD1: as cartas grandes um pouco para dentro (a silhueta fica a mesma do LOD0)
    const casca01 = lod ? 0.78 + 0.1 * s() : 0.68 + 0.32 * Math.sqrt(s());
    const p = [L.c[0] + u[0] * L.r[0] * casca01, L.c[1] + u[1] * L.r[1] * casca01, L.c[2] + u[2] * L.r[2] * casca01];
    if (p[1] < yb - 0.3 * H * 0.1 && P.forma !== 'moita') continue;
    if (p[1] < 0.15) continue;
    // fundo de outro lóbulo: a carta ficaria escondida (só custa pixel)
    let escondida = false;
    let sobra = 1;
    for (let k = 0; k < lobos.length; k++) {
      if (k === li) continue;
      const d2 = dentro2(p, lobos[k]);
      if (d2 < (lod ? 0.95 : 0.5)) escondida = true;
      else if (d2 < 1) sobra = Math.min(sobra, 0.82);
    }
    if (escondida) continue;
    const uG = unit(sub(p, centro));
    const nCarta = lod ? unit(soma(u, esc(direcao(s), 0.25))) : unit(soma(u, esc(direcao(s), 0.75)));
    const nLuz = unit(soma(soma(esc(u, 0.55), esc(uG, 0.33)), esc(nCarta, 0.12)));
    const alturaRel = limitar((p[1] - yb) / Math.max(1, H - yb), 0, 1);
    const oc = (lod ? 0.9 : 0.58 + 0.42 * ((casca01 - 0.68) / 0.32)) * (0.8 + 0.2 * alturaRel) * sobra;
    const tom = 0.86 + 0.28 * s();
    const amarelo = s() < 0.14 ? [1.06, 1.02, 0.84] : [1, 1, 1];
    const cor = [folha[0] * tom * oc * amarelo[0], folha[1] * tom * oc * amarelo[1], folha[2] * tom * oc * amarelo[2]];
    const cel = celulas[Math.floor(s() * celulas.length) % celulas.length];
    const vento = 0.45 + 0.55 * alturaRel;
    M.carta(p, nCarta, tamanho * (0.8 + 0.45 * s()), 2 * Math.PI * s(), nLuz, cor, cel, vento, s() < 0.5);
    feitas++;
  }
}

// ------------------------------------------------------------------------------------------------ palmeira

/** Palmeira-imperial: estipe com a base e o meio engrossados, o palmito verde e as palmas pinadas em arco. */
function palmeira(M, P, lod, semente) {
  const s = sorteador(semente);
  const H = P.altura;
  const hs = H * 0.8;
  const casca = linear(P.casca);
  const palmito = linear(P.extra);
  const folha = linear(P.folha);
  const lados = lod ? 4 : 9;
  // estipe: anéis do perfil (raio por altura), levemente torto
  const perfil = lod ? [[-0.3, 0.34], [hs, 0.23]] : [[-0.3, 0.42], [0.7, 0.33], [3, 0.29], [0.45 * H, 0.3], [0.62 * H, 0.27], [hs, 0.23]];
  const torto = (y) => [Math.sin(y * 0.11 + semente) * 0.12 * (y / H), y, Math.cos(y * 0.09 + semente * 1.3) * 0.1 * (y / H)];
  let v = 0;
  for (let k = 0; k + 1 < perfil.length; k++) {
    const [ya, ra] = perfil[k];
    const [yb, rb] = perfil[k + 1];
    v = M.cilindro(torto(ya), torto(yb), ra, rb, lados, casca, 0, (yb / H) ** 2 * 0.25, v);
  }
  // palmito (a bainha verde e lisa das folhas)
  const pTopo = torto(hs);
  const pPalmito = soma(pTopo, [0, 2.6, 0]);
  M.cilindro(pTopo, pPalmito, 0.25, 0.2, lados, palmito, 0.25, 0.3);
  if (!lod) M.cilindro(pPalmito, soma(pPalmito, [0, 0.9, 0]), 0.2, 0.06, 5, palmito, 0.3, 0.35);
  // palmas: as novas sobem, as velhas caem; a raque é um arco pesado no fim
  const n = P.palmas[lod ? 1 : 0];
  const segs = lod ? 2 : 6;
  const ouro = Math.PI * (3 - Math.sqrt(5));
  const base = soma(pPalmito, [0, -0.25, 0]);
  for (let k = 0; k < n; k++) {
    const az = k * ouro + s() * 0.3;
    const idade = (k + 0.5) / n;
    const e0 = ((72 - 100 * idade) * Math.PI) / 180;
    const L = 4.6 * (0.85 + 0.3 * s());
    const queda = 0.32 + 0.4 * idade;
    const dh = [Math.cos(az), 0, Math.sin(az)];
    const lat = [-Math.sin(az), 0, Math.cos(az)];
    const ponto = (t) => soma(base, soma(esc(dh, L * t * Math.cos(e0) * (1 - 0.1 * t)), [0, L * (t * Math.sin(e0) - queda * t * t), 0]));
    const tom = 0.88 + 0.24 * s();
    let ant = null;
    for (let j = 0; j <= segs; j++) {
      const t = j / segs;
      const c = ponto(t);
      const tg = unit(sub(ponto(Math.min(1, t + 0.02)), ponto(Math.max(0, t - 0.02))));
      // folíolos: os do meio mais longos, caindo em V dos dois lados da raque
      const w = 1.25 * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.95))) * (1 - 0.25 * t);
      // a perpendicular à raque que aponta para baixo: os folíolos pendem dela
      let baixo = unit(vet(tg, lat));
      if (baixo[1] > 0) baixo = esc(baixo, -1);
      const lados2 = [soma(c, soma(esc(lat, w * 0.82), esc(baixo, w * 0.45))), c, soma(c, soma(esc(lat, -w * 0.82), esc(baixo, w * 0.45)))];
      const nLuz = unit(soma(esc(baixo, -1), esc(dh, 0.35)));
      const oc = 0.7 + 0.3 * (1 - idade);
      const cor = [folha[0] * tom * oc, folha[1] * tom * oc, folha[2] * tom * oc];
      const vento = 0.35 + 0.65 * t;
      const idsAtual = lados2.map((p, q) => M.v(p, nLuz, t, q === 1 ? 0 : 1, cor, CELULA.palma, vento));
      if (ant) {
        M.idx.push(ant[0], idsAtual[0], idsAtual[1], ant[0], idsAtual[1], ant[1]);
        M.idx.push(ant[1], idsAtual[1], idsAtual[2], ant[1], idsAtual[2], ant[2]);
      }
      ant = idsAtual;
    }
  }
}

// ------------------------------------------------------------------------------------------------ embaúba

/** Embaúba: tronco fino e claro, galhos em candelabro e as folhas palmadas em guarda-chuva na ponta de cada um. */
function embauba(M, P, lod, semente) {
  const s = sorteador(semente);
  const H = P.altura;
  const casca = linear(P.casca);
  const folha = linear(P.folha);
  const hFuste = 0.58 * H;
  const topo = [0.25 * (s() - 0.5), hFuste, 0.25 * (s() - 0.5)];
  const lados = lod ? 4 : 6;
  if (lod) M.cilindro([0, -0.3, 0], topo, 0.17, 0.11, lados, casca, 0, 0.12);
  else {
    const meio = [topo[0] * 0.5, hFuste * 0.5, topo[2] * 0.5];
    const v = M.cilindro([0, -0.3, 0], meio, 0.19, 0.14, lados, casca, 0, 0.04);
    M.cilindro(meio, topo, 0.14, 0.11, lados, casca, 0.04, 0.12, v);
  }
  const nG = lod ? 3 : 4;
  const pontas = [];
  for (let k = 0; k < nG; k++) {
    const az = (2 * Math.PI * (k + 0.3 * s())) / nG;
    const dh = [Math.cos(az), 0, Math.sin(az)];
    const sai = 1.2 + 0.6 * s();
    const cot = soma(topo, soma(esc(dh, sai), [0, sai * 0.65, 0]));
    const fim = soma(cot, soma(esc(dh, 0.6 + 0.6 * s()), [0, H - 1.2 - cot[1] - 1.4 * s(), 0]));
    if (lod) M.cilindro(topo, fim, 0.08, 0.04, 3, casca, 0.12, 0.45);
    else {
      M.cilindro(topo, cot, 0.09, 0.07, 4, casca, 0.12, 0.3);
      M.cilindro(cot, fim, 0.07, 0.04, 4, casca, 0.3, 0.45);
    }
    pontas.push(fim);
  }
  pontas.push(soma(topo, [0, H - hFuste - 0.6, 0]));
  if (!lod) M.cilindro(topo, pontas[pontas.length - 1], 0.1, 0.05, 4, casca, 0.12, 0.45);
  // rosetas: folhas grandes em volta da ponta, quase deitadas e caindo nas bordas (a face clara vista de baixo)
  for (const pt of pontas) {
    const nF = lod ? 4 : 8;
    for (let k = 0; k < nF; k++) {
      const az = (2 * Math.PI * (k + 0.4 * s())) / nF;
      const dh = [Math.cos(az), 0, Math.sin(az)];
      const lado = (lod ? 1.9 : 1.5) * (0.85 + 0.3 * s());
      const inclina = (0.18 + 0.22 * s()) * Math.PI * 0.5;
      const n = unit(soma([0, Math.cos(inclina), 0], esc(dh, Math.sin(inclina))));
      const c = soma(pt, soma(esc(dh, lado * 0.48), [0, -lado * 0.18 * Math.sin(inclina) - 0.1, 0]));
      const tom = 0.85 + 0.3 * s();
      M.carta(c, n, lado, az, unit(soma(n, [0, 0.6, 0])), esc(folha, tom), CELULA.embauba, 0.75, s() < 0.5);
    }
    if (!lod) {
      // as folhas novas, em pé no centro
      for (let k = 0; k < 2; k++) {
        const az = 2 * Math.PI * s();
        const n = unit([Math.cos(az), 0.4, Math.sin(az)]);
        M.carta(soma(pt, [0, 0.45, 0]), n, 0.8, 2 * Math.PI * s(), [0, 1, 0], esc(folha, 1.12), CELULA.embauba, 0.85, s() < 0.5);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ gerador

/**
 * Malha de uma espécie num LOD (0 ou 1). A semente varia o desenho (o jogo usa uma por espécie: a variação entre
 * árvores vem da instância, escala, giro e tom).
 * @param {number | string} especie  índice ou id
 * @returns {{ atributos: { posicao, normal, uv, cor, arv }, indices, tris, medidas, especie: string, lod: number }}
 */
export function gerarArvore(especie, lod = 0, semente = 1) {
  const i = typeof especie === 'string' ? ESPECIE[especie] : especie;
  const P = ESPECIES[i];
  if (!P) throw new Error(`árvore: espécie desconhecida ${especie}`);
  const M = new MalhaArvore();
  const s = (semente * 7919 + i * 104729 + 13) | 0;
  if (P.id === 'palmeira') palmeira(M, P, lod ? 1 : 0, s);
  else if (P.id === 'embauba') embauba(M, P, lod ? 1 : 0, s);
  else folhosa(M, P, lod ? 1 : 0, s);
  return { ...M.saida(), especie: P.id, lod: lod ? 1 : 0 };
}

/** Todas as espécies nos dois LODs (o pedido 'arvores' da oficina sem espécie). */
export function gerarTodas(semente = 1) {
  const out = [];
  for (let i = 0; i < N_ESPECIES; i++) for (const lod of [0, 1]) out.push(gerarArvore(i, lod, semente));
  return out;
}

// ------------------------------------------------------------------------------------------------ copas do chão

/** As copas da textura de ruído do chão (texturas-chao.js: SEMENTE_CHAO e o canal B de GLSL_GERAR_RUIDO). */
export const SEMENTE_RUIDO = 7101;
/** Camadas de copas que o chão pinta: a de 263 m (copas grandes, terR2) e a de 71 m (moitas e arvoretas, terR3). */
export const REDES_COPA = Object.freeze({
  grande: { periodo: 263, desloc: [0.31, 0.17] },
  pequena: { periodo: 71, desloc: [0.57, 0.83] },
});
/** As duas sub-redes de Worley de cada camada (células por período, raio e semente), como no GLSL. */
export const SUBREDES = Object.freeze([
  { celulas: 16, raio: 1.25, s: SEMENTE_RUIDO + 202 },
  { celulas: 26, raio: 1.5, s: SEMENTE_RUIDO + 259 },
]);

const F = Math.fround;
const fract = (x) => x - Math.floor(x);

/**
 * O gHash do GLSL (GLSL_RUIDO_PERIODICO), bit a bit: célula (inteira, já reduzida ao período) e semente.
 * @returns {number} em [0, 1] (o float de 32 bits que a GPU calcula)
 */
export function hashGPU(cx, cy, s) {
  let h = (Math.imul(cx >>> 0, 1597334677) ^ Math.imul(cy >>> 0, 3812015801) ^ Math.imul(s >>> 0, 2654435769)) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 3266489917) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return F(F(h) * F(1 / 4294967295));
}

/** Copa de uma célula da sub-rede: ponto em uv (0 a 1), altura relativa (alt) e o fator do raio (r), como copaCamada. */
export function copaDaCelula(ci, cj, sub) {
  const per = sub.celulas;
  const i = ((ci % per) + per) % per;
  const j = ((cj % per) + per) % per;
  const hx = hashGPU(i, j, sub.s);
  const hz = hashGPU(i, j, sub.s + 7);
  const id = hashGPU(i, j, sub.s + 13);
  const alt = 0.45 + 0.55 * fract(F(id * F(7.13)));
  const r = sub.raio * (0.8 + 0.5 * fract(F(id * F(13.7))));
  return { u: (ci + hx) / per, v: (cj + hz) / per, alt, r, id };
}

/** Valor da camada de copas (o canal B) num ponto em uv, pelas duas sub-redes (a mais alta vence). */
export function valorCopas(u, v) {
  let m = 0;
  for (const sub of SUBREDES) {
    const per = sub.celulas;
    const px = u * per;
    const pz = v * per;
    const i = Math.floor(px);
    const j = Math.floor(pz);
    let f1 = 9;
    let alvo = null;
    for (let b = -1; b <= 1; b++) {
      for (let a = -1; a <= 1; a++) {
        const c = copaDaCelula(i + a, j + b, sub);
        const d = Math.hypot(c.u * per - px, c.v * per - pz);
        if (d < f1) {
          f1 = d;
          alvo = c;
        }
      }
    }
    m = Math.max(m, alvo.alt * Math.max(0, 1 - f1 * alvo.r));
  }
  return m;
}

/**
 * Copas de uma camada (grande ou pequena) num retângulo do mundo [x0, z0, x1, z1]: posição, altura relativa (alt, o
 * pico do canal B), raio da copa em metros (onde o cone passa de ~0,2) e a sub-rede. Fica de fora a copa que a outra
 * sub-rede cobre no centro (o chão pinta a mais alta).
 * @returns {{ x: number, z: number, alt: number, raio: number, sub: number, id: number }[]}
 */
export function copasNoRetangulo(rede, x0, z0, x1, z1) {
  const R = REDES_COPA[rede] ?? rede;
  const L = R.periodo;
  const out = [];
  SUBREDES.forEach((sub, si) => {
    const per = sub.celulas;
    // uv = w / L + desloc; células cobertas pelo retângulo (com uma de folga)
    const u0 = x0 / L + R.desloc[0];
    const u1 = x1 / L + R.desloc[0];
    const v0 = z0 / L + R.desloc[1];
    const v1 = z1 / L + R.desloc[1];
    const ci0 = Math.floor(u0 * per) - 1;
    const ci1 = Math.floor(u1 * per) + 1;
    const cj0 = Math.floor(v0 * per) - 1;
    const cj1 = Math.floor(v1 * per) + 1;
    const celM = L / per;
    for (let cj = cj0; cj <= cj1; cj++) {
      for (let ci = ci0; ci <= ci1; ci++) {
        const c = copaDaCelula(ci, cj, sub);
        const x = (c.u - R.desloc[0]) * L;
        const z = (c.v - R.desloc[1]) * L;
        if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
        // a outra sub-rede mais alta no centro desta copa: o chão pinta a outra
        const outra = SUBREDES[1 - si];
        if (dominada(c, outra, x / L + R.desloc[0], z / L + R.desloc[1])) continue;
        const raio = (celM * (1 - 0.18 / c.alt) * 0.9) / c.r;
        out.push({ x, z, alt: c.alt, raio, sub: si, id: c.id });
      }
    }
  });
  return out;
}

function dominada(c, outra, u, v) {
  const per = outra.celulas;
  const px = u * per;
  const pz = v * per;
  const i = Math.floor(px);
  const j = Math.floor(pz);
  for (let b = -1; b <= 1; b++) {
    for (let a = -1; a <= 1; a++) {
      const o = copaDaCelula(i + a, j + b, outra);
      const d = Math.hypot(o.u * per - px, o.v * per - pz);
      if (o.alt * Math.max(0, 1 - d * o.r) > c.alt * 0.97) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ vegetação pintada

const ss = (a, b, x) => {
  const t = limitar((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const step = (a, x) => (x >= a ? 1 : 0);

/**
 * A vegetação que o chão pinta num ponto (terVegetacao de terreno.glsl.js, conta por conta): copa da mata, moitas,
 * árvores soltas do pasto, restinga, mata ciliar e a capoeira da encosta do mar.
 * @param {{ h: number, ny: number, mata: number, agua: number, mar: number, urb: number }} e  cota, normal y,
 *   floresta (0 a 1), distância à água (m), mar (0 ou 1) e o uso do solo somado (0 a 1)
 * @param {number[]} r1  terR1 (rgba 0 a 1, manchas de 2,3 km)   r2 terR2 (263 m)   r3 terR3 (71 m)
 */
export function vegetacaoPintada(e, r1, r2, r3) {
  const incl = 1 - e.ny;
  const urb = limitar(e.urb, 0, 1);
  const rC = r3[0] * 0.4 + r2[1] * 0.3 + r3[2] * 0.3;
  const topo = 3 + 28 * rC * rC + 10 * ss(0.25, 0.55, incl);
  const pe = (1 - ss(0.5, 1.1, e.h)) * ss(0.16, 0.3, incl) + ss(0.5, 1.1, e.h);
  const costao = e.mar * (1 - ss(40, 90, e.agua)) * (1 - ss(topo * 0.55, topo, e.h)) * ss(0.08, 0.2, incl + (rC - 0.5) * 0.08) * pe;
  const paredao = ss(0.5, 0.7, incl + (r3[0] - 0.5) * 0.12);
  const copa = ss(0.4, 0.66, e.mata) * (1 - urb) * (1 - ss(0.35, 0.8, costao)) * (1 - paredao);
  const arb = Math.max(ss(0.06, 0.42, e.mata), costao * 0.6 * step(0.2, e.mata)) * (1 - copa) * (1 - urb);
  let moita = arb * ss(0.5, 0.72, r3[2] * 0.4 + r3[3] * 0.25 + r2[0] * 0.2 + arb * 0.35);
  const areal = e.mar * (1 - ss(25, 90, e.agua));
  const pasto = (1 - urb) * (1 - copa) * (1 - areal) * (1 - ss(0.2, 0.35, incl)) * step(0.5, e.h);
  moita = Math.max(moita, pasto * ss(0.6, 0.76, r3[2] * 0.45 + r3[3] * 0.35 + r2[3] * 0.2) * ss(0.35, 0.75, r1[1] * 0.6 + r2[0] * 0.5));
  const grupo = ss(0.5, 0.82, r1[0] * 0.5 + r2[1] * 0.5);
  const arvore = pasto * grupo * ss(0.72, 0.84, r2[2]);
  const lim = 16 + 30 * r2[0] + 10 * r3[1];
  const cota = 3 + 2.6 * r3[1] + 1.2 * r2[3];
  const fimAreia = Math.max(ss(lim - 1.5, lim + 2.5, e.agua), ss(cota - 0.35, cota + 0.35, e.h));
  const faixaR = e.mar * fimAreia * (1 - ss(lim + 40 + 45 * r2[0], lim + 80 + 60 * r2[0], e.agua));
  const frente = (1 - ss(lim + 3, lim + 22, e.agua)) * (1 - ss(cota + 0.5, cota + 4, e.h));
  const restinga = faixaR * (1 - urb) * (1 - copa) * step(0.6, e.h) * (1 - ss(9, 16, e.h)) * (1 - ss(0.25, 0.45, incl))
    * ss(0.4, 0.56, r3[0] * 0.45 + r2[3] * 0.35 + r3[2] * 0.2 + frente * 0.12 - (1 - faixaR) * 0.25);
  const ciliar = (1 - e.mar) * ss(4, 9, e.agua) * (1 - ss(22 + 20 * r3[0], 40 + 30 * r3[0], e.agua)) * (1 - urb) * (1 - copa) * step(0.2, e.h)
    * ss(0.35, 0.6, r3[2] * 0.6 + r2[1] * 0.5);
  const encosta = e.mar * (1 - ss(70, 170, e.agua)) * ss(0.1, 0.26, incl) * (1 - urb) * (1 - ss(0.2, 0.55, costao)) * (1 - paredao) * step(0.5, e.h);
  const sec = ss(0.42, 0.78, r1[0] * 0.6 + r2[1] * 0.4);
  return { copa, moita, arvore, restinga, ciliar, encosta, sec, costao, paredao };
}

/** Altura do dossel que o vértice do chão levanta numa copa de pico alt (COPA_ALTURA de terreno.js, 18 m). */
export const alturaDossel = (alt, copaAltura = 18) => copaAltura * (0.72 + 0.5 * alt);

/**
 * Espécie e tamanho da árvore numa copa da rede grande, pelo que o chão pinta ali (null se o chão não pinta árvore).
 * h: hash da copa (0 a 1) para sortear a espécie.
 * @returns {{ especie: number, altura: number, largura: number } | null}
 */
export function arvoreDaCopa(copa, v, h) {
  const nota = Math.max(v.copa, v.arvore * 0.92, v.ciliar * 0.88, v.encosta * 0.8);
  if (nota < 0.5) return null;
  const fechada = v.copa >= 0.5;
  const altura = alturaDossel(copa.alt) * (fechada ? 1 : 0.85);
  // na mata fechada as copas se encostam (o dossel é contínuo visto de cima); a solta abre mais que a pintada
  const largura = 2 * copa.raio * (fechada ? 1.45 : 1.2);
  let especie;
  if (v.copa >= 0.5) {
    if (v.sec > 0.5 && h < 0.35) especie = ESPECIE.embauba;
    else if (v.sec > 0.5) especie = ESPECIE.mata3;
    else if (copa.sub === 0 && copa.alt > 0.72) especie = ESPECIE.mata1;
    else especie = h < 0.2 ? ESPECIE.mata3 : ESPECIE.mata2;
  } else if (v.ciliar * 0.88 >= Math.max(v.arvore * 0.92, v.encosta * 0.8)) especie = h < 0.3 ? ESPECIE.embauba : h < 0.55 ? ESPECIE.mata3 : ESPECIE.mata2;
  else if (v.encosta * 0.8 > v.arvore * 0.92) especie = h < 0.3 ? ESPECIE.embauba : ESPECIE.mata3;
  else especie = h < 0.25 ? ESPECIE.mata1 : ESPECIE.mata2;
  // a estreita e a embaúba não abrem 20 m de copa: a largura segue a espécie
  const P = ESPECIES[especie];
  const prop = P.largura / P.altura;
  return { especie, altura, largura: limitar(largura, altura * prop * 0.75, altura * prop * 1.6) };
}

/**
 * Moita (ou arvoreta da restinga) numa copa da rede pequena, ou null. Debaixo da mata fechada, o sub-bosque: arvoretas
 * de 2,5 a 5 m em parte das copas (h: hash da copa, 0 a 1), que fecham o chão entre os troncos.
 */
export function moitaDaCopa(copa, v, h = 0) {
  if (v.copa >= 0.5) {
    if (h > 0.4) return null;
    const largura = limitar(2.4 * copa.raio, 2, 5.5);
    return { especie: ESPECIE.moita, altura: limitar(largura * (0.9 + 0.4 * copa.alt), 2.5, 5), largura, restinga: false, subBosque: true };
  }
  const nota = Math.max(v.moita, v.restinga * 0.9);
  if (nota < 0.5) return null;
  const largura = limitar(2 * copa.raio, 1.4, 6);
  return { especie: ESPECIE.moita, altura: limitar(largura * (0.75 + 0.35 * copa.alt), 1.2, 4.2), largura, restinga: v.restinga > v.moita };
}

// ------------------------------------------------------------------------------------------------ oficina

/**
 * Gerador da oficina (tipo 'arvores'): { especie?, lod?, semente? } devolve a malha pedida, ou todas as espécies nos
 * dois LODs sem espécie. Uma malha por espécie e LOD, com material 'arvore:<id>:<lod>'.
 */
export function gerarParaOficina(dados = {}) {
  const lista = dados.especie == null ? gerarTodas(dados.semente ?? 1) : [gerarArvore(dados.especie, dados.lod ?? 0, dados.semente ?? 1)];
  return {
    malhas: lista.map((m) => ({ material: `arvore:${m.especie}:${m.lod}`, atributos: m.atributos, indices: m.indices, medidas: m.medidas, tris: m.tris })),
  };
}

export function registrar({ registrarGeradorOficina } = {}) {
  registrarGeradorOficina?.('arvores', gerarParaOficina);
}
