// Campo de alturas da cidade (desenho do render 2.5, 2.6 e 10.1; PROJETO 2.8 e a resposta 19 da crítica): o terreno
// mais o topo das peças LOD1 dos prédios (o mesmo plano da R4a, planoPredio) e dos volumes que projetam sombra própria
// sem ser instâncias (a Arcologia), numa grade que cobre o mapa: 1024² a 8 m no Média e no Leve, 2048² a 4 m no Alta e
// no Ultra. A grade vive na CPU (a colisão da câmera lê daqui, sem readPixels) e sobe para a GPU (R16F) por
// texSubImage2D só nos retângulos sujos, onde a sombra de longe e o HAO (sombraLonge.js) a leem.
//
// A textura leva também o nível 1 de uma pirâmide de máximos (cada célula é o maior das 4 do nível 0): a marcha da
// sombra de longe, com passos que crescem até 48 m, lê a célula do nível 1 de cada amostra nos passos longos e não
// pula uma torre fina, sem engordar a sombra mais que uma célula do nível 1.
//
// Cada setor de 256 m tem o seu ladrilho: a grade das peças dos prédios dele, com a sobra das peças que passam da
// borda. A grade da cidade é o máximo dos ladrilhos; um prédio que nasce refaz só o ladrilho do setor dele. O gerador
// do ladrilho é puro (alturasDoSetor): roda aqui com teto de tempo por quadro ou no worker `oficina` pelo tipo
// 'alturasCidade', quando o índice do worker registrar este módulo. Sem import do three: o módulo serve também ao
// worker; a textura sai de ctx.THREE.
//
// Publica: ctx.alturaCidade(x, z) (topo da cidade na célula, -Infinity sem prédio) e ctx.campoAlturas (grade,
// textura, versão e os retângulos que mudaram, lidos e limpos pela sombra de longe).
import { planoPredio } from '../geracao/planoPredio.js';
import { FORMAS } from '../geracao/malhaPredio.js';
import { GradeSetores, pedidoDoSetor, LADO_SETOR } from '../mundo/setores.js';
import { INT, NUM } from '../geracao/fundir.js';
import { amostrar } from '../../comum/altura.js';
import { TIPO_PREDIO } from '../../contratos/flags.js';
import { pedeTudo } from '../ponte.js';

/** Valor da célula sem prédio. */
export const VAZIO = -1e4;
/** Dilatação da peça na grade (fração da célula): a colisão e a sombra preferem a peça um pouco maior. */
export const DILATA = 0.3;
/** Tamanho da grade por perfil (células por lado sobre o mapa). */
export const LADO_CAMPO = Object.freeze({ ultra: 2048, alta: 2048, media: 1024, leve: 1024 });
/** Níveis da pirâmide de máximos na grade e na textura (a marcha lê o 0 e o 1). */
export const NIVEIS = 2;
/**
 * Lado (células) dos blocos do máximo grosso, só na CPU: o maior do campo numa região sai lendo poucos blocos. A
 * sombra de longe passa ao passe o maior da região que a marcha alcança, e a marcha para quando nada mais à frente
 * pode subir a sombra (a conta é exata: o resultado não muda).
 */
export const BLOCO = 32;
/** Na carga (ou num 'tudo'), até esta quantidade de prédios o campo sai inteiro no primeiro quadro. */
const NA_CARGA = 20000;
/** Teto de tempo por quadro (ms) para refazer ladrilhos depois da carga. */
const TETO_QUADRO = 3;

// ------------------------------------------------------------------------------------------------ meia precisão

const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);

/** Float32 para meia precisão (IEEE 754 binary16), arredondando para o mais perto. */
export function paraMeia(v) {
  _f32[0] = v;
  const x = _u32[0];
  const s = (x >>> 16) & 0x8000;
  let e = ((x >>> 23) & 0xff) - 112;
  let m = x & 0x7fffff;
  if (e <= 0) {
    if (e < -10) return s;
    m |= 0x800000;
    const t = 14 - e;
    return s | ((m + (1 << (t - 1))) >> t);
  }
  if (e >= 31) return s | 0x7c00;
  const r = s | (e << 10) | (m >> 13);
  return m & 0x1000 ? r + 1 : r;
}

// ------------------------------------------------------------------------------------------------ rasterização pura

/**
 * Peça do LOD1 na grade: retângulo (ou elipse, ou duas águas) girado, em metros do mundo. Escreve o máximo do topo
 * nas células de [i0, j0, i0 + ni, j0 + nj) do ladrilho `dados` (ni x nj), com a grade de origem (gx, gz) e passo.
 * @param {{ cx, cz, hw, hd, cg, sg, y0, y1, forma }} p  forma: índice em FORMAS
 */
