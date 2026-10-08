// Nascimento, obra, níveis 1 a 5 e abandono dos prédios zoneados (dona: S2a; seções 6.5 a 6.7 do desenho da
// simulação, D42, D48 e D54).
//
// Nascimento: um acumulador por zona soma demanda / 100 x taxa por tique; cada unidade é uma tentativa, até 3 por tique
// e 60 obras de nascimento abertas. A tentativa sorteia frentes livres da zona (célula da linha 0, livre e pintada) e
// fica com a de maior valor do terreno de 3; abre a largura até onde as colunas livres da mesma zona deixam, escolhe no
// catálogo entre os maiores modelos que cabem e o prédio nasce em obra, de frente para a via, com a plataforma no
// aplainar. Sem modelo que caiba, a frente fica sem espaço por 5 rodadas. A obra compra os materiais pela Holding
// (sim.holding.comprarParaObra, D48): se ela manda esperar, a obra fica no canteiro com o aviso de falta de material.
//
// Por rodada, em 20 fatias: moradores chegam (cidadaos.js), estudam, o bem-estar anda, o trabalho conta a ocupação; o
// prédio ganha pontos de nível (valor do terreno e bem-estar ou ocupação) e, com os requisitos do nível seguinte, abre
// uma obra curta que compra os materiais e troca o nível; com problema (sem água ou sem energia na rede do prédio,
// bem-estar abaixo de 20, menos de 30% das vagas ou dos clientes) o contador sobe: aviso âmbar aos 3 min de jogo,
// vermelho aos 6, abandono aos 10 (D42). A rua sem canos (terra, D52) não abandona: tira bem-estar e trava o nível. O abandonado sai quando o problema some (o lote volta a nascer pela demanda) ou na hora, se a zona dele foi
// pintada por outra.
import { RODADA } from '../../comum/relogio.js';
import { cantosRetangulo } from '../../comum/vetor.js';
import { CELULA, PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { ORDEM } from '../../contratos/interno.js';
import { ZONAS, ZONAS_ORDEM, REQUISITOS_NIVEL } from '../../data/zonas.js';
import { PREDIOS, modelosDaZona, nivelDoModelo } from '../../data/predios.js';
import { SERVICOS, SERVICOS_ORDEM } from '../../data/servicos.js';
import { crescerNaFrente } from '../substitutos.js';
import { celulasDaAresta } from './blocos.js';
import {
  prepararCidade, trans, familiaDe, tipoDoPredio, tirarPredio, AV, ABANDONO, acessoDe, registrarPartePredio, produtorDeRede,
  viaComRede,
} from '../predios.js';
import { encher, educar, ocupacaoDe } from '../cidadaos.js';
import { atualizarBemEstar, calcularBemEstar, BEM } from '../bemestar.js';
import { coberturaPredio, distanciaTipo, atualizarServico } from '../servicos.js';
import { temOferta, naRede, RECURSOS_REDE } from '../redes.js';
import { valorEm, zonaAtiva } from './demanda.js';

/** Ritmo do crescimento (seção 6.5; durações em tiques). (calibrar) */
export const CRESCIMENTO = Object.freeze({
  maxPorTique: 3, maxObras: 60, torneio: 3, semEspaco: 5 * RODADA, tentativas: 4,
  obraBase: 45, obraPorAndar: 10, obraNivelBase: 30, obraNivelPorAndar: 4, esperaMaterial: 2000,
  pontos: { base: 2, valor: 4, bem: 4 }, pontosPorNivel: 100,
  bemMinimo: 20, bemVolta: 25, ocupacaoMinima: 0.3, clientesMinimo: 0.3,
});

const andaresMedios = (nv) => (nv ? (nv.andares[0] + nv.andares[1]) / 2 : 1);
const duracaoObra = (nv) => Math.round(CRESCIMENTO.obraBase + CRESCIMENTO.obraPorAndar * andaresMedios(nv));
const duracaoNivel = (nv) => Math.round(CRESCIMENTO.obraNivelBase + CRESCIMENTO.obraNivelPorAndar * andaresMedios(nv));

// ------------------------------------------------------------------------------------------------ frentes livres

const BLOCO = 256; // células por bloco da contagem

/** Candidata: célula da linha 0, viva, livre e pintada com uma zona. Devolve a zona (0 = não). */
function zonaCandidata(C, c) {
  if (c >= C.n || !C.viva[c] || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) return 0;
  return C.zona[c];
}

/**
 * Frentes livres por zona, em bits por célula com a contagem por bloco de 256: sortear a r-ésima é rápido e a ordem é
 * a dos índices (o mesmo resultado no Node, no navegador e depois de carregar).
 */
function garantirFrentes(sim) {
  const t = trans(sim);
  const C = sim.tabelas.celulas;
  const nz = ZONAS_ORDEM.length;
  const palavras = Math.ceil(C.cap / 32);
  const blocos = Math.ceil(C.cap / BLOCO);
  let f = t.cand;
  if (!f || f.palavras < palavras || t.candSujo) {
    f = { palavras, blocos, bits: [], cont: [], total: new Int32Array(nz), zonaDe: new Uint8Array(C.cap) };
    for (let z = 0; z < nz; z++) {
      f.bits.push(new Uint32Array(palavras));
      f.cont.push(new Int32Array(blocos));
    }
    for (let c = 0; c < C.n; c++) {
      const z = zonaCandidata(C, c);
      if (z) ligarBit(f, c, z);
    }
    t.cand = f;
    t.candSujo = false;
    for (const c of t.celSujas) t.celMarca[c] = 0;
    t.celSujas.length = 0;
    return f;
  }
  for (const c of t.celSujas) {
    t.celMarca[c] = 0;
    if (c >= f.zonaDe.length) continue;
    const velha = f.zonaDe[c];
    const nova = zonaCandidata(C, c);
    if (velha === nova) continue;
    if (velha) desligarBit(f, c, velha);
    if (nova) ligarBit(f, c, nova);
  }
  t.celSujas.length = 0;
  return f;
}

function ligarBit(f, c, z) {
  f.bits[z][c >>> 5] |= 1 << (c & 31);
  f.cont[z][Math.floor(c / BLOCO)]++;
  f.total[z]++;
  f.zonaDe[c] = z;
}

function desligarBit(f, c, z) {
  f.bits[z][c >>> 5] &= ~(1 << (c & 31));
  f.cont[z][Math.floor(c / BLOCO)]--;
  f.total[z]--;
  f.zonaDe[c] = 0;
}

/** A r-ésima frente livre da zona z, na ordem dos índices (-1 se não há). */
function frenteNumero(f, z, r) {
  if (r < 0 || r >= f.total[z]) return -1;
  const cont = f.cont[z];
  let b = 0;
  while (b < f.blocos && r >= cont[b]) r -= cont[b++];
  if (b >= f.blocos) return -1;
  const bits = f.bits[z];
  for (let w = (b * BLOCO) >>> 5; w < ((b + 1) * BLOCO) >>> 5 && w < bits.length; w++) {
    let x = bits[w];
    while (x) {
      const k = 31 - Math.clz32(x & -x);
      if (r === 0) return w * 32 + k;
      r--;
      x &= x - 1;
    }
  }
  return -1;
}

/** Até `max` frentes livres da zona z, espalhadas pela ordem dos índices (amostra determinística). */
export function amostraDeFrentes(sim, z, max) {
  const f = garantirFrentes(sim);
  const tot = f.total[z] ?? 0;
  const out = [];
  if (!tot) return out;
  const k = Math.min(max, tot);
  for (let q = 0; q < k; q++) {
    const c = frenteNumero(f, z, Math.floor((q * tot) / k));
    if (c >= 0) out.push(c);
  }
  return out;
}

/** Número de frentes livres de cada zona (testes e a tela Cidade). */
export function frentesLivres(sim) {
  const f = garantirFrentes(sim);
  const out = {};
  for (let z = 1; z < ZONAS_ORDEM.length; z++) out[ZONAS_ORDEM[z]] = f.total[z];
  return out;
}

// ------------------------------------------------------------------------------------------------ nascer

/** Mapa coluna -> células por linha do bloco (aresta e, lado) da célula c0. */
function blocoDe(sim, c0) {
  const C = sim.tabelas.celulas;
  const e = C.aresta[c0];
  const lado = C.lado[c0];
  const col = new Map();
  for (const c of celulasDaAresta(sim, e)) {
    if (C.lado[c] !== lado) continue;
    let l = col.get(C.coluna[c]);
    if (!l) col.set(C.coluna[c], (l = []));
    l[C.linha[c]] = c;
  }
  return col;
}

/** Fundo livre (linhas seguidas a partir da 0) da coluna para a zona z. */
function fundoLivre(C, linhas, z) {
  let n = 0;
  while (n < linhas.length) {
    const c = linhas[n];
    if (c === undefined || !C.viva[c] || C.estado[c] !== CELULA.LIVRE || C.zona[c] !== z) break;
    n++;
  }
  return n;
}

/**
 * Tenta um prédio na frente c0 (zona z): devolve o idx do prédio novo ou -1. Escolhe entre os maiores modelos da zona
 * que cabem (área de pelo menos metade da maior que cabe), pela semente do crescimento.
 */
export function nascerNaFrente(sim, c0, z, rng) {
  const C = sim.tabelas.celulas;
  const P = sim.tabelas.predios;
  const id = ZONAS_ORDEM[z];
  const col = blocoDe(sim, c0);
  const k0 = C.coluna[c0];
  const fundo = new Map();
  const fundoDe = (k) => {
    if (!fundo.has(k)) fundo.set(k, col.has(k) ? fundoLivre(C, col.get(k), z) : 0);
    return fundo.get(k);
  };
  if (!fundoDe(k0)) return -1;
  let kL = k0;
  let kR = k0;
  while (fundoDe(kL - 1) > 0 && k0 - kL < 8) kL--;
  while (fundoDe(kR + 1) > 0 && kR - k0 < 8) kR++;
  // janelas que cabem por modelo: [modelo, início]
  const cabem = [];
  for (const m of modelosDaZona(id)) {
    const [w, d] = PREDIOS[m].planta;
    for (let s = Math.max(kL, k0 - w + 1); s <= Math.min(k0, kR - w + 1); s++) {
      let ok = true;
      for (let k = s; k < s + w && ok; k++) ok = fundoDe(k) >= d;
      if (ok) {
        cabem.push([m, s]);
        break;
      }
    }
  }
  if (!cabem.length) return -1;
  const area = (m) => PREDIOS[m].planta[0] * PREDIOS[m].planta[1];
  const maior = Math.max(...cabem.map(([m]) => area(m)));
  const bons = cabem.filter(([m]) => area(m) * 2 >= maior);
  const ordem = rng.embaralhar(bons.map((_, k) => k));
  const T = sim.tique;
  for (const k of ordem) {
    const [m, s] = bons[k];
    const [w, d] = PREDIOS[m].planta;
    const cels = [];
    for (let q = s; q < s + w; q++) for (let r = 0; r < d; r++) cels.push(col.get(q)[r]);
    const nv = nivelDoModelo(m, 1);
    const dur = duracaoObra(nv);
    const i = crescerNaFrente(sim, cels, {
      modelo: m, nivel: 1, estilo: rng.int(0, 3), semente: rng.u32(), flags: PREDIO.OBRA, obraIni: T, obraFim: T + dur,
    });
    if (i < 0) continue;
    estreiaDoPredio(sim, i, nv, dur);
    return i;
  }
  return -1;
}

/** Acertos de um prédio de zona que acabou de nascer em obra: vazio, cota em centímetros, plataforma e materiais. */
function estreiaDoPredio(sim, i, nv, dur) {
  const P = sim.tabelas.predios;
  P.moradores[i] = 0;
  P.empregos[i] = 0;
  P.y[i] = Math.floor(P.y[i] * 100) / 100;
  const ref = P.ref(i);
  sim.formas.registrar({ tipo: 'plataforma', ref, contorno: cantosRetangulo(P.x[i], P.z[i], P.rot[i], P.w[i], P.d[i]), cota: P.y[i] });
  comprarMateriais(sim, i, 1, nv, dur);
}

/** Compra os materiais da obra (nível n) pela Holding; se manda esperar, a obra fica parada no canteiro. */
function comprarMateriais(sim, i, n, nv, dur) {
  const P = sim.tabelas.predios;
  const T = sim.tique;
  const r = sim.holding.comprarParaObra(P.ref(i), n, { ...(nv?.materiais ?? {}) }) ?? { espera: false };
  if (r.espera) {
    P.flags[i] |= PREDIO.SEM_MATERIAL;
    segurarCanteiro(P, i, T);
  } else {
    P.flags[i] &= ~PREDIO.SEM_MATERIAL;
    P.obraIni[i] = T;
    P.obraFim[i] = T + dur;
  }
  P.marcar(i);
}

// a obra parada fica no canteiro (o progresso calculado no vértice anda devagar e volta a cada rodada)
function segurarCanteiro(P, i, T) {
  const D = CRESCIMENTO.esperaMaterial;
  P.obraIni[i] = Math.max(0, T - Math.round(0.05 * D));
  P.obraFim[i] = P.obraIni[i] + D;
}

// ------------------------------------------------------------------------------------------------ obras e nascimento

/** Todo tique: obras que terminam, obras paradas que voltam e os nascimentos pela demanda. */
export function sistemaCrescimento(sim) {
  const P = sim.tabelas.predios;
  const j = sim.json.cidade;
  const T = sim.tique;
  let abertas = 0;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || !(P.flags[i] & PREDIO.OBRA)) continue;
    if (P.flags[i] & PREDIO.SEM_MATERIAL) {
      // tenta de novo uma vez por rodada, espalhado pelos tiques
      if ((T + i) % RODADA === 0) retomarObra(sim, i);
      else if (T >= P.obraFim[i] - 10) segurarCanteiro(P, i, T);
    } else if (T >= P.obraFim[i]) {
      terminarObra(sim, i);
      continue;
    }
    if (P.tipo[i] === TIPO_PREDIO.ZONA && !(P.flags[i] & PREDIO.OBRA_NIVEL)) abertas++;
  }
  // nascimentos
  const f = garantirFrentes(sim);
  const rng = sim.rng('crescimento');
  let feitos = 0;
  for (let z = 1; z < ZONAS_ORDEM.length; z++) {
    const id = ZONAS_ORDEM[z];
    if (!zonaAtiva(sim, id)) {
      j.acum[id] = 0;
      continue;
    }
    const dem = j.demanda[id] ?? 0;
    let a = (j.acum[id] ?? 0) + (dem / 100) * ZONAS[id].taxa;
    if (!f.total[z]) a = Math.min(a, 1);
    while (a >= 1 && feitos < CRESCIMENTO.maxPorTique && abertas < CRESCIMENTO.maxObras) {
      a -= 1;
      if (tentar(sim, f, z, rng) >= 0) {
        feitos++;
        abertas++;
      }
    }
    j.acum[id] = Math.min(a, 3);
  }
  // as frentes sem espaço vencidas saem do registro
  if (T % RODADA === 7) {
    for (const k of Object.keys(j.semEspaco)) if (j.semEspaco[k] <= T) delete j.semEspaco[k];
  }
}

