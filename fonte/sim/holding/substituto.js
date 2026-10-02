// Substituto do comando construir para os prédios da Holding (dona: S3a), só para testar sem a S2a: q.construir.previa,
// construir, q.catalogo e q.predio dos prédios da Holding. Não entra no índice (fonte/sim/estado.js) nem no pacote do
// jogo; os testes e o robô instalam com instalarConstruirHolding(sim) quando a S2a não está na simulação.
import { PREDIOS_HOLDING, HOLDING_ORDEM, HOLDING_M1A } from '../../data/holding.js';
import { TIPO_PREDIO, PREDIO } from '../../contratos/flags.js';
import { refDe } from '../../contratos/espelho.js';
import { pontoNoRetangulo } from '../../comum/vetor.js';
import { atan2, hipot } from '../../comum/util.js';
import { daHolding } from '../mundo/ladrilhos.js';
import { areaDe } from '../mundo/areas.js';
import { arestaPerto } from '../vias/grafo.js';
import { sincronizar, recalcular, entradaDe, idxHolding, folhaHolding } from './producao.js';

/** Recurso médio (0..255) do tipo nas células perto de (x, z). */
function recursoPerto(sim, tipo, x, z, raio) {
  const E = sim.espelho.recursos;
  if (!E?.[tipo]) return 255;
  const [ox, oz] = E.origem;
  let s = 0;
  let n = 0;
  for (let j = Math.floor((z - raio - oz) / E.passo); j <= Math.floor((z + raio - oz) / E.passo); j++) {
    for (let i = Math.floor((x - raio - ox) / E.passo); i <= Math.floor((x + raio - ox) / E.passo); i++) {
      if (i < 0 || j < 0 || i >= E.n || j >= E.n) continue;
      s += E[tipo][j * E.n + i];
      n++;
    }
  }
  return n ? s / n : 0;
}

/**
 * Prévia de construir um prédio da Holding (substituto até a S2a): ajusta a frente para a via mais perto e confere
 * marco, ladrilho, gleba, água, acesso, colisão, recurso e caixa.
 */
export function previaHolding(sim, { tipo, x, z, rot } = {}) {
  const def = PREDIOS_HOLDING[tipo];
  const base = { ok: false, codigo: 'valor', x, z, rot, custo: def?.custo ?? 0, manutencaoHora: 0, alcance: 0, efeitos: [] };
  if (!def || !HOLDING_M1A.includes(tipo) || !Number.isFinite(x) || !Number.isFinite(z)) return base;
  const [w, d] = def.planta;
  const res = { ...base, codigo: undefined };
  if (!sim.progresso.liberado(`holding.${tipo}`)) return { ...res, codigo: 'marco' };
  if (sim.espelho.ladrilhos && !daHolding(sim, x, z)) return { ...res, codigo: 'ladrilho' };
  if (sim.espelho.areas?.length && areaDe(sim, x, z) === 'gleba') return { ...res, codigo: 'gleba' };
  const T = sim.espelho.terreno;
  if (T?.agua) {
    const i = Math.round((x - T.origem[0]) / T.passo);
    const j = Math.round((z - T.origem[1]) / T.passo);
    if (i >= 0 && j >= 0 && i < T.n && j < T.n && T.agua[j * T.n + i]) return { ...res, codigo: 'agua' };
  }
  const G = sim.grafo;
  const via = G ? arestaPerto(G, x, z, Math.max(w, d) / 2 + 40) : null;
  if (!via) return { ...res, codigo: 'acesso' };
  const r = Number.isFinite(rot) ? rot : atan2(via.x - x, via.z - z);
  res.rot = r;
  if (arestaPerto(G, x, z, Math.min(w, d) / 2 - 2)) return { ...res, codigo: 'colisao' };
  const P = sim.tabelas.predios;
  const raio = 0.5 * hipot(w, d);
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i]) continue;
    const rr = 0.5 * hipot(P.w[i], P.d[i]);
    const dd = hipot(P.x[i] - x, P.z[i] - z);
    if (dd < 0.75 * (raio + rr) && (pontoNoRetangulo(P.x[i], P.z[i], x, z, r, w, d, 2) || pontoNoRetangulo(x, z, P.x[i], P.z[i], P.rot[i], P.w[i], P.d[i], 2) || dd < 0.5 * (raio + rr))) {
      return { ...res, codigo: 'colisao' };
    }
  }
  if (def.recurso && recursoPerto(sim, def.recurso, x, z, Math.max(w, d) / 2 + 32) < 40) return { ...res, codigo: 'recurso' };
  if (sim.holding.caixa() < def.custo) return { ...res, codigo: 'creditos' };
  return { ...res, ok: true };
}