export function rasterizarPeca(p, dados, i0, j0, ni, nj, gx, gz, passo) {
  const dil = DILATA * passo;
  const ex = Math.abs(p.cg) * p.hw + Math.abs(p.sg) * p.hd + dil;
  const ez = Math.abs(p.sg) * p.hw + Math.abs(p.cg) * p.hd + dil;
  const a0 = Math.max(i0, Math.floor((p.cx - ex - gx) / passo - 0.5));
  const a1 = Math.min(i0 + ni - 1, Math.ceil((p.cx + ex - gx) / passo - 0.5));
  const b0 = Math.max(j0, Math.floor((p.cz - ez - gz) / passo - 0.5));
  const b1 = Math.min(j0 + nj - 1, Math.ceil((p.cz + ez - gz) / passo - 0.5));
  const hw = p.hw + dil;
  const hd = p.hd + dil;
  const cil = p.forma === 2;
  const aguas = p.forma === 3;
  for (let j = b0; j <= b1; j++) {
    const dz = gz + (j + 0.5) * passo - p.cz;
    for (let i = a0; i <= a1; i++) {
      const dx = gx + (i + 0.5) * passo - p.cx;
      const lx = dx * p.cg - dz * p.sg;
      const lz = dx * p.sg + dz * p.cg;
      if (cil) {
        if ((lx * lx) / (hw * hw) + (lz * lz) / (hd * hd) > 1) continue;
      } else if (Math.abs(lx) > hw || Math.abs(lz) > hd) continue;
      // duas águas: a cumeeira corre ao longo de x local, no meio; o beiral fica em |z| = d/2
      const y = aguas ? p.y0 + (p.y1 - p.y0) * Math.min(1, Math.max(0, 1 - (Math.abs(lz) - dil) / Math.max(0.1, p.hd))) : p.y1;
      const k = (j - j0) * ni + (i - i0);
      if (y > dados[k]) dados[k] = y;
    }
  }
}

/** Peças LOD1 de um prédio no mundo (x, z centro do lote, y cota, rot giro), na forma de rasterizarPeca. */
export function pecasDoPredio(plano, x, y, z, rot, saida = []) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (const P of plano.pecas) {
    if (!P.lod1) continue;
    const forma = FORMAS.indexOf(P.forma1 ?? P.forma);
    if (forma < 0) continue;
    const g = rot + (P.giro ?? 0);
    saida.push({
      cx: x + P.x * c + P.z * s, cz: z - P.x * s + P.z * c, hw: P.w / 2, hd: (P.d ?? P.w) / 2,
      cg: Math.cos(g), sg: Math.sin(g), y0: y + P.y0, y1: y + P.y0 + (P.h ?? 0), forma,
    });
  }
  return saida;
}

/** Caixa [x0, z0, x1, z1] das peças (com a dilatação). */
function caixaDasPecas(pecas, dil) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of pecas) {
    const ex = Math.abs(p.cg) * p.hw + Math.abs(p.sg) * p.hd + dil;
    const ez = Math.abs(p.sg) * p.hw + Math.abs(p.cg) * p.hd + dil;
    b[0] = Math.min(b[0], p.cx - ex);
    b[1] = Math.min(b[1], p.cz - ez);
    b[2] = Math.max(b[2], p.cx + ex);
    b[3] = Math.max(b[3], p.cz + ez);
  }
  return b;
}

/** Ladrilho que cobre as peças: { i0, j0, ni, nj, grade } (VAZIO onde nada), ou vazio (ni = 0). */
export function ladrilhoDasPecas(pecas, N, passo, gx, gz) {
  if (!pecas.length) return { i0: 0, j0: 0, ni: 0, nj: 0, grade: new Float32Array(0) };
  const b = caixaDasPecas(pecas, DILATA * passo);
  const i0 = Math.max(0, Math.floor((b[0] - gx) / passo - 0.5));
  const j0 = Math.max(0, Math.floor((b[1] - gz) / passo - 0.5));
  const i1 = Math.min(N - 1, Math.ceil((b[2] - gx) / passo - 0.5));
  const j1 = Math.min(N - 1, Math.ceil((b[3] - gz) / passo - 0.5));
  const ni = Math.max(0, i1 - i0 + 1);
  const nj = Math.max(0, j1 - j0 + 1);
  const grade = new Float32Array(ni * nj).fill(VAZIO);
  for (const p of pecas) rasterizarPeca(p, grade, i0, j0, ni, nj, gx, gz, passo);
  return { i0, j0, ni, nj, grade };
}