/**
 * Uma tentativa de nascimento na zona z: torneio de frentes pelo valor do terreno; a frente onde nenhum modelo cabe
 * (a ponta da quadra, o fundo raso) fica sem espaço por 5 rodadas e o torneio repete, até CRESCIMENTO.tentativas vezes
 * (C1a: sem isso, numa quadra de 112 m com as pontas livres a maior parte das tentativas morria na ponta e a zona com
 * demanda e lugar não nascia).
 */
function tentar(sim, f, z, rng) {
  const C = sim.tabelas.celulas;
  const j = sim.json.cidade;
  const T = sim.tique;
  const def = ZONAS[ZONAS_ORDEM[z]];
  for (let t = 0; t < CRESCIMENTO.tentativas; t++) {
    let melhor = -1;
    let mv = -Infinity;
    for (let k = 0; k < CRESCIMENTO.torneio; k++) {
      const c = frenteNumero(f, z, rng.int(0, f.total[z] - 1));
      if (c < 0 || (j.semEspaco[c] ?? 0) > T) continue;
      const val = valorEm(sim, C.x[c], C.z[c]);
      if (val < def.valor.min) continue; // a zona cara só nasce no terreno que vale o mínimo dela
      const v = val * (1 + (def.valor.peso < 0 ? -0.5 : 0.5)) + bonusPerto(sim, z, C.x[c], C.z[c]);
      if (v > mv) {
        mv = v;
        melhor = c;
      }
    }
    if (melhor < 0) return -1;
    const i = nascerNaFrente(sim, melhor, z, rng);
    if (i >= 0) return i;
    j.semEspaco[melhor] = T + CRESCIMENTO.semEspaco;
  }
  return -1;
}

