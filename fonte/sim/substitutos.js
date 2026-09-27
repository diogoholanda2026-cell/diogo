// Substitutos do contrato interno (2.10) para as parcelas testarem sozinhas: holding e progresso simples, agregados e
// economia de faz de conta, terreno plano, ladrilhos iniciais, o aplainar de referência (D5) e os substitutos de
// células (S1b) e de crescimento (S2a) que a cidade sintética usa. Cada parcela dona troca o seu por
// sim.implementar(servico, funcoes) ou registrando o comando e a consulta de verdade.
import { copiaJson, smoothstep, atan2, cos, sen } from '../comum/util.js';
import { HORA } from '../comum/relogio.js';
import { amostrasNoRetangulo } from '../comum/altura.js';
import { distSegmento, distPoligono, pontoNoRetangulo } from '../comum/vetor.js';
import { ponto, direcao, tDoArco } from '../comum/bezier.js';
import { ORDEM, FORMA } from '../contratos/interno.js';
import { CELULA, TIPO_PREDIO, LADRILHO } from '../contratos/flags.js';
import { CELULA_M, LINHAS_BLOCO, angDaCelula } from '../contratos/espelho.js';
import { CAIXA_INICIAL } from '../data/economia.js';
import { VIAS, VIAS_ORDEM } from '../data/vias.js';
import { PREDIOS, PREDIOS_ORDEM } from '../data/predios.js';
import { ZONAS_ORDEM } from '../data/zonas.js';
import { somarPredios } from './agregados.js';

/** Marcos de partida da D51 (S3a é a dona dos de verdade, em data/marcos.js). */
export const MARCOS_SUBSTITUTO = Object.freeze([
  { n: 0, nome: 'Canteiro', xp: 0 },
  { n: 1, nome: 'Povoado', xp: 400 },
  { n: 2, nome: 'Vila', xp: 1500 },
  { n: 3, nome: 'Vila Próspera', xp: 3500 },
  { n: 4, nome: 'Cidade Nova', xp: 8000 },
  { n: 5, nome: 'Cidade', xp: 15000 },
  { n: 6, nome: 'Cidade Grande', xp: 25000 },
  { n: 7, nome: 'Polo Regional', xp: 38000, requisito: 'torre.e4' },
]);

/** Cor padrão da Holding (champanhe). */
export const COR_HOLDING = '#c9a86a';

/** Instala os substitutos numa simulação nova (o núcleo chama no construtor). */
export function instalarSubstitutos(sim) {
  const hj = sim.registrarJson('holding', { caixa: CAIXA_INICIAL, entregas: 0, efeitos: {} });
  const ident = sim.registrarJson('identidade', { nome: 'Held', cor: COR_HOLDING });
  const partida = sim.registrarJson('partida', { modo: 'normal' });
  const prog = sim.registrarJson('progresso', { xp: 0, motivos: {} });
  sim.espelho.holding = ident;
  sim.espelho.partida = partida;
  const requisitos = {};

  // D41 já na F0: o caixa nunca fica abaixo de 0
  sim.holding = {
    caixa: () => hj.caixa,
    pagar(valor, categoria) {
      if (!(valor >= 0) || !Number.isFinite(valor)) return false;
      if (hj.caixa < valor) return false;
      hj.caixa -= valor;
      return true;
    },
    receber(valor, categoria) {
      if (valor > 0 && Number.isFinite(valor)) hj.caixa += valor;
    },
    comprarParaObra(ref, nivel, materiais) {
      return { espera: false };
    },
    entregar({ item, n, origem, destino, aoChegar = null, visual = false } = {}) {
      const id = ++hj.entregas;
      if (aoChegar) aoChegar({ id, item, n, origem, destino });
      return id;
    },
    efeito(id, dados) {
      hj.efeitos[id] = copiaJson(dados);
    },
  };

  sim.progresso = {
    xp(n, motivo = 'outro') {
      if (!(n > 0)) return;
      prog.xp += n;
      prog.motivos[motivo] = (prog.motivos[motivo] ?? 0) + n;
    },
    liberado: (id) => true,
    requisito(marco, fn) {
      requisitos[marco] = fn;
    },
    marco() {
      let m = MARCOS_SUBSTITUTO[0];
      for (const x of MARCOS_SUBSTITUTO) if (prog.xp >= x.xp) m = x;
      const prox = MARCOS_SUBSTITUTO[m.n + 1] ?? null;
      return { n: m.n, nome: m.nome, xp: prog.xp, xpIni: m.xp, xpProx: prox ? prox.xp : null, requisito: prox?.requisito ?? null };
    },
  };

  sim.registrarComando('holding.identidade', (s, args) => definirIdentidade(s, args), { substituto: 'holding' });

  sim.registrarSistema(20, 19, (s) => somarPredios(s), 1, { nome: 'agregados (substituto)', ordem: ORDEM.agregados, substituto: 'agregados' });
  sim.registrarSistema(1, 0, sistemaEconomia, 1, { nome: 'economia (substituto)', ordem: ORDEM.economia, substituto: 'economia' });
  sim.registrarValidador('caixa', () => (hj.caixa >= 0 ? [] : [`caixa negativo (${hj.caixa})`]));
}

