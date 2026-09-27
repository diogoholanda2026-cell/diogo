// Espelho da simulação para o render e a UI (seção 2.4, D19, D21): formatos, convenções e invariantes testáveis.
//
// Regras de leitura:
//  - O render e a UI só leem, e RELEEM o espelho a cada quadro: nenhuma parcela guarda referência a uma coluna entre
//    quadros, porque uma tabela que cresce troca os arrays (o diário marca `realocado`).
//  - idx é a vaga da tabela (denso, estável enquanto vivo, reaproveitado só depois de liberado; a menor vaga livre sai
//    primeiro). ref = idx + ger * 2^20 identifica a coisa entre quadros (a UI guarda refs, o render usa idx).
//  - Cada tabela expõe n (maior idx vivo mais 1): nada vivo em idx >= n.
//  - Posições em Float64 na simulação (metros; x leste, z sul, y para cima; norte em -z; origem no centro do mapa).
//
// Convenções:
//  - Prédio: x, z é o CENTRO da planta; w é a FRENTE (ao longo da via) e d o fundo, em metros; rot é a rotação em torno
//    de +y do three (Object3D.rotation.y); com rot = 0 a frente olha para +z; y é a cota da plataforma.
//  - Aresta: p são os 4 pontos de controle da Bézier cúbica, P0 no nó a e P3 no nó b; corte são t0 e t1 em PARÂMETRO
//    da curva (não em comprimento); mao = 1 é o sentido a para b. Caminhos de entrega: idx para a -> b, ~idx para b -> a.
//  - Célula: x, z é o centro; ang é a direção para onde a frente da célula olha (para a via), na convenção de rot;
//    lado = +1 é à DIREITA de a -> b olhando de cima, na direção (-dz, dx); linha 0 é a que encosta na via.
//  - Grades (altura, floresta, recursos, valor, ar, ruído): amostra [j * n + i] em x = ox + i * passo, z = oz + j * passo.
//
// Invariantes (conferirEspelho, rodam na cidade sintética e no save do robô): prédio dentro das suas células (cada
// célula dentro da planta e, no prédio de zona, w/8 x d/8 células); frente virada para a aresta da célula da linha 0;
// t0 < t1 em [0, 1]; P0 e P3 nos nós; cota da plataforma igual a alturaEm no centro; nada vivo em idx >= n; célula
// ocupada aponta para prédio vivo e vice-versa.
import { congelar, atan2, cos, hipot, sen } from '../comum/util.js';
import { maisPerto, tangente } from '../comum/bezier.js';
import { pontoNoRetangulo } from '../comum/vetor.js';
import { CELULA, TIPO_PREDIO } from './flags.js';

/** Base das refs: ref = idx + ger * REF_BASE (número seguro no JS até ger 65.535). */
export const REF_BASE = 1048576;
export const refDe = (idx, ger) => idx + ger * REF_BASE;
export const idxDaRef = (ref) => ref % REF_BASE;
export const gerDaRef = (ref) => Math.floor(ref / REF_BASE);

/** Tetos de vagas no M1 (D19). */
export const TETOS = congelar({ predios: 262144, arestas: 65536, nos: 65536, celulas: 524288 });

/**
 * Colunas das tabelas do espelho criadas pela F0 (a spec de cada coluna: [Tipo, por linha, padrão]).
 * Além das colunas da seção 2.4, a F0 acrescenta: nos.lig (até 6 arestas ligadas, -1 vazio), arestas.arco (tabela de
 * arco de 17 amostras, comprimento acumulado em t = k/16) e celulas.coluna (posição ao longo do bloco).
 * As parcelas donas podem acrescentar colunas próprias com tabela.novaColuna(nome, Tipo, por, padrao).
 */