/** Bônus de lugar dos efeitos de área com demanda para a zona (X1b: torre.e3 puxa a residencial média em 1,5 km). */
function bonusPerto(sim, z, x, zz) {
  const id = ZONAS_ORDEM[z];
  const ef = sim.json.cidade.efeitos;
  let b = 0;
  for (const k of Object.keys(ef).sort()) {
    const e = ef[k];
    const v = e.demanda?.[id];
    if (!v || !e.raio || !Number.isFinite(e.x)) continue;
    const dx = x - e.x;
    const dz = zz - e.z;
    if (dx * dx + dz * dz <= e.raio * e.raio) b += 10 * v;
  }
  return b;
}

/** Obra parada por material: tenta comprar de novo. */
function retomarObra(sim, i) {
  const P = sim.tabelas.predios;
  const k = tipoDoPredio(sim, i);
  if (k.tipo !== 'zona') {
    P.flags[i] &= ~PREDIO.SEM_MATERIAL;
    P.marcar(i);
    return;
  }
  const nv = k.nv;
  const dur = P.flags[i] & PREDIO.OBRA_NIVEL ? duracaoNivel(nv) : duracaoObra(nv);
  comprarMateriais(sim, i, P.nivel[i], nv, dur);
}

/** Fim de obra: o prédio funciona (nascimento: chegam os primeiros moradores; nível: evento predioNivel). */
export function terminarObra(sim, i) {
  const P = sim.tabelas.predios;
  const nivel = !!(P.flags[i] & PREDIO.OBRA_NIVEL);
  P.flags[i] &= ~(PREDIO.OBRA | PREDIO.OBRA_NIVEL | PREDIO.SEM_MATERIAL);
  P.marcar(i);
  const ref = P.ref(i);
  if (P.tipo[i] === TIPO_PREDIO.ZONA) {
    if (familiaDe(sim, i) === 'res') {
      if (!nivel) encher(sim, i, sim.agregados.demanda.R);
      P.bemEstar[i] = calcularBemEstar(sim, i);
    } else {
      P.empregos[i] = Math.round(ocupacaoDe(sim, i).ocupadas);
    }
    // a obra de um prédio de zona movido (MOV2) usa a reforma, mas o nível não mudou: sem o evento
    const movida = !!sim.json.mover?.zona?.[ref];
    if (movida) delete sim.json.mover.zona[ref];
    if (nivel && !movida) sim.emitir('predioNivel', { ref, nivel: P.nivel[i] });
  } else {
    const t = trans(sim);
    t.servSujo = true;
    t.redesSujas = true;
    if (P.tipo[i] === TIPO_PREDIO.SERVICO) atualizarServico(sim, i);
  }
  sim.emitir('obraFim', { ref });
}