/**
 * Gerador do tipo 'alturasCidade' (oficina, D45): o ladrilho das peças LOD1 dos prédios de um setor. Os dados são os
 * do pedido de setor da R4a (pedidoDoSetor: setor, ox, oz, n, num, ints) mais a grade { N, passo, gx, gz }.
 * @returns {{ setor: number, i0: number, j0: number, ni: number, nj: number, grade: Float32Array }}
 */
export function alturasDoSetor(dados) {
  const { n = 0, num, ints, ox = 0, oz = 0, N, passo, gx, gz } = dados;
  const pecas = [];
  for (let k = 0; k < n; k++) {
    const pk = ints[INT * k + 3];
    const plano = planoPredio({
      w: num[NUM * k + 4], d: num[NUM * k + 5], modelo: ints[INT * k + 2], semente: ints[INT * k + 1],
      nivel: pk & 15, estilo: (pk >> 4) & 15, cor: (pk >> 8) & 15, abandonado: !!((pk >> 12) & 1),
    });
    pecasDoPredio(plano, ox + num[NUM * k], num[NUM * k + 1], oz + num[NUM * k + 2], num[NUM * k + 3], pecas);
  }
  return { setor: dados.setor, ...ladrilhoDasPecas(pecas, N, passo, gx, gz) };
}

/**
 * Ladrilho de uma malha (os volumes da Arcologia): o topo dos triângulos que não são paredes, pela interpolação
 * baricêntrica no centro de cada célula, e cada vértice na célula dele (pega mastro e cantos finos).
 * @param {Float32Array} pos  posições (3 por vértice), no espaço do objeto
 * @param {ArrayLike<number> | null} indice
 * @param {ArrayLike<number>} m  matrixWorld (16, coluna maior)
 */
export function ladrilhoDaMalha(pos, indice, m, N, passo, gx, gz) {
  const nv = pos.length / 3;
  const w = new Float32Array(nv * 3);
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let v = 0; v < nv; v++) {
    const x = pos[3 * v];
    const y = pos[3 * v + 1];
    const z = pos[3 * v + 2];
    const X = m[0] * x + m[4] * y + m[8] * z + m[12];
    const Z = m[2] * x + m[6] * y + m[10] * z + m[14];
    w[3 * v] = X;
    w[3 * v + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    w[3 * v + 2] = Z;
    if (X < x0) x0 = X;
    if (X > x1) x1 = X;
    if (Z < z0) z0 = Z;
    if (Z > z1) z1 = Z;
  }
  if (!(x1 >= x0)) return { i0: 0, j0: 0, ni: 0, nj: 0, grade: new Float32Array(0) };
  const i0 = Math.max(0, Math.floor((x0 - gx) / passo - 0.5));
  const j0 = Math.max(0, Math.floor((z0 - gz) / passo - 0.5));
  const i1 = Math.min(N - 1, Math.ceil((x1 - gx) / passo - 0.5));
  const j1 = Math.min(N - 1, Math.ceil((z1 - gz) / passo - 0.5));
  const ni = Math.max(0, i1 - i0 + 1);
  const nj = Math.max(0, j1 - j0 + 1);
  const grade = new Float32Array(ni * nj).fill(VAZIO);
  const cel = (X, Z, y) => {
    const i = Math.floor((X - gx) / passo);
    const j = Math.floor((Z - gz) / passo);
    if (i < i0 || j < j0 || i > i1 || j > j1) return;
    const k = (j - j0) * ni + (i - i0);
    if (y > grade[k]) grade[k] = y;
  };
  for (let v = 0; v < nv; v++) cel(w[3 * v], w[3 * v + 2], w[3 * v + 1]);
  const nt = indice ? indice.length / 3 : nv / 3;
  const tol = 0.25 * passo;
  for (let t = 0; t < nt; t++) {
    const a = indice ? indice[3 * t] : 3 * t;
    const b = indice ? indice[3 * t + 1] : 3 * t + 1;
    const c = indice ? indice[3 * t + 2] : 3 * t + 2;
    const ax = w[3 * a];
    const az = w[3 * a + 2];
    const bx = w[3 * b];
    const bz = w[3 * b + 2];
    const cx = w[3 * c];
    const cz = w[3 * c + 2];
    const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    if (Math.abs(area) < 1e-3) continue; // parede: os vértices já marcaram as células
    const ya = w[3 * a + 1];
    const yb = w[3 * b + 1];
    const yc = w[3 * c + 1];
    const ymax = Math.max(ya, yb, yc);
    const ta0 = Math.max(i0, Math.floor((Math.min(ax, bx, cx) - gx) / passo - 0.5));
    const ta1 = Math.min(i1, Math.ceil((Math.max(ax, bx, cx) - gx) / passo - 0.5));
    const tb0 = Math.max(j0, Math.floor((Math.min(az, bz, cz) - gz) / passo - 0.5));
    const tb1 = Math.min(j1, Math.ceil((Math.max(az, bz, cz) - gz) / passo - 0.5));
    const inv = 1 / area;
    const lim = -tol / Math.sqrt(Math.abs(area));
    for (let j = tb0; j <= tb1; j++) {
      const pz = gz + (j + 0.5) * passo;
      for (let i = ta0; i <= ta1; i++) {
        const px = gx + (i + 0.5) * passo;
        const u = ((bx - px) * (cz - pz) - (cx - px) * (bz - pz)) * inv;
        const v = ((cx - px) * (az - pz) - (ax - px) * (cz - pz)) * inv;
        const s = 1 - u - v;
        if (u < lim || v < lim || s < lim) continue;
        const y = Math.min(ymax, u * ya + v * yb + s * yc);
        const k = (j - j0) * ni + (i - i0);
        if (y > grade[k]) grade[k] = y;
      }
    }
  }
  return { i0, j0, ni, nj, grade };
}