export const COLUNAS = congelar({
  nos: {
    x: [Float64Array], y: [Float64Array], z: [Float64Array], grau: [Uint8Array], raio: [Float32Array],
    lig: [Int32Array, 6, -1],
  },
  arestas: {
    a: [Int32Array, 1, -1], b: [Int32Array, 1, -1], tipo: [Uint8Array], p: [Float64Array, 8], y: [Float32Array, 2],
    comp: [Float32Array], corte: [Float32Array, 2], mao: [Int8Array], flags: [Uint16Array], idade: [Uint32Array],
    arco: [Float32Array, 17],
  },
  celulas: {
    x: [Float32Array], z: [Float32Array], y: [Float32Array], ang: [Float32Array], zona: [Uint8Array], estado: [Uint8Array],
    predio: [Int32Array, 1, -1], aresta: [Int32Array, 1, -1], lado: [Int8Array], linha: [Uint8Array], coluna: [Uint16Array],
  },
  predios: {
    tipo: [Uint8Array], modelo: [Uint16Array], zona: [Uint8Array], x: [Float64Array], z: [Float64Array], y: [Float32Array],
    rot: [Float32Array], w: [Uint16Array], d: [Uint16Array], nivel: [Uint8Array], estilo: [Uint8Array], semente: [Uint32Array],
    flags: [Uint32Array], obraIni: [Uint32Array], obraFim: [Uint32Array], cor: [Uint8Array], moradores: [Uint16Array],
    empregos: [Uint16Array],
  },
});

/** Linhas de 8 m de fundo por bloco de zona e medida da célula. */
export const CELULA_M = 8;
export const LINHAS_BLOCO = 6;

/** Fases da obra pelo progresso (tique + frac - obraIni) / (obraFim - obraIni), calculado no vértice (2.4). */
export const FASES_OBRA = congelar([
  { id: 'canteiro', ate: 0.1 },
  { id: 'fundacao', ate: 0.25 },
  { id: 'estrutura', ate: 0.6 },
  { id: 'fechamento', ate: 1 },
]);