// ------------------------------------------------------------------------------------------------ rodada por prédio

const RAC = { e: -1, s: 0 };

/** Os requisitos do nível n estão cumpridos? Devolve a lista do que falta (vazia = pode subir). */
export function faltaParaNivel(sim, i, n) {
  const P = sim.tabelas.predios;
  const req = REQUISITOS_NIVEL[n];
  const falta = [];
  if (!req) return n > 5 ? ['maximo'] : falta;
  if (req.redes) {
    if (P.flags[i] & PREDIO.SEM_AGUA) falta.push('agua');
    if (P.flags[i] & PREDIO.SEM_ENERGIA) falta.push('energia');
  }
  for (const cat of req.servicos ?? []) if (coberturaPredio(sim, i, cat) <= 0) falta.push(cat);
  if (req.valor && valorEm(sim, P.x[i], P.z[i]) < req.valor) falta.push('valor');
  const res = familiaDe(sim, i) === 'res';
  if (res && req.bemEstar && P.bemEstar[i] < req.bemEstar) falta.push('bemEstar');
  if (!res && req.ocupacao && ocupacaoDe(sim, i).frac < req.ocupacao) falta.push('ocupacao');
  return falta;
}

/** Abre a obra de subir do prédio i ao nível seguinte. */
function subirNivel(sim, i) {
  const P = sim.tabelas.predios;
  const n = P.nivel[i] + 1;
  P.nivel[i] = n;
  P.pontos[i] = 0;
  P.flags[i] |= PREDIO.OBRA | PREDIO.OBRA_NIVEL;
  const nv = nivelDoModelo(P.modelo[i], n);
  comprarMateriais(sim, i, n, nv, duracaoNivel(nv));
}