/** Une dois retângulos de células [i0, j0, i1, j1] (inclusive); null vale vazio. */
export function unirRet(a, b) {
  if (!a) return b ? b.slice() : null;
  if (!b) return a.slice();
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

const retDoLadrilho = (L) => (L && L.ni && L.nj ? [L.i0, L.j0, L.i0 + L.ni - 1, L.j0 + L.nj - 1] : null);

/** Células de um retângulo [i0, j0, i1, j1]. */
export const areaRet = (r) => (r[2] - r[0] + 1) * (r[3] - r[1] + 1);

/**
 * Junta o retângulo r à lista (muda a lista): funde com os que ele toca ou quase (a união até 1,25 vez a soma das
 * áreas) e deixa os distantes separados, para dois setores longe um do outro no mesmo quadro não sujarem a cidade
 * inteira entre eles. Acima de max retângulos, a lista vira a união de todos (não cresce sem quem a leia).
 */
export function juntarRet(lista, r, max = 16) {
  if (!r) return lista;
  let atual = r.slice();
  for (let k = 0; k < lista.length; ) {
    const u = unirRet(lista[k], atual);
    if (areaRet(u) <= 1.25 * (areaRet(lista[k]) + areaRet(atual))) {
      atual = u;
      lista.splice(k, 1);
      k = 0; // a união pode alcançar outro
    } else k++;
  }
  lista.push(atual);
  if (lista.length > max) {
    const u = lista.reduce((a, b) => unirRet(a, b), null);
    lista.length = 0;
    lista.push(u);
  }
  return lista;
}

// ------------------------------------------------------------------------------------------------ o campo

/**
 * O campo de alturas na CPU (sem three): grade da cidade, do chão e a meia precisão que sobe para a GPU. Serve ao
 * domínio e aos testes.
 */
export class Campo {
  /** @param {{ N: number, tam?: number, origem?: number[] }} op */
  constructor({ N = 1024, tam = 8192, origem = [-tam / 2, -tam / 2] } = {}) {
    this.N = N;
    this.tam = tam;
    this.passo = tam / N;
    this.gx = origem[0];
    this.gz = origem[1];
    this.cidade = new Float32Array(N * N).fill(VAZIO);
    this.chao = new Float32Array(N * N);
    this.alt = new Float32Array(N * N); // o maior entre o chão e a cidade (nível 0 da pirâmide)
    this.meia = new Uint16Array(N * N);
    // pirâmide de máximos (níveis 0 e 1): nível L com N / 2^L células por lado, em float (para a conta) e em meia
    // precisão (GPU)
    this.niveis = [{ n: N, f: this.alt, h: this.meia }];
    for (let L = 1, n = N >> 1; L < NIVEIS && n >= 1; L++, n >>= 1) this.niveis.push({ n, f: new Float32Array(n * n), h: new Uint16Array(n * n) });
    this.nb = Math.ceil(N / BLOCO);
    this.blocos = new Float32Array(this.nb * this.nb); // o maior do nível 0 em cada bloco (0 como o nível 0 antes de compor)
    this.ladrilhos = new Map(); // chave -> ladrilho
    this.versao = 0;
    this.sujosNiveis = []; // [nível, retângulo] do último compor (para subir à GPU)
  }

  /** O chão (terreno, com o mar na cota dele) nas células [i0..i1] x [j0..j1]. */
  refazerChao(T, nivelMar, [i0, j0, i1, j1]) {
    const { N, passo, gx, gz, chao } = this;
    for (let j = j0; j <= j1; j++) {
      const z = gz + (j + 0.5) * passo;
      for (let i = i0; i <= i1; i++) {
        const x = gx + (i + 0.5) * passo;
        const h = T ? amostrar(T.altura, T.n, T.passo, T.origem[0], T.origem[1], x, z) : 0;
        chao[j * N + i] = h > nivelMar ? h : nivelMar;
      }
    }
  }

  /** Troca (ou tira, com null) um ladrilho; devolve o retângulo que muda. */
  trocarLadrilho(chave, L) {
    const velho = this.ladrilhos.get(chave);
    if (L && L.ni && L.nj) this.ladrilhos.set(chave, L);
    else this.ladrilhos.delete(chave);
    return unirRet(retDoLadrilho(velho), retDoLadrilho(L));
  }

  /** Recompõe a cidade (máximo dos ladrilhos) e a meia precisão (máximo com o chão) no retângulo. */
  compor([i0, j0, i1, j1]) {
    const { N, cidade, chao, meia } = this;
    for (let j = j0; j <= j1; j++) cidade.fill(VAZIO, j * N + i0, j * N + i1 + 1);
    for (const L of this.ladrilhos.values()) {
      const a0 = Math.max(i0, L.i0);
      const a1 = Math.min(i1, L.i0 + L.ni - 1);
      const b0 = Math.max(j0, L.j0);
      const b1 = Math.min(j1, L.j0 + L.nj - 1);
      if (a0 > a1 || b0 > b1) continue;
      for (let j = b0; j <= b1; j++) {
        const o = (j - L.j0) * L.ni - L.i0;
        const r = j * N;
        for (let i = a0; i <= a1; i++) {
          const v = L.grade[o + i];
          if (v > cidade[r + i]) cidade[r + i] = v;
        }
      }
    }
    const alt = this.alt;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * N + i;
        const h = cidade[k] > chao[k] ? cidade[k] : chao[k];
        alt[k] = h;
        meia[k] = paraMeia(h);
      }
    }
    // a pirâmide de máximos no retângulo, nível a nível
    this.sujosNiveis = [[0, [i0, j0, i1, j1]]];
    let r = [i0, j0, i1, j1];
    for (let L = 1; L < this.niveis.length; L++) {
      const A = this.niveis[L - 1];
      const B = this.niveis[L];
      r = [r[0] >> 1, r[1] >> 1, r[2] >> 1, r[3] >> 1];
      for (let j = r[1]; j <= r[3]; j++) {
        for (let i = r[0]; i <= r[2]; i++) {
          const a = 2 * j * A.n + 2 * i;
          const m = Math.max(A.f[a], A.f[a + 1], A.f[a + A.n], A.f[a + A.n + 1]);
          B.f[j * B.n + i] = m;
          B.h[j * B.n + i] = paraMeia(m);
        }
      }
      this.sujosNiveis.push([L, r]);
    }
    // o máximo grosso dos blocos que o retângulo toca
    const { nb, blocos } = this;
    for (let bj = Math.floor(j0 / BLOCO); bj <= Math.floor(j1 / BLOCO); bj++) {
      for (let bi = Math.floor(i0 / BLOCO); bi <= Math.floor(i1 / BLOCO); bi++) {
        let m = VAZIO;
        const a1 = Math.min(N, (bi + 1) * BLOCO);
        const b1 = Math.min(N, (bj + 1) * BLOCO);
        for (let j = bj * BLOCO; j < b1; j++) {
          for (let k = j * N + bi * BLOCO, fim = j * N + a1; k < fim; k++) if (alt[k] > m) m = alt[k];
        }
        blocos[bj * nb + bi] = m;
      }
    }
    this.versao++;
  }

  /** O maior do campo (chão e cidade) nas células [i0..i1] x [j0..j1], pelos blocos que as cobrem (por cima). */
  maximoNaRegiao(i0, j0, i1, j1) {
    const { N, nb, blocos } = this;
    const b0 = Math.floor(Math.max(0, i0) / BLOCO);
    const b1 = Math.floor(Math.min(N - 1, i1) / BLOCO);
    const c0 = Math.floor(Math.max(0, j0) / BLOCO);
    const c1 = Math.floor(Math.min(N - 1, j1) / BLOCO);
    let m = VAZIO;
    for (let bj = c0; bj <= c1; bj++) for (let bi = b0; bi <= b1; bi++) if (blocos[bj * nb + bi] > m) m = blocos[bj * nb + bi];
    return m;
  }

  /** Maior altura da célula (i, j) do nível L da pirâmide (a mesma leitura do texelFetch da GPU). */
  maximo(L, i, j) {
    const V = this.niveis[Math.min(L, this.niveis.length - 1)];
    const a = Math.min(V.n - 1, Math.max(0, i));
    const b = Math.min(V.n - 1, Math.max(0, j));
    return V.f[b * V.n + a];
  }


  /** Célula (i, j) de um ponto do mundo. */
  celula(x, z) {
    return [Math.floor((x - this.gx) / this.passo), Math.floor((z - this.gz) / this.passo)];
  }

  /** Retângulo de células que cobre o retângulo do mundo [x0, z0, x1, z1] (com uma célula de folga). */
  retDoMundo(x0, z0, x1, z1) {
    const N = this.N;
    return [
      Math.max(0, Math.floor((x0 - this.gx) / this.passo) - 1), Math.max(0, Math.floor((z0 - this.gz) / this.passo) - 1),
      Math.min(N - 1, Math.floor((x1 - this.gx) / this.passo) + 1), Math.min(N - 1, Math.floor((z1 - this.gz) / this.passo) + 1),
    ];
  }

  /**
   * Topo da cidade em (x, z) para a colisão: o valor da célula do ponto (as peças já entram dilatadas), -Infinity sem
   * prédio. A célula, e não o maior dos vizinhos: a câmera no meio de uma rua de 16 m não sobe para o telhado.
   */
  topo(x, z) {
    const { N, passo, gx, gz, cidade } = this;
    const i = Math.floor((x - gx) / passo);
    const j = Math.floor((z - gz) / passo);
    if (i < 0 || j < 0 || i >= N || j >= N) return -Infinity;
    const v = cidade[j * N + i];
    return v > VAZIO / 2 ? v : -Infinity;
  }

  /** Altura do campo (chão e cidade) em (x, z), bilinear entre os centros das células. */
  altura(x, z) {
    const { N, passo, gx, gz, cidade, chao } = this;
    const h = (i, j) => {
      const a = Math.min(N - 1, Math.max(0, i));
      const b = Math.min(N - 1, Math.max(0, j));
      const k = b * N + a;
      return cidade[k] > chao[k] ? cidade[k] : chao[k];
    };
    const fx = (x - gx) / passo - 0.5;
    const fz = (z - gz) / passo - 0.5;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    return (h(i, j) * (1 - tx) + h(i + 1, j) * tx) * (1 - tz) + (h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx) * tz;
  }
}