/** Progresso de uma obra, 0 a 1. */
export function progressoObra(tique, frac, ini, fim) {
  if (fim <= ini) return 1;
  const p = (tique + frac - ini) / (fim - ini);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/** Índice da fase (0 a 3) de um progresso. */
export const faseObra = (p) => FASES_OBRA.findIndex((f) => p <= f.ate);

/** Direção da frente de uma rotação (convenção do three). */
export const frenteDe = (rot) => [sen(rot), cos(rot)];

/**
 * ang de uma célula do lado `lado` de uma aresta cuja tangente é (dx, dz): a frente olha para a via.
 * @example angDaCelula(1, 0, +1) // a célula fica ao sul da via e olha para o norte: Math.PI
 */
export function angDaCelula(dx, dz, lado) {
  const c = hipot(dx, dz) || 1;
  // lateral do lado = lado * (-dz, dx); a frente olha de volta para a via
  const fx = (lado * dz) / c;
  const fz = (-lado * dx) / c;
  return atan2(fx, fz);
}

/** Domínios do diário (sim.mudancas.desde). */
export const DOMINIOS_DIARIO = congelar({
  tabelas: ['nos', 'arestas', 'celulas', 'predios'],
  retangulos: ['terreno', 'floresta'],
  sinais: ['ladrilhos', 'fluxos', 'entregas', 'arcologia', 'holding'],
  grades: ['valor', 'ar', 'ruido'],
});

/** Tamanho do anel do diário (marcas). */
export const ANEL_DIARIO = 65536;

/**
 * Formato de sim.mudancas.desde(v) (v < 0 pede tudo):
 * { versao,
 *   tudo: { terreno, floresta, vias, celulas, predios },  // true: v saiu do anel, houve troca geral (carregar) ou v é
 *                                                         // de outra simulação (acima da versão atual); refaça o domínio
 *   realocado: ['predios', ...],                          // tabelas que cresceram: arrays novos
 *   n: { nos, arestas, celulas, predios },
 *   terreno: [[x0, z0, x1, z1]], floresta: [[...]],       // retângulos sujos em metros
 *   nos: Int32Array, arestas: Int32Array, celulas: Int32Array, predios: Int32Array,   // idx tocados, sem repetição
 *   ladrilhos, fluxos, entregas, arcologia, holding: boolean, grades: ['valor', 'ar', 'ruido'] }
 */
export const FORMATO_DESDE = 'ver comentário acima';

/**
 * Esqueleto de sim.espelho (seção 2.4). Os domínios preenchem o que é deles; null = ainda não publicado.
 * Estrutura:
 *   versao, tempo: { tique, frac, velocidade, mult, mes, ano, fracMes, hora, fase, diaDoAno, clima: { nuvens, vento } },
 *   mapa: { semente, tam: 8192, origem: [-4096, -4096], latitude: -23.5, norteAz, nivelMar: 0 },
 *   terreno: { n: 1025, passo: 8, origem, altura: Float32Array, agua: Uint8Array, rios: [...], lagoas: [...] },
 *   floresta: { n: 1024, passo: 8, origem, dens: Uint8Array },
 *   recursos: { n: 256, passo: 32, origem, rocha, areia, argila, calcario, fertil, subterranea },
 *   ladrilhos: { n: 16, estado: Uint8Array(256), preco: Float64Array(256) }, areas: [{ id, nome, contorno }],
 *   vias: { nos, arestas }, celulas, predios (tabelas com as COLUNAS acima),
 *   fluxos: { versao, ida, volta, vel: Float32Array } | null, entregas: [{ id, item, n, caminho: Int32Array, tIni, tFim, visual }],
 *   arcologia: { plano, etapas: [{ id, parte, estado, fase, progresso }] },
 *   grades: { valor: { n: 256, passo: 32, dados }, ar: { n: 128, passo: 64, dados }, ruido: { ... } },
 *   holding: { nome, cor }, partida: { modo }
 */
export function espelhoVazio(semente = '') {
  return {
    versao: 0,
    tempo: null,
    mapa: { semente, tam: 8192, origem: [-4096, -4096], latitude: -23.5, norteAz: 0, nivelMar: 0 },
    terreno: null,
    floresta: null,
    recursos: null,
    ladrilhos: null,
    areas: [],
    vias: { nos: null, arestas: null },
    celulas: null,
    predios: null,
    fluxos: null,
    entregas: [],
    arcologia: { plano: null, etapas: [] },
    grades: { valor: null, ar: null, ruido: null },
    holding: null,
    partida: null,
  };
}

/**
 * Confere os invariantes do espelho. Devolve a lista de erros (vazia se tudo certo), no máximo `max`.
 * @param {object} esp sim.espelho
 * @param {{ alturaEm?: (x: number, z: number) => number, tolCota?: number, folga?: number, cosFrente?: number, max?: number }} op
 */
export function conferirEspelho(esp, op = {}) {
  const { alturaEm = null, tolCota = 0.01, folga = 1.5, cosFrente = cos((15 * Math.PI) / 180), max = 50 } = op;
  const erros = [];
  const erro = (regra, idx, detalhe) => {
    if (erros.length < max) erros.push({ regra, idx, detalhe });
  };
  const tabelas = { nos: esp.vias?.nos, arestas: esp.vias?.arestas, celulas: esp.celulas, predios: esp.predios };
  for (const [nome, t] of Object.entries(tabelas)) {
    if (!t) continue;
    if (t.n > t.cap) erro('n', -1, `${nome}: n ${t.n} > cap ${t.cap}`);
    for (let i = t.n; i < t.cap; i++) if (t.viva[i]) erro('n', i, `${nome}: viva acima de n`);
    if (t.n > 0 && !t.viva[t.n - 1]) erro('n', t.n - 1, `${nome}: n não é o maior vivo mais 1`);
  }
  const { nos, arestas, celulas, predios } = tabelas;
  const q = [0, 0];
  if (nos && arestas) {
    for (let e = 0; e < arestas.n; e++) {
      if (!arestas.viva[e]) continue;
      const a = arestas.a[e];
      const b = arestas.b[e];
      if (a < 0 || b < 0 || !nos.viva[a] || !nos.viva[b]) {
        erro('orfa', e, 'aresta com nó morto');
        continue;
      }
      const o = 8 * e;
      const P = arestas.p;
      if (Math.abs(P[o] - nos.x[a]) > 1e-6 || Math.abs(P[o + 1] - nos.z[a]) > 1e-6) erro('p0', e, 'P0 fora do nó a');
      if (Math.abs(P[o + 6] - nos.x[b]) > 1e-6 || Math.abs(P[o + 7] - nos.z[b]) > 1e-6) erro('p3', e, 'P3 fora do nó b');
      const t0 = arestas.corte[2 * e];
      const t1 = arestas.corte[2 * e + 1];
      if (!(t0 >= 0 && t1 <= 1 && t0 < t1)) erro('corte', e, `t0 ${t0} t1 ${t1}`);
    }
  }
  if (celulas && arestas) {
    const mp = { t: 0, d: 0, x: 0, z: 0 };
    for (let c = 0; c < celulas.n; c++) {
      if (!celulas.viva[c]) continue;
      const e = celulas.aresta[c];
      if (e < 0 || !arestas.viva[e]) {
        erro('celulaOrfa', c, 'célula sem aresta viva');
        continue;
      }
      if (celulas.estado[c] === CELULA.INVALIDA) continue;
      const cx = celulas.x[c];
      const cz = celulas.z[c];
      maisPerto(arestas.p, cx, cz, 8 * e, mp);
      tangente(arestas.p, mp.t, q, 8 * e);
      const lado = celulas.lado[c];
      const lx = -q[1] * lado;
      const lz = q[0] * lado;
      if ((cx - mp.x) * lx + (cz - mp.z) * lz <= 0) erro('lado', c, 'célula do lado errado da via');
      const fx = sen(celulas.ang[c]);
      const fz = cos(celulas.ang[c]);
      if (fx * (mp.x - cx) + fz * (mp.z - cz) <= 0) erro('angCelula', c, 'frente da célula não olha para a via');
    }
  }
  if (predios) {
    for (let i = 0; i < predios.n; i++) {
      if (!predios.viva[i]) continue;
      if (alturaEm && Math.abs(predios.y[i] - alturaEm(predios.x[i], predios.z[i])) > tolCota) {
        erro('cota', i, `y ${predios.y[i]} fora de alturaEm`);
      }
    }
  }
  if (celulas && predios) {
    const porPredio = new Int32Array(predios.n);
    for (let c = 0; c < celulas.n; c++) {
      if (!celulas.viva[c]) continue;
      const i = celulas.predio[c];
      const ocupada = celulas.estado[c] === CELULA.OCUPADA;
      if (i < 0) {
        if (ocupada) erro('ocupada', c, 'célula ocupada sem prédio');
        continue;
      }
      if (!ocupada) erro('ocupada', c, 'célula com prédio não está ocupada');
      if (i >= predios.n || !predios.viva[i]) {
        erro('predioMorto', c, 'célula aponta para prédio morto');
        continue;
      }
      porPredio[i]++;
      if (!pontoNoRetangulo(celulas.x[c], celulas.z[c], predios.x[i], predios.z[i], predios.rot[i], predios.w[i], predios.d[i], folga)) {
        erro('dentro', i, `célula ${c} fora da planta do prédio`);
      }
      if (celulas.linha[c] === 0) {
        const r = predios.rot[i];
        const a = celulas.ang[c];
        if (sen(r) * sen(a) + cos(r) * cos(a) < cosFrente) erro('frente', i, `frente longe da via da célula ${c}`);
      }
    }
    // prédio de zona sobre células: a planta w x d cobre exatamente as suas células de 8 m (nem maior, nem menor)
    for (let i = 0; i < predios.n; i++) {
      if (!predios.viva[i] || !porPredio[i] || predios.tipo[i] !== TIPO_PREDIO.ZONA) continue;
      const esperado = Math.round(predios.w[i] / CELULA_M) * Math.round(predios.d[i] / CELULA_M);
      if (porPredio[i] !== esperado) erro('celulas', i, `${porPredio[i]} células para uma planta de ${predios.w[i]} x ${predios.d[i]} m`);
    }
  }
  return erros;
}