/** Abandona o prédio i (D42): sem gente, cinza; sai na hora se a zona dele foi pintada por outra. */
function abandonar(sim, i) {
  const P = sim.tabelas.predios;
  const ref = P.ref(i);
  P.flags[i] = (P.flags[i] | PREDIO.ABANDONADO) & ~(PREDIO.OBRA | PREDIO.OBRA_NIVEL | PREDIO.SEM_MATERIAL);
  P.moradores[i] = 0;
  P.empregos[i] = 0;
  P.problema[i] = 0;
  P.pontos[i] = 0;
  P.marcar(i);
  sim.emitir('predioAbandonado', { ref });
  if (P.flags[i] & PREDIO.DEMOLIR_AO_ABANDONAR) {
    tirarPredio(sim, i);
    sim.emitir('demolido', { tipo: 'predio', refs: [ref] });
  }
}

/** Bits de AV que contam para o abandono, da última chamada de problemas(). */
const PROB = { conta: 0 };
const CONTA_SEMPRE = AV.SEM_ACESSO | AV.BEM_ESTAR | AV.SEM_TRABALHADORES | AV.SEM_CLIENTES;

/**
 * Problemas do prédio de zona i agora: devolve os bits de AV do aviso e deixa em PROB.conta os que contam para o
 * abandono. A falta de água ou de energia conta quando é da rede do prédio: enquanto a cidade não produz o recurso, é
 * um alerta da cidade (a Vila nasce sem água e sem energia); numa rua sem canos (terra, D52) o prédio mostra o aviso,
 * perde bem-estar e não sobe de nível, mas não abandona (melhorar a rua liga).
 */