// ------------------------------------------------------------------------------------------------ envio à GPU

/**
 * Sobe os retângulos de cada nível (campo.sujosNiveis) de uma DataTexture R16F com a pirâmide nos mipmaps, por
 * texSubImage2D e pelo estado do three (a textura precisa já estar na GPU; senão sobe inteira no próximo uso).
 */
export function subirRetangulos(renderer, textura, sujos) {
  const props = renderer.properties.get(textura);
  const tex = props?.__webglTexture;
  if (!tex || textura.needsUpdate) {
    textura.needsUpdate = true;
    return false;
  }
  const gl = renderer.getContext();
  const st = renderer.state;
  st.bindTexture(gl.TEXTURE_2D, tex);
  st.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  st.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  st.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
  for (const [L, [i0, j0, i1, j1]] of sujos) {
    const m = textura.mipmaps[L];
    st.pixelStorei(gl.UNPACK_ROW_LENGTH, m.width);
    st.pixelStorei(gl.UNPACK_SKIP_PIXELS, i0);
    st.pixelStorei(gl.UNPACK_SKIP_ROWS, j0);
    st.texSubImage2D(gl.TEXTURE_2D, L, i0, j0, i1 - i0 + 1, j1 - j0 + 1, gl.RED, gl.HALF_FLOAT, m.data);
  }
  st.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
  st.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
  st.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  st.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  return true;
}