/** Comando construir substituto: só prédios da Holding (a S2a publica o de verdade, para serviços e Holding). */
function construirHolding(sim, args = {}) {
  const pv = previaHolding(sim, args);
  if (!pv.ok) return pv.codigo ?? 'valor';
  const { tipo } = args;
  const def = PREDIOS_HOLDING[tipo];
  if (!sim.holding.pagar(def.custo, 'construir')) return 'creditos';
  const P = sim.tabelas.predios;
  const i = P.alocar();
  if (i < 0) return 'colisao';
  P.tipo[i] = TIPO_PREDIO.HOLDING;
  P.modelo[i] = HOLDING_ORDEM.indexOf(tipo);
  P.zona[i] = 0;
  P.x[i] = args.x;
  P.z[i] = args.z;
  P.y[i] = sim.alturaEm(args.x, args.z);
  P.rot[i] = pv.rot;
  P.w[i] = def.planta[0];
  P.d[i] = def.planta[1];
  P.nivel[i] = 1;
  P.estilo[i] = 0;
  P.semente[i] = (sim.rng('holding').u32() >>> 0);
  P.flags[i] = PREDIO.HOLDING | PREDIO.OBRA;
  P.obraIni[i] = sim.tique;
  P.obraFim[i] = sim.tique + def.obraTiques;
  P.cor[i] = 0;
  P.moradores[i] = 0;
  P.empregos[i] = def.vagas.reduce((a, b) => a + b, 0);
  P.marcar(i);
  const ref = refDe(i, P.ger[i]);
  sincronizar(sim);
  const e = entradaDe(sim, ref);
  if (e) e.criado = true;
  recalcular(sim);
  sim.emitir('construido', { tipo, refs: [ref] });
  return { ok: true, id: ref };
}

/** Catálogo substituto (categoria 'empresas'): os prédios da Holding do M1a. */
function catalogoHolding(sim, categoria) {
  if (categoria && categoria !== 'empresas' && categoria !== 'holding') return [];
  return HOLDING_M1A.map((tipo) => {
    const def = PREDIOS_HOLDING[tipo];
    return { tipo, nome: def.nome, chave: `s3.holding.${tipo}`, custo: def.custo, manutencaoHora: 0, marco: def.marco, liberado: sim.progresso.liberado(`holding.${tipo}`), categoria: 'empresas' };
  });
}

/** q.predio substituto: só a ficha de um prédio da Holding (a S2a publica o de verdade). */
function predioHolding(sim, ref) {
  const i = idxHolding(sim, ref);
  if (i < 0) return null;
  const P = sim.tabelas.predios;
  const tipo = HOLDING_ORDEM[P.modelo[i]];
  const obra = !!(P.flags[i] & PREDIO.OBRA);
  return {
    ref, tipo: 'holding', modelo: tipo, nome: PREDIOS_HOLDING[tipo].nome, zona: 0, nivel: P.nivel[i], estado: obra ? 'obra' : 'ok',
    obra: obra ? { fase: 0, progresso: Math.min(1, (sim.tique - P.obraIni[i]) / Math.max(1, P.obraFim[i] - P.obraIni[i])), fimTique: P.obraFim[i], semMaterial: false } : null,
    moradia: null, trabalho: null, nivelProx: null, servicos: null, servico: null,
    holding: folhaHolding(sim, ref), avisos: [], cor: P.cor[i], via: null, faz: PREDIOS_HOLDING[tipo].faz,
  };
}

/** O núcleo não tem consulta pública dos registros: confere pelo mapa interno (para não brigar com a S2a). */
const temComando = (sim, nome) => sim._comandos?.has(nome);
const temConsulta = (sim, nome) => sim._consultas?.has(nome);

/** Instala os substitutos (só o que a S2a ainda não registrou). */
export function instalarConstruirHolding(sim) {
  if (!temComando(sim, 'construir')) sim.registrarComando('construir', construirHolding, { substituto: 's3a' });
  if (!temConsulta(sim, 'construir.previa')) sim.registrarConsulta('construir.previa', previaHolding, { substituto: 's3a' });
  if (!temConsulta(sim, 'catalogo')) sim.registrarConsulta('catalogo', catalogoHolding, { substituto: 's3a' });
  if (!temConsulta(sim, 'predio')) sim.registrarConsulta('predio', predioHolding, { substituto: 's3a' });
}