function problemas(sim, i, fam, oc) {
  const P = sim.tabelas.predios;
  const f = P.flags[i];
  let m = 0;
  let conta = 0;
  const redes = sim.agregados.redes;
  const ligado = f & (PREDIO.SEM_AGUA | PREDIO.SEM_ENERGIA) ? naRede(sim, i) : true;
  const rac = f & PREDIO.RACIONADO ? AV.RACIONADO : 0;
  const contaAgua = !!(f & PREDIO.SEM_AGUA) && redes.agua.oferta > 0;
  const contaEnergia = !!(f & PREDIO.SEM_ENERGIA) && redes.energia.oferta > 0;
  if (contaAgua) {
    m |= AV.SEM_AGUA | rac;
    if (ligado) conta |= AV.SEM_AGUA;
  }
  if (contaEnergia) {
    m |= AV.SEM_ENERGIA | rac;
    if (ligado) conta |= AV.SEM_ENERGIA;
  }
  if (f & PREDIO.SEM_ACESSO) m |= AV.SEM_ACESSO;
  if (fam === 'res') {
    // a falta que não conta (da cidade inteira ou da rua sem canos) também não pesa no bem-estar do abandono
    let b = P.bemEstar[i];
    if (f & PREDIO.SEM_AGUA && !(contaAgua && ligado)) b -= BEM.semAgua;
    if (f & PREDIO.SEM_ENERGIA && !(contaEnergia && ligado)) b -= BEM.semEnergia;
    if (P.moradores[i] && b < CRESCIMENTO.bemMinimo) m |= AV.BEM_ESTAR;
  } else if (oc && oc.vagas) {
    if (oc.frac < CRESCIMENTO.ocupacaoMinima) m |= AV.SEM_TRABALHADORES;
    if (fam === 'com' && sim.json.cidade.clientes < CRESCIMENTO.clientesMinimo) m |= AV.SEM_CLIENTES;
  }
  PROB.conta = conta | (m & CONTA_SEMPRE);
  return m;
}