// ------------------------------------------------------------------------------------------------ domínio

function criarDominio(ctx) {
  const THREE = ctx.THREE;
  const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const esp0 = ctx.sim?.espelho;
  const tam = esp0?.mapa?.tam ?? 8192;
  const origem = esp0?.mapa?.origem ?? [-tam / 2, -tam / 2];
  const setoresGrade = new GradeSetores({ tam, origem });
  let campo = null;
  let textura = null;
  // setores: s -> lista de idx; setorDe[idx]; sujos
  const lista = new Map();
  let setorDe = new Int32Array(0);
  const sujos = new Set();
  let chaoSujo = [];
  let carga = true;
  let iniciado = false; // o chão já foi feito inteiro
  let comTerreno = false; // e com o terreno (sem ele, o chão é o nível do mar)
  let comPredios = false; // a lista dos prédios já foi feita inteira (o espelho pode trazê-los depois do terreno)
  const malhas = new Map(); // fonte (Mesh que projeta) -> assinatura
  let pendentes = []; // retângulos a compor (os distantes separados)
  const publicado = { retangulos: [], versao: 0 };

  function montar() {
    const N = LADO_CAMPO[ctx.perfil?.id] ?? 1024;
    campo = new Campo({ N, tam, origem });
    textura?.dispose();
    textura = new THREE.DataTexture(campo.meia, N, N, THREE.RedFormat, THREE.HalfFloatType);
    textura.mipmaps = campo.niveis.map((v) => ({ data: v.h, width: v.n, height: v.n }));
    textura.minFilter = THREE.LinearMipmapNearestFilter;
    textura.magFilter = THREE.LinearFilter;
    textura.wrapS = textura.wrapT = THREE.ClampToEdgeWrapping;
    textura.generateMipmaps = false;
    textura.name = 'campo:alturas';
    textura.needsUpdate = true;
    for (const s of lista.keys()) sujos.add(s);
    malhas.clear();
    pendentes = [];
    chaoSujo = [[0, 0, N - 1, N - 1]];
    carga = true;
    Object.assign(publicado, { N, passo: campo.passo, ox: campo.gx, oz: campo.gz, tam, textura, campo });
    publicado.retangulos = [[0, 0, N - 1, N - 1]];
    publicado.versao++;
  }
  montar();
  ctx.campoAlturas = publicado;
  ctx.alturaCidade = (x, z) => campo.topo(x, z);

  const marcar = (r) => {
    if (r) juntarRet(pendentes, r);
  };

  function crescer(cap) {
    if (setorDe.length >= cap) return;
    const a = new Int32Array(cap).fill(-1);
    a.set(setorDe);
    setorDe = a;
  }

  function aplicar(d, esp) {
    const T = esp.terreno;
    if (!iniciado || pedeTudo(d, 'terreno') || (T && !comTerreno)) chaoSujo = [[0, 0, campo.N - 1, campo.N - 1]];
    else if (d.terreno?.length) for (const [x0, z0, x1, z1] of d.terreno) chaoSujo.push(campo.retDoMundo(x0, z0, x1, z1));
    iniciado = true;
    comTerreno ||= !!T;
    const P = esp.predios;
    if (!P || !T) return;
    crescer(P.cap);
    const tudo = !comPredios || pedeTudo(d, 'predios');
    comPredios = true;
    if (tudo) {
      for (const s of lista.keys()) sujos.add(s);
      lista.clear();
      setorDe.fill(-1);
      for (let i = 0; i < P.n; i++) {
        if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
        const s = setoresGrade.indice(P.x[i], P.z[i]);
        if (s < 0) continue;
        let l = lista.get(s);
        if (!l) lista.set(s, (l = []));
        l.push(i);
        setorDe[i] = s;
        sujos.add(s);
      }
      carga = true;
      return;
    }
    if (!d.predios?.length) return;
    for (const i of d.predios) {
      const velho = setorDe[i];
      const vivo = i < P.n && P.viva[i] && P.tipo[i] === TIPO_PREDIO.ZONA;
      const novo = vivo ? setoresGrade.indice(P.x[i], P.z[i]) : -1;
      if (velho >= 0 && velho !== novo) {
        const l = lista.get(velho);
        const k = l ? l.indexOf(i) : -1;
        if (k >= 0) l.splice(k, 1);
        sujos.add(velho);
      }
      if (novo >= 0) {
        if (velho !== novo) {
          let l = lista.get(novo);
          if (!l) lista.set(novo, (l = []));
          l.push(i);
          l.sort((a, b) => a - b);
        }
        sujos.add(novo);
      }
      setorDe[i] = novo;
    }
  }

  /** Refaz o ladrilho de um setor (aqui mesmo: o gerador puro, sem worker). */
  function refazerSetor(s) {
    const P = ctx.sim.espelho.predios;
    const l = lista.get(s) ?? [];
    let L = null;
    if (l.length && P) {
      const { dados } = pedidoDoSetor(P, l, setoresGrade, s, false);
      L = alturasDoSetor({ ...dados, N: campo.N, passo: campo.passo, gx: campo.gx, gz: campo.gz });
    }
    marcar(campo.trocarLadrilho(`s${s}`, L));
  }

  /** Volumes da cena de sombra que não são instâncias (a Arcologia): ladrilho quando mudam. */
  function conferirMalhas() {
    const vivos = new Set();
    for (const par of ctx.sombra?.pares ?? []) {
      const f = par.fonte;
      if (!f || f.isInstancedMesh || !f.geometry?.attributes?.position) continue;
      vivos.add(f);
      f.updateMatrixWorld();
      const e = f.matrixWorld.elements;
      let h = f.geometry.id * 131 + (f.geometry.attributes.position.version ?? 0);
      for (let k = 0; k < 16; k++) h = (h * 31 + Math.round(e[k] * 64)) | 0;
      if (malhas.get(f) === h) continue;
      malhas.set(f, h);
      const g = f.geometry;
      const L = ladrilhoDaMalha(g.attributes.position.array, g.index?.array ?? null, e, campo.N, campo.passo, campo.gx, campo.gz);
      marcar(campo.trocarLadrilho(`m${f.id}`, L));
    }
    for (const f of [...malhas.keys()]) {
      if (vivos.has(f)) continue;
      malhas.delete(f);
      marcar(campo.trocarLadrilho(`m${f.id}`, null));
    }
  }

  /** Ordem dos setores sujos: os mais perto do alvo da câmera primeiro. */
  function ordemSujos() {
    const a = ctx.cameraApi?.estado?.() ?? { x: 0, z: 0 };
    return [...sujos].map((s) => {
      const [x0, z0] = setoresGrade.canto(s);
      return { s, d: Math.hypot(x0 + LADO_SETOR / 2 - a.x, z0 + LADO_SETOR / 2 - a.z) };
    }).sort((p, q) => p.d - q.d);
  }

  /** Processa o que está sujo: chão, setores (com teto de tempo), malhas; compõe e sobe à GPU. */
  function passo({ semTeto = false } = {}) {
    const esp = ctx.sim?.espelho;
    const T = esp?.terreno ?? null;
    const nivel = Number.isFinite(esp?.mapa?.nivelMar) ? esp.mapa.nivelMar : 0;
    for (const r of chaoSujo) {
      campo.refazerChao(T, nivel, r);
      marcar(r);
    }
    chaoSujo = [];
    if (sujos.size) {
      const total = [...lista.values()].reduce((a, l) => a + l.length, 0);
      const livre = semTeto || (carga && total <= NA_CARGA);
      const t0 = agora();
      for (const { s } of ordemSujos()) {
        refazerSetor(s);
        sujos.delete(s);
        if (!livre && agora() - t0 > TETO_QUADRO) break;
      }
      if (!sujos.size) carga = false;
    }
    conferirMalhas();
    if (!pendentes.length) return;
    const rets = pendentes;
    pendentes = [];
    // compõe cada retângulo (a pirâmide de um vizinho refeita depois lê o nível 0 já novo) e sobe os pedaços; acima
    // de 1/4 do mapa sobe tudo de uma vez
    const niveis = [];
    let area = 0;
    for (const r of rets) {
      campo.compor(r);
      niveis.push(...campo.sujosNiveis);
      area += areaRet(r);
      juntarRet(publicado.retangulos, r, 32);
    }
    if (area > campo.N * campo.N * 0.25 || !subirRetangulos(ctx.renderer, textura, niveis)) textura.needsUpdate = true;
    publicado.versao++;
  }

  const desligar = ctx.ouvir?.('qualidade', () => {
    if ((LADO_CAMPO[ctx.perfil?.id] ?? 1024) !== campo.N) montar();
  });

  return {
    nome: 'campoAlturas',
    aplicar(d, esp) {
      aplicar(d, esp);
    },
    quadro() {
      passo();
    },
    /** Termina todo o trabalho pendente agora (cenas e capturas). */
    preparar() {
      if (!iniciado && ctx.sim?.mudancas) aplicar(ctx.sim.mudancas.desde(-1), ctx.sim.espelho);
      passo({ semTeto: true });
      return { setores: lista.size, sujos: sujos.size, versao: campo.versao };
    },
    get campo() {
      return campo;
    },
    get textura() {
      return textura;
    },
    descartar() {
      desligar?.();
      textura?.dispose();
      if (ctx.campoAlturas === publicado) ctx.campoAlturas = null;
      ctx.alturaCidade = null;
    },
  };
}

/**
 * Registro: o domínio 'campoAlturas' no render e, no worker `oficina` (quando o índice dele incluir este módulo), o
 * gerador 'alturasCidade'.
 */
export function registrar(api) {
  api.registrarDominio?.('campoAlturas', criarDominio);
  api.registrarGeradorOficina?.('alturasCidade', alturasDoSetor);
}