/**
 * Nome, cor e modo da Holding (nova partida). Devolve { ok: true } ou o código 'valor'. O modo livre não volta ao
 * normal (D56).
 */
export function definirIdentidade(sim, { nome, cor, modo } = {}) {
  const ident = sim.json.identidade;
  const partida = sim.json.partida;
  if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 32) return 'valor';
  if (typeof cor !== 'string' || !/^#[0-9a-f]{6}$/i.test(cor)) return 'valor';
  if (modo !== undefined && modo !== null && modo !== 'normal' && modo !== 'livre') return 'valor';
  if (partida.modo === 'livre' && modo === 'normal') return 'valor';
  ident.nome = nome.trim();
  ident.cor = cor.toLowerCase();
  if (modo) partida.modo = modo;
  sim.mudancas.marcar('holding');
  return { ok: true };
}

/** Economia de faz de conta: contribuição dos moradores (moradores x tarifa por hora) e custos registrados. */
function sistemaEconomia(sim) {
  const ag = sim.agregados;
  const receita = (ag.populacao * ag.tarifa) / HORA;
  if (receita > 0) sim.holding.receber(receita, 'moradores');
  const custo = sim.custos.total() / HORA;
  if (custo > 0) sim.holding.pagar(Math.min(custo, sim.holding.caixa()), 'manutencao'); // paga a fração possível (D41)
}

// ------------------------------------------------------------------------------------------------ mundo

/** Terreno plano (substituto da S1a): grade 1025² a 8 m, cota constante, sem água. */
export function terrenoPlano({ n = 1025, passo = 8, origem = [-4096, -4096], cota = 0 } = {}) {
  const altura = new Float32Array(n * n);
  if (cota) altura.fill(cota);
  return { n, passo, origem: [...origem], altura, agua: new Uint8Array(n * n), rios: [], lagoas: [] };
}

/** Ladrilhos iniciais (D3): 4 x 4 da Holding (6 a 9 nos dois eixos), vizinhos compráveis a 40 mil. */
export function ladrilhosIniciais({ ini = 6, fim = 9 } = {}) {
  const estado = new Uint8Array(256);
  const preco = new Float64Array(256);
  for (let j = ini; j <= fim; j++) for (let i = ini; i <= fim; i++) estado[j * 16 + i] = LADRILHO.HOLDING;
  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 16; i++) {
      if (estado[j * 16 + i]) continue;
      const viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => {
        const a = i + di;
        const b = j + dj;
        return a >= 0 && b >= 0 && a < 16 && b < 16 && estado[b * 16 + a] === LADRILHO.HOLDING;
      });
      if (viz) {
        estado[j * 16 + i] = LADRILHO.COMPRAVEL;
        preco[j * 16 + i] = 40000;
      }
    }
  }
  return { n: 16, estado, preco };
}

/**
 * Distância de (x, z) ao núcleo de uma forma e a cota do núcleo no ponto mais perto.
 * @returns {{ d: number, cota: number }}
 */
export function distanciaForma(f, x, z, out = { d: 0, cota: 0 }) {
  if (f.tipo === 'via') {
    const e = f.eixo;
    let melhor = Infinity;
    let cota = e[2];
    const o = { d: 0, t: 0 };
    for (let k = 0; k + 5 < e.length; k += 3) {
      distSegmento(x, z, e[k], e[k + 1], e[k + 3], e[k + 4], o);
      if (o.d < melhor) {
        melhor = o.d;
        cota = e[k + 2] + (e[k + 5] - e[k + 2]) * o.t;
      }
    }
    out.d = Math.max(0, melhor - f.meiaLargura);
    out.cota = cota;
  } else {
    out.d = distPoligono(x, z, f.contorno);
    out.cota = f.cota;
  }
  return out;
}