/** Uma fatia da rodada dos prédios (cada prédio uma vez por rodada). */
export function sistemaPredios(sim, fatia, fatias) {
  const P = sim.tabelas.predios;
  const j = sim.json.cidade;
  const R = sim.agregados.demanda.R ?? 50;
  let mudouAviso = false;
  const escolas = SERVICOS_ORDEM.filter((id) => SERVICOS[id].educa);
  for (let i = fatia; i < P.n; i += fatias) {
    if (!P.viva[i]) continue;
    const f = P.flags[i];
    let av = 0;
    if (P.tipo[i] !== TIPO_PREDIO.ZONA) {
      // serviço e Holding: avisos das redes, do acesso e do pessoal (o serviço não abandona)
      if (f & PREDIO.OBRA) av = f & PREDIO.SEM_MATERIAL ? AV.SEM_MATERIAL : 0;
      else {
        if (f & PREDIO.SEM_AGUA) av |= AV.SEM_AGUA;
        if (f & PREDIO.SEM_ENERGIA) av |= AV.SEM_ENERGIA;
        if (f & PREDIO.RACIONADO) av |= AV.RACIONADO;
        acessoDe(sim, i, RAC);
        if (RAC.e < 0) av |= AV.SEM_ACESSO;
        else if (P.tipo[i] === TIPO_PREDIO.SERVICO && produtorDeRede(SERVICOS_ORDEM[P.modelo[i]]) && !viaComRede(sim, RAC.e)) av |= AV.SEM_REDE;
        const oc = ocupacaoDe(sim, i);
        if (P.tipo[i] === TIPO_PREDIO.SERVICO) {
          P.empregos[i] = Math.round(oc.ocupadas);
          if (oc.vagas && oc.frac < 0.5) av |= AV.SEM_TRABALHADORES;
        }
      }
    } else if (f & PREDIO.ABANDONADO) {
      // o abandonado que a pintura de outra zona marcou sai na hora (como no abandono de um marcado)
      if (f & PREDIO.DEMOLIR_AO_ABANDONAR) {
        const ref = tirarPredio(sim, i);
        sim.emitir('demolido', { tipo: 'predio', refs: [ref] });
        mudouAviso = true;
        continue;
      }
      av = AV.ABANDONADO;
      // o problema sumiu por um tempo: o prédio sai e o lote volta a nascer pela demanda
      if (problemaSumiu(sim, i)) {
        P.problema[i] = Math.min(65535, P.problema[i] + RODADA);
        if (P.problema[i] >= ABANDONO.volta) {
          const ref = tirarPredio(sim, i);
          sim.emitir('demolido', { tipo: 'predio', refs: [ref] });
          mudouAviso = true;
          continue;
        }
      } else P.problema[i] = 0;
    } else if (f & PREDIO.OBRA && !(f & PREDIO.OBRA_NIVEL)) {
      av = f & PREDIO.SEM_MATERIAL ? AV.SEM_MATERIAL : 0;
    } else {
      const fam = familiaDe(sim, i);
      let oc = null;
      if (fam === 'res') {
        encher(sim, i, R);
        for (const id of escolas) {
          const [de, para] = SERVICOS[id].educa;
          acessoDe(sim, i, RAC);
          if (RAC.e < 0) break;
          const d = distanciaTipo(sim, id, RAC.e, RAC.s);
          if (d.r >= 0 && d.d < SERVICOS[id].raio) educar(sim, i, de, para, (1 - d.d / SERVICOS[id].raio) * (P.efic[d.r] || 0));
        }
        atualizarBemEstar(sim, i);
      } else {
        oc = ocupacaoDe(sim, i);
        P.empregos[i] = Math.round(oc.ocupadas);
        P.efic[i] = oc.frac * (fam === 'com' ? Math.min(1, j.clientes) : 1);
      }
      av = problemas(sim, i, fam, oc);
      // contador do abandono (D42): âmbar aos 3 min de jogo, vermelho aos 6, abandono aos 10
      const conta = PROB.conta;
      P.problema[i] = conta ? Math.min(65535, P.problema[i] + RODADA) : 0;
      if (P.problema[i] >= ABANDONO.abandona) {
        abandonar(sim, i);
        if (P.viva[i] && P.avisos[i] !== AV.ABANDONADO) {
          P.avisos[i] = AV.ABANDONADO;
          mudouAviso = true;
        } else if (!P.viva[i]) mudouAviso = true;
        continue;
      }
      if (P.problema[i] >= ABANDONO.ambar) av |= AV.ABANDONO;
      if (fam === 'res' && desempregoAlto(sim)) av |= AV.DESEMPREGO;
      // a obra de nível parada por material também mostra o aviso no prédio (D48)
      if (f & PREDIO.SEM_MATERIAL) av |= AV.SEM_MATERIAL;
      // pontos de nível e a obra de subir
      if (!(f & PREDIO.OBRA) && !conta) {
        const C = CRESCIMENTO.pontos;
        const v = Math.min(1, valorEm(sim, P.x[i], P.z[i]) / 1000);
        const q = fam === 'res' ? P.bemEstar[i] / 100 : oc ? oc.frac : 0;
        P.pontos[i] = Math.min(65535, P.pontos[i] + Math.round(C.base + C.valor * v + C.bem * q));
        const n = P.nivel[i] + 1;
        if (n <= 5 && P.pontos[i] >= CRESCIMENTO.pontosPorNivel * P.nivel[i] && !faltaParaNivel(sim, i, n).length) subirNivel(sim, i);
      }
    }
    if (P.avisos[i] !== av) {
      P.avisos[i] = av;
      mudouAviso = true;
    }
  }
  if (mudouAviso) {
    j.avisosVersao++;
    sim.emitir('avisosPredios', {});
  }
}

const desempregoAlto = (sim) => (sim.agregados.empregos.taxa ?? 0) > 0.15;

/**
 * O problema do prédio abandonado sumiu? (acesso; água e energia chegando à via dele; moradia com bem-estar possível de
 * 25 ou mais; trabalho com gente ociosa). O abandonado não consome, então o balanço das redes não marca a falta nele: a
 * pergunta vai à rede (a via dele está num componente que recebe o recurso), com a mesma exceção do contador de
 * problemas (a falta da cidade inteira, quando nada produz o recurso, não conta).
 */
function problemaSumiu(sim, i) {
  const P = sim.tabelas.predios;
  if (P.flags[i] & PREDIO.SEM_ACESSO) return false;
  acessoDe(sim, i, RAC);
  if (RAC.e < 0) return false;
  const redes = sim.agregados.redes;
  const ligado = naRede(sim, i);
  for (const rec of RECURSOS_REDE) if (ligado && redes[rec].oferta > 0 && !temOferta(sim, RAC.e, rec)) return false;
  const fam = familiaDe(sim, i);
  if (fam === 'res') return Math.round(calcularBemEstar(sim, i)) >= CRESCIMENTO.bemVolta;
  if (fam === 'com') return sim.json.cidade.clientes >= 0.5;
  return (sim.agregados.empregos.taxa ?? 0) >= 0.05;
}

/** Nível seguinte: { pontos, meta, falta } para q.predio. */
function partePredio(sim, i, out) {
  const P = sim.tabelas.predios;
  if (P.tipo[i] !== TIPO_PREDIO.ZONA) return;
  const n = P.nivel[i] + 1;
  out.nivelProx = n > 5 ? null : { pontos: P.pontos[i], meta: CRESCIMENTO.pontosPorNivel * P.nivel[i], falta: faltaParaNivel(sim, i, n) };
  const fam = familiaDe(sim, i);
  if (fam !== 'res') {
    const oc = ocupacaoDe(sim, i);
    const vg = [0, 0, 0, 0];
    const k = tipoDoPredio(sim, i);
    const occ = sim.json.cidade.ocupacao;
    for (let q = 0; q < 4; q++) vg[q] = k.nv?.empregos[q] ?? 0;
    out.trabalho = {
      vagas: vg, ocupadas: vg.map((v, q) => Math.round(v * occ[q])), clientes: fam === 'com' ? Math.round(sim.json.cidade.clientes * 100) / 100 : null,
      produtividade: Math.round(P.efic[i] * 100) / 100,
      fatores: [{ id: 'ocupacao', v: Math.round(oc.frac * 100) / 100 }, ...(fam === 'com' ? [{ id: 'clientes', v: Math.round(sim.json.cidade.clientes * 100) / 100 }] : [])],
    };
  }
}

// ------------------------------------------------------------------------------------------------ registro

export function registrar(sim) {
  if (!sim.tabelas.predios || !sim.grafo || !sim.tabelas.celulas) return;
  prepararCidade(sim);
  sim.registrarSistema(1, 0, sistemaCrescimento, 1, { nome: 'crescimento', ordem: ORDEM.zonas });
  sim.registrarSistema(RODADA, 0, sistemaPredios, RODADA, { nome: 'predios', ordem: ORDEM.cidade });
  registrarPartePredio(partePredio);
  sim.aoCarregar(() => garantirFrentes(sim));
}