/**
 * Aplainar de REFERÊNCIA (D5), pura e comutativa: cada amostra do retângulo sai só da grade base e do conjunto de
 * formas que a tocam. Vale a forma de menor distância ao núcleo (empate: tipo, depois ref, depois cota); até a faixa
 * plana de 8 m vale a cota dela; depois a base volta por smoothstep em 16 m. A implementação de verdade é da S1a.
 * @param {{ n: number, passo: number, origem: number[], altura: Float32Array }} base
 * @param {object[]} formas  normalizadas (sim.formas.lista() ou tocando())
 * @param {number[]} ret     [x0, z0, x1, z1] em metros
 * @param {Float32Array} saida  grade n * n onde escrever (só as amostras do retângulo mudam)
 */
export function aplainarReferencia(base, formas, ret, saida) {
  const { n, passo } = base;
  const [ox, oz] = base.origem;
  const [i0, j0, i1, j1] = amostrasNoRetangulo(n, passo, ox, oz, ret[0], ret[1], ret[2], ret[3]);
  const alcance = FORMA.faixaPlana + FORMA.transicao;
  const cand = formas.filter((f) => {
    const c = f.caixa;
    return c[0] - alcance <= ret[2] && c[2] + alcance >= ret[0] && c[1] - alcance <= ret[3] && c[3] + alcance >= ret[1];
  });
  const o = { d: 0, cota: 0 };
  for (let j = j0; j <= j1; j++) {
    const z = oz + j * passo;
    for (let i = i0; i <= i1; i++) {
      const x = ox + i * passo;
      const k = j * n + i;
      let md = Infinity;
      let mt = 0;
      let mr = 0;
      let mc = 0;
      for (const f of cand) {
        const c = f.caixa;
        if (x < c[0] - alcance || x > c[2] + alcance || z < c[1] - alcance || z > c[3] + alcance) continue;
        distanciaForma(f, x, z, o);
        if (o.d >= alcance) continue;
        const t = FORMA.ordemTipo[f.tipo];
        if (o.d < md || (o.d === md && (t < mt || (t === mt && (f.ref < mr || (f.ref === mr && o.cota < mc)))))) {
          md = o.d;
          mt = t;
          mr = f.ref;
          mc = o.cota;
        }
      }
      const hb = base.altura[k];
      if (md === Infinity) saida[k] = hb;
      else if (md <= FORMA.faixaPlana) saida[k] = mc;
      else saida[k] = mc + (hb - mc) * smoothstep(FORMA.faixaPlana, alcance, md);
    }
  }
  return saida;
}

// ------------------------------------------------------------------------------------------------ células e prédios

/**
 * Substituto dos blocos da S1b: aloca as células de 8 m dos dois lados de uma aresta com calçada (colunas ao longo do
 * arco útil, entre os cortes menos 4 m em cada ponta, e 6 linhas de fundo). `valida(x, z, c)` decide se a célula nasce
 * livre ou inválida. Devolve { lados: { '1': [[idx por linha] por coluna], '-1': ... } }.
 */
export function celulasDaAresta(sim, e, { valida = null, linhas = LINHAS_BLOCO } = {}) {
  const A = sim.tabelas.arestas;
  const C = sim.tabelas.celulas;
  const tipo = VIAS[VIAS_ORDEM[A.tipo[e]]];
  const meia = tipo.largura / 2;
  const tab = A.arco.subarray(17 * e, 17 * e + 17);
  const comp = tab[16];
  const s0 = tDoArcoInv(tab, A.corte[2 * e]) + 4;
  const s1 = tDoArcoInv(tab, A.corte[2 * e + 1]) - 4;
  const ncol = Math.max(0, Math.floor((s1 - s0) / CELULA_M));
  const sobra = (s1 - s0 - ncol * CELULA_M) / 2;
  const q = [0, 0];
  const d = [0, 0];
  const lados = { 1: [], '-1': [] };
  if (ncol <= 0 || comp <= 0) return { lados, ncol: 0 };
  for (const lado of [1, -1]) {
    for (let col = 0; col < ncol; col++) {
      const s = s0 + sobra + CELULA_M / 2 + col * CELULA_M;
      const t = tDoArco(tab, s);
      ponto(A.p, t, q, 8 * e);
      direcao(A.p, t, d, 8 * e);
      const lx = -d[1] * lado;
      const lz = d[0] * lado;
      const ang = angDaCelula(d[0], d[1], lado);
      const coluna = [];
      for (let r = 0; r < linhas; r++) {
        const off = meia + CELULA_M / 2 + r * CELULA_M;
        const x = q[0] + lx * off;
        const z = q[1] + lz * off;
        const c = C.alocar();
        if (c < 0) throw new Error('células: tabela cheia');
        C.x[c] = x;
        C.z[c] = z;
        C.y[c] = sim.alturaEm(x, z);
        C.ang[c] = ang;
        C.aresta[c] = e;
        C.lado[c] = lado;
        C.linha[c] = r;
        C.coluna[c] = col;
        C.estado[c] = valida && !valida(x, z, c) ? CELULA.INVALIDA : CELULA.LIVRE;
        C.marcar(c);
        coluna.push(c);
      }
      lados[lado].push(coluna);
    }
  }
  return { lados, ncol };
}

// comprimento de arco no parâmetro t pela tabela (inverso de tDoArco)
function tDoArcoInv(tab, t) {
  const n = tab.length - 1;
  if (t <= 0) return 0;
  if (t >= 1) return tab[n];
  const k = Math.min(n - 1, Math.floor(t * n));
  return tab[k] + (tab[k + 1] - tab[k]) * (t * n - k);
}

/**
 * Substituto de crescimento da S2a: põe um prédio de FRENTE para a via sobre células livres da mesma zona.
 * `celulas` são as vagas da planta (colunas x linhas, a linha 0 encosta na via). Confere que cada célula cai dentro da
 * planta (com `folga`) e que a frente fica a menos de 15 graus da frente das células da linha 0; se não, devolve -1.
 * @returns {number} idx do prédio ou -1
 */
export function crescerNaFrente(sim, celulas, { modelo, nivel = 1, estilo = 0, semente = 0, flags = 0, obraIni = 0, obraFim = 0, cor = 0, folga = 1 }) {
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const id = typeof modelo === 'number' ? PREDIOS_ORDEM[modelo] : modelo;
  const def = PREDIOS[id];
  if (!def || !celulas.length) return -1;
  const zona = C.zona[celulas[0]];
  if (!zona || ZONAS_ORDEM[zona] !== def.zona) return -1;
  let cx = 0;
  let cz = 0;
  let fx = 0;
  let fz = 0;
  const cols = new Set();
  let linhas = 0;
  for (const c of celulas) {
    if (!C.viva[c] || C.estado[c] !== CELULA.LIVRE || C.zona[c] !== zona) return -1;
    cx += C.x[c];
    cz += C.z[c];
    cols.add(C.coluna[c]);
    linhas = Math.max(linhas, C.linha[c] + 1);
    if (C.linha[c] === 0) {
      fx += sen(C.ang[c]);
      fz += cos(C.ang[c]);
    }
  }
  cx /= celulas.length;
  cz /= celulas.length;
  if (fx === 0 && fz === 0) return -1;
  const rot = atan2(fx, fz);
  const w = cols.size * CELULA_M;
  const d = linhas * CELULA_M;
  const cosMin = cos((15 * Math.PI) / 180);
  for (const c of celulas) {
    if (!pontoNoRetangulo(C.x[c], C.z[c], cx, cz, rot, w, d, folga)) return -1;
    if (C.linha[c] === 0 && sen(rot) * sen(C.ang[c]) + cos(rot) * cos(C.ang[c]) < cosMin) return -1;
  }
  const i = P.alocar();
  if (i < 0) return -1;
  const nv = def.niveis[Math.max(1, Math.min(5, nivel)) - 1];
  P.tipo[i] = TIPO_PREDIO.ZONA;
  P.modelo[i] = PREDIOS_ORDEM.indexOf(id);
  P.zona[i] = zona;
  P.x[i] = cx;
  P.z[i] = cz;
  P.y[i] = sim.alturaEm(cx, cz);
  P.rot[i] = rot;
  P.w[i] = w;
  P.d[i] = d;
  P.nivel[i] = Math.max(1, Math.min(5, nivel));
  P.estilo[i] = estilo;
  P.semente[i] = semente >>> 0;
  P.flags[i] = flags;
  P.obraIni[i] = obraIni;
  P.obraFim[i] = obraFim;
  P.cor[i] = cor;
  P.moradores[i] = nv.moradores;
  P.empregos[i] = nv.empregos.reduce((a, b) => a + b, 0);
  P.marcar(i);
  for (const c of celulas) {
    C.estado[c] = CELULA.OCUPADA;
    C.predio[c] = i;
    C.marcar(c);
  }
  return i;
}
