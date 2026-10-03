// Robô da simulação (A4, A5; dona: S3a): a estratégia de jogo pelo mesmo cmd() da interface, no Node e no navegador,
// e o relatório de marcos, moradores, bem-estar, renda, caixa, dívida, fila da frota, objetivos e ms por tique (p95,
// p99 e máximo), com o cenário de uma via a cada 10 tiques. O simular --robo chama.
//
//   node ferramentas/robo/robo-sim.mjs [--horas 12] [--semente s] [--comprarTempo] [--fazDeConta] [--json arquivo]
//
// Modos: com a cidade da S2a publicada, o robô joga a cidade de verdade (vias, zonas, serviços pelo construir); com
// --fazDeConta (ou sem a S2a), a cidade é a de faz de conta pelos agregados (cidade-faz-de-conta.mjs), com as vias e
// as zonas de verdade. Sem a X1b, a Arcologia não anda e o marco 7 não chega (o relatório diz).
// No navegador: import { criarEstrategia } e chame estrategia.passo() a cada rodada (20 tiques) com a sim do jogo.
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { ZONAS_ORDEM } from '../../fonte/data/zonas.js';
import { XP } from '../../fonte/data/marcos.js';
import { precoBase } from '../../fonte/data/holding.js';
import { SERVICOS } from '../../fonte/data/servicos.js';
import { dataDoTique, ANO_INICIAL } from '../../fonte/data/historia.js';
import { SEDE_CENTRO, GLEBA_ENVELOPE } from '../../fonte/data/arcologia-plano.js';
import { idxDaRef } from '../../fonte/contratos/espelho.js';
import { AGUA, ETAPA, PREDIO, TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { ANO, MES } from '../../fonte/comum/relogio.js';
import { frentesLivres } from '../../fonte/sim/zonas/crescimento.js';
import { daHolding } from '../../fonte/sim/mundo/ladrilhos.js';
import { aguaEm } from '../../fonte/sim/mundo/terreno.js';
import { areaDe } from '../../fonte/sim/mundo/areas.js';
import { ligarCidadeFalsa } from './cidade-faz-de-conta.mjs';

const RODADA = 20;
const HORA = 3600;
const MIN = 60;

/** Minutos de jogo de um tique, como "1:05" (h:mm). */
export const hm = (t) => `${Math.floor(t / HORA)}:${String(Math.floor((t % HORA) / MIN)).padStart(2, '0')}`;

const temComando = (sim, nome) => !!sim._comandos?.get(nome);


// ------------------------------------------------------------------------------------------------ a malha da cidade

/**
 * A cidade do robô (C1a): quadras de 112 m (a grade de ruas da seção 2.3, 6 células de cada lado) numa malha que começa
 * na primeira quadra sugerida, a oeste do disco da sede (D90), ligada à rua principal da Vila pela ligação sugerida. A
 * quadra abre pelos lados que faltam, cada um uma rua reta de nó a nó da malha (a grade de duas caixas vizinhas
 * repetiria a rua da divisa, e a prévia recusa); um lado que a prévia recusa (declive, colisão) fica de fora e a
 * quadra abre com os outros, se tiver dois. Só abre a quadra que toca a rede por um canto: a água e a energia correm só
 * nas vias com calçada (D52), e nenhuma quadra fica ilhada. A segunda malha, a leste, começa no fim da via que sai da
 * primeira avenida e contorna o disco pelo norte (a água do Mirror Lake entra pelo portão norte). Uma quadra fora da
 * área da Holding, no disco, na água ou na Vila nem entra na lista.
 */
const LADO = 112;
/**
 * Comprimento da quadra (m): a frente comprida, sem rua no meio. Uma quadra de 112 x 112 perde quase tudo nos cantos
 * (as células das quatro ruas se cortam em diagonal e só sobram triângulos onde o prédio médio não cabe); com 336 m
 * de frente sobra o retângulo do meio, como nas quadras de 100 x 300 m das cidades brasileiras.
 */
const COMPRIDO = 336;
/** Margem (m) da caixa da quadra até a gleba (a calçada e o raio do nó). */
const MARGEM_GLEBA = 28;
/** Malha leste: a via que liga a primeira avenida à planície do leste e o canto da primeira quadra de lá. */
const LESTE = Object.freeze({ via: [[200, -680], [480, -690], [820, -700]], canto: [820, -812] });
/**
 * O elo (C1a): do canto nordeste da malha oeste ao nó de entrada, pelo pé do Morro da Pedreira e fora do disco. A rede
 * da cidade passa a ser uma só com a da avenida: a energia da rodovia (D52, até 5 MW) e, com o lago.e1 pronto, a água
 * do reservatório do Mirror Lake (D49, 6 mil moradores) chegam aos bairros do oeste.
 */
const ELOS = Object.freeze([
  [[-432, -508], [-200, -560], [60, -700]],
  [[-432, -396], [-200, -560], [60, -700]],
]);

function caixaFora(sim, x0, z0, x1, z1) {
  const [cx, cz] = SEDE_CENTRO;
  const dx = Math.max(x0 - cx, 0, cx - x1);
  const dz = Math.max(z0 - cz, 0, cz - z1);
  if (Math.hypot(dx, dz) < GLEBA_ENVELOPE.raio + MARGEM_GLEBA) return false;
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) {
    if (!daHolding(sim, x, z)) return false;
    if (sim.espelho.terreno && aguaEm(sim.espelho.terreno, x, z) !== AGUA.TERRA) return false;
    if (areaDe(sim, x, z) === 'vila') return false;
  }
  return true;
}

/**
 * Quadras de uma malha: { id, malha, i, j, x0, z0, x1, z1, X0, Z0, estado: 'nova' | 'feita' | 'descartada', pintada }.
 * O nó (i, j) da malha fica em (X0 + i x 112, Z0 + j x 112); a quadra (i, j) vai do nó (i, j) ao (i + 1, j + 1).
 */
function malha(sim, nome, X0, Z0, faixaI, faixaJ, { xMin = -Infinity, lx = LADO, lz = COMPRIDO } = {}) {
  const out = [];
  for (let j = faixaJ[0]; j <= faixaJ[1]; j++) {
    for (let i = faixaI[0]; i <= faixaI[1]; i++) {
      const x0 = X0 + i * lx;
      const z0 = Z0 + j * lz;
      if (x0 < xMin || !caixaFora(sim, x0, z0, x0 + lx, z0 + lz)) continue;
      out.push({ id: `${nome}:${i},${j}`, malha: nome, i, j, x0, z0, x1: x0 + lx, z1: z0 + lz, X0, Z0, lx, lz, estado: 'nova', pintada: false, zona: null });
    }
  }
  return out;
}

/** Chave de um ponto (nó da malha) por coordenadas: as malhas comprida e curta dividem os nós. */
const chaveNo = ([x, z]) => `${Math.round(x)},${Math.round(z)}`;

/** Os 4 lados da quadra: { chave, a: [x, z], b: [x, z] } (topo, base, esquerda, direita), pelas coordenadas. */
function ladosDe(q) {
  const { x0, z0, x1, z1 } = q;
  const lado = (a, b) => ({ chave: `${chaveNo(a)}|${chaveNo(b)}`, a, b });
  return [lado([x0, z0], [x1, z0]), lado([x0, z1], [x1, z1]), lado([x0, z0], [x0, z1]), lado([x1, z0], [x1, z1])];
}

/**
 * A estratégia do robô. op: { comprarTempo, cidadeFalsa (de ligarCidadeFalsa ou null), anotar, ritmo }.
 * passo() decide uma rodada: decisões, Holding, serviços, vias e quadras, Arcologia, empréstimo e Depósito.
 */
export function criarEstrategia(sim, { comprarTempo = false, cidadeFalsa = null, anotar = () => {}, ritmo = 60 } = {}) {
  const E = {
    sessao: 0,
    feito: new Set(),
    quadras: [],
    servicos: {},
    holding: {},
    ultimaVenda: 0,
    falhas: {},
    tentativas: {},
    querEmprestimo: false,
    lados: {}, // chave do lado -> 'feito' | 'falhou'
    segmentos: [], // lados feitos: [x0, z0, x1, z1] (um lado curto sobre um comprido feito já existe)
    nos: new Set(), // nós da malha ligados à rede ('x,z')
  };
  // ritmo de gente: no máximo uma obra (via, prédio, serviço) a cada `ritmo` tiques
  const OBRAS = new Set(['via.construir', 'via.melhorar', 'construir']);
  let proximaObra = 0;
  const podeObra = () => sim.tique >= proximaObra;
  const cmd = (nome, args) => {
    if (OBRAS.has(nome) && !podeObra()) return { ok: false, codigo: 'ritmo' };
    let r;
    try {
      r = sim.cmd(nome, args);
    } catch (e) {
      r = { ok: false, codigo: 'erro', dados: { mensagem: String(e?.message ?? e) } };
    }
    if (!r.ok) E.falhas[`${nome}:${r.codigo}`] = (E.falhas[`${nome}:${r.codigo}`] ?? 0) + 1;
    else {
      anotar(sim.tique, nome, args);
      if (OBRAS.has(nome)) proximaObra = sim.tique + ritmo;
    }
    return r;
  };
  const caixa = () => sim.holding.caixa();
  const marco = () => sim.progresso.marco().n;
  const anoDeJogo = () => Math.floor(sim.tique / ANO) + 1;
  const LISTA_SUG = sim.q.sugestoes ? sim.q.sugestoes() : [];
  const sug = (id) => (id === 'vila' && sim.q.sugestoes ? sim.q.sugestoes() : LISTA_SUG).find((s) => s.id === id);
  const plano = (modo, tipo, pontos) => ({ plano: { modo, tipo, pontos, sessao: `robo.${++E.sessao}` } });
  const desistir = (chave, max = 20) => (E.tentativas[chave] = (E.tentativas[chave] ?? 0) + 1) > max;
  const real = !cidadeFalsa;

  /** Tenta uma via; devolve true se construiu. Confere o custo pela prévia antes. */
  function via(modo, tipo, pontos, reserva = 20000) {
    if (!sim.q.via?.previa || !podeObra()) return false;
    const pv = sim.q.via.previa({ modo, tipo, pontos });
    if (!pv?.ok || !(pv.custo >= 0)) return false;
    if (pv.custo > caixa() - reserva) {
      E.querEmprestimo = true;
      return false;
    }
    return cmd('via.construir', plano(modo, tipo, pontos)).ok;
  }

  /** Procura um lugar perto de (x, z) onde a prévia de construir aceita o tipo (no próprio ponto, com o giro dado). */
  function acharLugar(tipo, x, z, raio = 260, passo = 32, rot0 = null) {
    if (!sim.q.construir?.previa || !podeObra()) return null;
    for (let r = 0; r <= raio; r += passo) {
      const n = r === 0 ? 1 : Math.max(8, Math.round((2 * Math.PI * r) / passo));
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n;
        const px = x + r * Math.cos(a);
        const pz = z + r * Math.sin(a);
        const pv = sim.q.construir.previa({ tipo, x: px, z: pz, rot: r === 0 ? rot0 : null });
        if (pv?.ok) return { x: pv.x ?? px, z: pv.z ?? pz, rot: Number.isFinite(pv.rot) ? pv.rot : 0 };
        if (pv?.codigo === 'creditos' || pv?.codigo === 'marco') return null;
      }
    }
    return null;
  }

  function construir(tipo, x, z, raio, rot = null) {
    const l = acharLugar(tipo, x, z, raio, 32, rot);
    if (!l) return null;
    const r = cmd('construir', { tipo, x: l.x, z: l.z, rot: l.rot });
    return r.ok ? r.id : null;
  }

  /** Centro das quadras feitas (para os serviços ficarem perto de quem mora). */
  function centroCidade() {
    const b = E.quadras.filter((q) => q.estado === 'feita');
    if (!b.length) return [-820, 160];
    const s = b.reduce((a, q) => [a[0] + (q.x0 + q.x1) / 2, a[1] + (q.z0 + q.z1) / 2], [0, 0]);
    return [s[0] / b.length, s[1] / b.length];
  }

  // a malha oeste começa na primeira quadra sugerida (as sugeridas já estão nela, com a zona delas); a leste, depois
  function prepararMalhas() {
    // a quadra de baixo começa no fim da ligação com a Vila (nó (0, 1)), com a frente comprida no sentido norte-sul
    const fim = sug('ligacao')?.pontos?.at(-1) ?? [-880, 276];
    E.quadras.push(...malha(sim, 'oeste', fim[0], fim[1] - COMPRIDO, [-1, 9], [-3, 0], { xMin: -905 }));
    // a leste, as quadras compridas no sentido leste-oeste, ao longo da planície entre o Mirante e a rodovia
    const [cx, cz] = LESTE.canto;
    E.quadras.push(...malha(sim, 'leste', cx, cz, [0, 4], [-3, 6], { lx: COMPRIDO, lz: LADO }));
  }

  /** Nós de entrada das malhas: o fim da ligação com a Vila (oeste) e o da via que contorna o disco (leste). */
  function ligarEntradas() {
    const lig = sug('ligacao')?.pontos?.at(-1);
    if (E.feito.has('ligacao') && lig) E.nos.add(chaveNo(lig));
    if (lesteLigada()) E.nos.add(chaveNo(LESTE.via.at(-1)));
  }

  function decidir() {
    if (!sim.q.decisoes) return;
    for (const d of sim.q.decisoes()) {
      const escolha = { 'vila.agua': 'captacao', 'febre.aurora': caixa() > 150000 ? 'comprar' : 'proteger', 'canal.seshat': 'local' }[d.id] ?? d.padrao;
      // sem caixa para a opção, espera (no fim do prazo vale a padrão)
      const op = d.opcoes?.find((o) => o.id === escolha);
      if (op?.creditos > caixa() - 20000) continue;
      cmd('decisao.escolher', { id: d.id, opcao: escolha });
    }
  }

  /** Uma via sugerida, trecho a trecho (como o "Usar sugestão"). true quando terminou. */
  function viaSugerida(id, reserva) {
    if (E.feito.has(id)) return true;
    const s = sug(id);
    if (!s) return E.feito.add(id), true;
    let ok = true;
    for (let k = 0; k + 1 < s.pontos.length; k++) {
      if (E.feito.has(`${id}.${k}`)) continue;
      if (!podeObra()) return false;
      if (via('reta', s.via ?? 'rua', [s.pontos[k], s.pontos[k + 1]], reserva)) E.feito.add(`${id}.${k}`);
      else ok = false;
    }
    if (ok || desistir(id)) E.feito.add(id);
    return E.feito.has(id);
  }

  // ---------------------------------------------------------------------------------------------- quadras

  const ligado = (p) => E.nos.has(chaveNo(p));
  /** O lado existe: feito, ou coberto por um lado comprido feito na mesma linha. */
  const existe = (l) => {
    if (E.lados[l.chave] === 'feito') return true;
    const [ax, az] = l.a;
    const [bx, bz] = l.b;
    return E.segmentos.some(([x0, z0, x1, z1]) =>
      (ax === bx && x0 === x1 && x0 === ax && Math.min(z0, z1) <= Math.min(az, bz) && Math.max(z0, z1) >= Math.max(az, bz)) ||
      (az === bz && z0 === z1 && z0 === az && Math.min(x0, x1) <= Math.min(ax, bx) && Math.max(x0, x1) >= Math.max(ax, bx)));
  };
  const ladosFeitos = (q) => ladosDe(q).filter(existe).length;
  const quadrasFeitas = () => E.quadras.filter((q) => q.estado === 'feita');

  /** A malha leste está ligada (a via que sai da avenida e contorna o disco pelo norte foi feita)? */
  const lesteLigada = () => E.feito.has('leste');

  /**
   * Próxima quadra a abrir: tocando a rede por um canto; a que já tem mais lados prontos (as vizinhas fizeram, sai mais
   * barata) e depois a mais perto da primeira, a oeste antes do leste.
   */
  function proximaQuadra() {
    let melhor = null;
    for (const q of E.quadras) {
      if (q.estado !== 'nova') continue;
      if (!ladosDe(q).some((l) => ligado(l.a) || ligado(l.b))) continue;
      const d = Math.abs(q.i) + Math.abs(q.j) - 3 * ladosFeitos(q) + (q.malha === 'leste' ? 2 : 0);
      if (!melhor || d < melhor.d) melhor = { q, d };
    }
    return melhor?.q ?? null;
  }

  /** Marca o lado feito e liga os nós dele, também os do meio a cada 112 m (a rua passa por eles). */
  function ladoFeito(l) {
    E.lados[l.chave] = 'feito';
    E.segmentos.push([l.a[0], l.a[1], l.b[0], l.b[1]]);
    const n = Math.max(1, Math.round(Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) / LADO));
    for (let k = 0; k <= n; k++) E.nos.add(chaveNo([l.a[0] + ((l.b[0] - l.a[0]) * k) / n, l.a[1] + ((l.b[1] - l.a[1]) * k) / n]));
  }

  /**
   * Abre a quadra: constrói os lados que faltam (ruas retas de nó a nó, primeiro os que tocam a rede), como uma obra só
   * (o jogador traça as quatro ruas de uma vez). Dois lados prontos: a quadra está feita e é pintada. Sem caixa para um
   * lado, para e pede empréstimo; o que a prévia recusa fica de fora. A quadra comprida que não abre (a encosta, o
   * córrego) vira quadras de 112 m, que contornam o trecho ruim.
   */
  function abrir(q) {
    let mexeu = true;
    while (mexeu) {
      mexeu = false;
      for (const l of ladosDe(q)) {
        if (existe(l) || E.lados[l.chave] === 'falhou') continue;
        if (!ligado(l.a) && !ligado(l.b)) continue;
        const pontos = [l.a, l.b];
        const pv = sim.q.via.previa({ modo: 'reta', tipo: 'rua', pontos });
        if (!pv?.ok) {
          const soCaixa = (pv?.erros ?? []).length > 0 && pv.erros.every((e) => e.codigo === 'creditos');
          if (soCaixa) return void (E.querEmprestimo = true);
          E.lados[l.chave] = 'falhou';
          continue;
        }
        if (pv.custo > caixa() - 15000) return void (E.querEmprestimo = true);
        let r;
        try {
          r = sim.cmd('via.construir', plano('reta', 'rua', pontos));
        } catch (e) {
          r = { ok: false, codigo: 'erro' };
        }
        if (!r.ok) {
          E.falhas[`via.construir:${r.codigo}`] = (E.falhas[`via.construir:${r.codigo}`] ?? 0) + 1;
          E.lados[l.chave] = 'falhou';
          continue;
        }
        anotar(sim.tique, 'via.construir', pontos);
        ladoFeito(l);
        mexeu = true;
      }
    }
    proximaObra = sim.tique + ritmo;
    if (ladosFeitos(q) >= 2 && (q.lx === LADO && q.lz === LADO ? true : ladosDe(q).every((l) => existe(l)))) {
      q.estado = 'feita';
      pintar(q);
      return;
    }
    // nenhum lado que falta toca a rede (os outros foram recusados): a quadra sai da fila
    const resta = ladosDe(q).some((l) => !existe(l) && E.lados[l.chave] !== 'falhou' && (ligado(l.a) || ligado(l.b)));
    if (resta) return;
    q.estado = 'descartada';
    if (q.lx > LADO || q.lz > LADO) {
      // em quadras de 112 m, com o mesmo lugar na fila
      for (let x = q.x0; x < q.x1 - 1; x += LADO) {
        for (let z = q.z0; z < q.z1 - 1; z += LADO) {
          if (!caixaFora(sim, x, z, x + LADO, z + LADO)) continue;
          E.quadras.push({ ...q, id: `${q.id}:${x},${z}`, x0: x, z0: z, x1: x + LADO, z1: z + LADO, lx: LADO, lz: LADO, estado: 'nova', pintada: false, zona: null });
        }
      }
    }
  }

  /** Família de cada zona que o robô pinta e a demanda dela na barra (S2a). */
  const FAMILIA = { resBaixa: 'R', resMedia: 'R', comBaixa: 'C', industria: 'I' };

  /**
   * Zonas que pedem espaço, da que mais pede (cidade da S2a): a zona tem a sua parte da demanda (a S2a divide a da
   * família entre as zonas pelo estudo e pelo valor do terreno) e não nasce prédio dela há 5 min: as frentes livres
   * que sobram costumam ser pontas onde nenhum modelo cabe, então a conta de frentes engana. A residencial média só
   * depois do marco 2.
   */
  function zonasPedidas() {
    const d = sim.agregados.demanda ?? {};
    const out = [];
    for (const z of ['resMedia', 'resBaixa', 'comBaixa', 'industria']) {
      if (z === 'resMedia' && marco() < 2) continue;
      const dem = d[z] ?? 0;
      if (dem < 8) continue;
      if (sim.tique - (E.nasceuZona?.[z] ?? -1e9) < 300) continue;
      // depois do marco 2 a média vem antes da baixa: mais moradores por metro de rua
      out.push({ z, v: dem * (z === 'resBaixa' && marco() >= 2 ? 0.4 : 1) });
    }
    return out.sort((a, b) => b.v - a.v);
  }

  /** Zona de uma quadra nova: a sugerida, senão pela demanda (com a de faz de conta, por uma lista fixa). */
  function zonaDe(q) {
    if (q.zona) return q.zona;
    if (cidadeFalsa) {
      const lista = ['resBaixa', 'resBaixa', 'comBaixa', 'resBaixa', 'industria', 'resBaixa', 'resMedia', 'resMedia', 'comBaixa', 'resMedia'];
      const z = lista[(E.pintadas ?? 0) % lista.length];
      return z === 'resMedia' && marco() < 2 ? 'resBaixa' : z;
    }
    return zonasPedidas()[0]?.z ?? (marco() >= 2 ? 'resMedia' : 'resBaixa');
  }

  function pintar(q) {
    const z = zonaDe(q);
    const r = cmd('zona.pintar', { pincel: { modo: 'retangulo', x: q.x0, z: q.z0, x2: q.x1, z2: q.z1 }, zona: ZONAS_ORDEM.indexOf(z) });
    if (r.ok || r.codigo === 'nada') {
      q.pintada = true;
      q.zona = z;
      E.pintadas = (E.pintadas ?? 0) + 1;
    }
  }

  /**
   * A cidade pede espaço? Com a de faz de conta, pela capacidade. Com a da S2a: a família que mais pede tem poucas
   * frentes livres, ou a cidade parou de nascer com demanda (as frentes que sobram são pontas onde nenhum modelo cabe).
   */
  function precisaEspaco() {
    const feitas = quadrasFeitas().length;
    if (feitas < 3) return true;
    if (cidadeFalsa) return cidadeFalsa.estado.pop > cidadeFalsa.estado.capacidade * 0.75;
    return zonasPedidas().length > 0;
  }

  /** Anota, por zona, o último tique em que nasceu um prédio dela (a zona parada com demanda pede quadra) e as obras paradas por material. */
  function contarNascimentos() {
    const P = sim.tabelas.predios;
    const nz = {};
    let esperando = 0;
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
      const zid = ZONAS_ORDEM[P.zona[i]];
      nz[zid] = (nz[zid] ?? 0) + 1;
      if (P.flags[i] & PREDIO.SEM_MATERIAL) esperando++;
    }
    E.esperando = esperando;
    E.nasceuZona ??= {};
    E.prediosZona ??= {};
    for (const zid of Object.keys(FAMILIA)) {
      if ((nz[zid] ?? 0) > (E.prediosZona[zid] ?? 0)) E.nasceuZona[zid] = sim.tique;
      E.prediosZona[zid] = nz[zid] ?? 0;
    }
  }

  function quadras() {
    if (!podeObra()) return;
    ligarEntradas();
    // a quadra que as vizinhas já cercaram (dois lados ou mais) só é pintada
    for (const q of E.quadras) {
      if (q.estado !== 'nova' || ladosFeitos(q) < (q.lx === LADO && q.lz === LADO ? 2 : 4) || !precisaEspaco()) continue;
      q.estado = 'feita';
      pintar(q);
      return;
    }
    if (!precisaEspaco()) return;
    const q = proximaQuadra();
    E.ultimaQuadra = { tique: sim.tique, pedidas: real ? zonasPedidas() : null, quadra: q?.id ?? null };
    if (q) return abrir(q);
    // a oeste encheu: a via para a planície do leste (sai da primeira avenida e contorna o disco pelo norte)
    if (!lesteLigada()) {
      for (let k = 0; k + 1 < LESTE.via.length; k++) {
        if (!E.feito.has(`leste.${k}`) && via('reta', 'rua', [LESTE.via[k], LESTE.via[k + 1]], 20000)) return void E.feito.add(`leste.${k}`);
        if (!E.feito.has(`leste.${k}`)) return;
      }
      E.feito.add('leste');
    }
  }

  /** Vias da primeira hora: a avenida (objetivo), a rede da Vila nas ruas de terra, a ligação com o bairro novo. */
  function vias() {
    if (!viaSugerida('avenida', 0)) return;
    if (real && !E.feito.has('vila') && E.servicos.captacao && E.servicos.solar && podeObra()) {
      const s = sug('vila');
      if (!s) E.feito.add('vila');
      else {
        const pv = sim.q.via.previa({ modo: 'melhorar', tipo: s.via, arestas: s.arestas, pontos: [] });
        if (pv?.ok && pv.custo <= caixa() - 20000 && cmd('via.melhorar', { arestas: s.arestas, tipo: s.via, sessao: `robo.${++E.sessao}` }).ok) E.feito.add('vila');
        else if (!pv?.ok && desistir('vila')) E.feito.add('vila');
        return;
      }
    }
    if (!viaSugerida('ligacao', 10000)) return;
    // o primeiro elo cuja ponta já está na rede (o canto da malha que chegou primeiro); começado, vai até o fim
    if (real && !E.feito.has('elo') && E.feito.has('avenida')) {
      E.elo ??= ELOS.findIndex((e) => ligado(e[0]));
      const elo = ELOS[E.elo];
      if (!elo) E.elo = undefined;
      else {
        for (let k = 0; k + 1 < elo.length; k++) {
          if (E.feito.has(`elo.${k}`)) continue;
          if (!via('reta', 'rua', [elo[k], elo[k + 1]], 15000)) {
            if (desistir('elo', 200)) E.feito.add('elo');
            return quadras();
          }
          E.feito.add(`elo.${k}`);
        }
        E.feito.add('elo');
      }
    }
    quadras();
  }

  // ---------------------------------------------------------------------------------------------- serviços

  const redes = () => sim.agregados.redes ?? {};

  function servicos() {
    const [cx, cz] = centroCidade();
    // [tipo, marco, sugestão, moradores a partir de]
    const lista = [
      ['captacao', 0, 'captacao', 0], ['solar', 0, 'usina', 0], ['praca', 0, null, 600], ['clinica', 1, null, 800],
      ['escolaF', 1, null, 900], ['delegacia', 1, null, 1500], ['bombeiros', 2, null, 3000],
    ];
    const pop0 = sim.agregados.populacao;
    for (const [tipo, m, s, pmin] of lista) {
      if (E.servicos[tipo] || marco() < m || pop0 < pmin || caixa() < (s ? 22000 : 30000)) continue;
      if (cidadeFalsa) {
        const t = tipo === 'solar' ? 'usinaSolar' : tipo;
        if (cidadeFalsa.porServico(t)) {
          E.servicos[tipo] = 1;
          sim.progresso.xp(XP.servico, 'servicos');
        }
        continue;
      }
      if (!s) continue; // na cidade da S2a, os outros vão por bairro (abaixo)
      const lugar = sug(s);
      const id = lugar ? construir(tipo, lugar.x, lugar.z, 160, lugar.rot) : null;
      if (id !== null) E.servicos[tipo] = id;
    }
    if (cidadeFalsa) {
      // água antes de faltar (o reservatório do Mirror Lake conta) e mais serviços quando a cidade cresce (um a cada
      // ~5 mil moradores)
      const pop = sim.agregados.populacao;
      const ag = redes().agua ?? {};
      if (E.servicos.captacao && ag.oferta < pop * 0.5 * 1.15 && caixa() > 45000) cidadeFalsa.porServico('captacao');
      const extra = Math.floor(pop / 5000);
      if (extra > (E.extras ?? 0) && caixa() > 120000) {
        const tipo = ['clinica', 'escolaF', 'praca', 'solar', 'delegacia'][(E.extras ?? 0) % 5];
        cidadeFalsa.porServico(tipo === 'solar' ? 'usinaSolar' : tipo);
        E.extras = (E.extras ?? 0) + 1;
      }
      return;
    }
    // cidade da S2a: água e energia antes de faltar (só com as de antes prontas: a oferta já conta todas)
    const r = redes();
    const P = sim.tabelas.predios;
    let emObra = false;
    for (let i = 0; i < P.n && !emObra; i++) if (P.viva[i] && P.tipo[i] === TIPO_PREDIO.SERVICO && P.flags[i] & PREDIO.OBRA) emObra = true;
    if (!emObra) {
      if (r.agua?.oferta > 0 && r.agua.demanda > 0.8 * r.agua.oferta && caixa() > 45000) return void construir('captacao', -965, 330, 400);
      if (r.energia?.oferta > 0 && r.energia.demanda > 0.8 * r.energia.oferta && caixa() > 40000) return void servicoNaCidade('solar');
      // cada malha é uma rede (água e energia por componente, S2a): casas sem energia ou sem água pedem o produtor ali
      const falta = { energia: {}, agua: {} };
      for (let i = 0; i < P.n; i++) {
        if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || P.flags[i] & PREDIO.OBRA) continue;
        const sem = P.flags[i] & (PREDIO.SEM_ENERGIA | PREDIO.SEM_AGUA);
        if (!sem) continue;
        const q = E.quadras.find((x) => (x.estado === 'feita' || x.pintada) && P.x[i] >= x.x0 - 8 && P.x[i] <= x.x1 + 8 && P.z[i] >= x.z0 - 8 && P.z[i] <= x.z1 + 8);
        if (!q) continue;
        if (P.flags[i] & PREDIO.SEM_ENERGIA) falta.energia[q.malha] = (falta.energia[q.malha] ?? 0) + 1;
        if (P.flags[i] & PREDIO.SEM_AGUA) falta.agua[q.malha] = (falta.agua[q.malha] ?? 0) + 1;
      }
      // a falta de rede vem antes de tudo (a casa sem energia abandona em 10 min de jogo, D42)
      for (const [m, n] of Object.entries(falta.energia)) if (n >= 3 && caixa() > SERVICOS.solar.custo + 3000 && servicoNaCidade('solar', m) !== null) return;
      for (const [m, n] of Object.entries(falta.agua)) {
        if (n < 3 || caixa() < SERVICOS.captacao.custo + 3000) continue;
        if (m === 'oeste' && construir('captacao', -965, 330, 400) !== null) return;
        if (m !== 'oeste' && servicoNaCidade('poco', m) !== null) return;
      }
    }
    // serviço onde falta (desenho 8.1 e D50): a cada 2 min, uma amostra das casas diz a cobertura de cada categoria; o
    // que mais pesa no bem-estar (falta x peso) ganha um prédio perto da casa menos atendida
    if (sim.tique - (E.ultimaCobertura ?? -1e9) < 120) return;
    E.ultimaCobertura = sim.tique;
    const POR_CAT = { saude: ['clinica', 8, 1], educacao: ['escolaF', 6, 1], seguranca: ['delegacia', 6, 1], bombeiros: ['bombeiros', 4, 2], lazer: ['praca', 6, 0] };
    const soma = {};
    const pior = {};
    let n = 0;
    const passo = Math.max(1, Math.floor(P.n / 60));
    for (let i = 0; i < P.n; i += passo) {
      if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || !P.moradores[i]) continue;
      const sv = sim.q.predio(P.ref(i))?.servicos;
      if (!sv) continue;
      n++;
      for (const c of Object.keys(POR_CAT)) {
        const v = +sv[c] || 0;
        soma[c] = (soma[c] ?? 0) + v;
        if (!pior[c] || v < pior[c].v) pior[c] = { v, x: P.x[i], z: P.z[i] };
      }
    }
    if (!n) return;
    const faltas = Object.entries(POR_CAT).filter(([, [, , mk]]) => marco() >= mk).map(([c, [tipo, peso]]) => ({ c, tipo, falta: (1 - soma[c] / n) * peso })).sort((x, y) => y.falta - x.falta);
    const alvo = faltas[0];
    if (!alvo || alvo.falta < 1) return;
    const custo = SERVICOS[alvo.tipo]?.custo ?? 20000;
    if (caixa() < custo + 25000) return;
    const p = pior[alvo.c];
    const q = E.quadras.filter((x) => x.estado === 'feita').sort((x, y) => Math.hypot((x.x0 + x.x1) / 2 - p.x, (x.z0 + x.z1) / 2 - p.z) - Math.hypot((y.x0 + y.x1) / 2 - p.x, (y.z0 + y.z1) / 2 - p.z))[0];
    if (q) servicoNaCidade(alvo.tipo, q.malha, [(q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2]);
  }

  /**
   * Um serviço dentro de uma quadra feita (a mais perto do centro da cidade): fora delas ele pode cair na caixa de uma
   * quadra futura e a grade dela seria recusada por colisão.
   */
  function servicoNaCidade(tipo, malhaId = null, centro = null) {
    const [cx, cz] = centro ?? centroCidade();
    const lista = E.quadras.filter((q) => (q.estado === 'feita' || q.pintada) && (!malhaId || q.malha === malhaId)).map((q) => ({ q, d: Math.hypot((q.x0 + q.x1) / 2 - cx, (q.z0 + q.z1) / 2 - cz) + (E.usadas?.[q.id] ?? 0) * 150 }));
    lista.sort((a, b) => a.d - b.d);
    for (const { q } of lista.slice(0, 6)) {
      const id = construir(tipo, (q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, 48);
      if (id !== null) {
        (E.usadas ??= {})[q.id] = (E.usadas[q.id] ?? 0) + 1;
        return id;
      }
      if (!podeObra()) return null;
    }
    return null;
  }

  // ---------------------------------------------------------------------------------------------- Holding

  function posicaoDe(ref) {
    const P = sim.tabelas.predios;
    const i = idxDaRef(ref);
    return { x: P.x[i], z: P.z[i] };
  }

  /**
   * Unidades do item importadas e ainda a caminho (q.deposito().importacoes, 40 tiques): sem contar elas, o passo
   * seguinte (20 tiques depois) via o estoque ainda baixo e importava de novo (C1a, revisão: 5 lotes de cimento seguidos).
   */
  function importando(item) {
    return (sim.q.deposito?.().importacoes ?? []).reduce((a, x) => a + (x.item === item ? x.n : 0), 0);
  }

  function holding() {
    const passos = [
      ['escritorioObra', 0, 'escritorio'], ['pedreira', 0, 'pedreira'], ['areal', 0, 'areal'], ['olaria', 1, 'olaria'], ['concreteira', 3, null],
    ];
    for (const [tipo, m, s] of passos) {
      if (E.holding[tipo] || marco() < m || caixa() < 30000) continue;
      // a Pedreira sugerida fica na primeira avenida: espera a avenida inteira (procurando outro lugar antes, ela
      // podia cair no traçado de um trecho que falta)
      if (tipo === 'pedreira' && !E.feito.has('avenida')) continue;
      const lugar = s ? sug(s) : null;
      const perto = E.holding.escritorioObra ? posicaoDe(E.holding.escritorioObra) : { x: -886, z: -420 };
      const id = lugar ? construir(tipo, lugar.x, lugar.z, 160, lugar.rot) : construir(tipo, perto.x, perto.z, 300);
      if (id !== null) E.holding[tipo] = id;
    }
    // Olaria: a segunda linha faz tijolo com a argila da primeira
    const ola = E.holding.olaria;
    if (ola && !E.feito.has('olaria.tijolo')) {
      const f = sim.q.predio?.(ola)?.holding;
      if (f && f.linhas.length >= 1 && f.linhas[0].item === 'argila' && f.proximoNivel && marco() >= f.proximoNivel.marco) {
        if (f.linhas.length < 2) cmd('predio.nivel', { ref: ola });
        if (sim.q.predio(ola).holding.linhas.length > 1 && cmd('linha.ordem', { predio: ola, linha: 1, item: 'tijolo', n: 10, auto: true }).ok) E.feito.add('olaria.tijolo');
      }
    }
    // armazém maior quando enche
    const esc = E.holding.escritorioObra;
    const prod = sim.q.producao?.();
    if (esc && prod && prod.armazem.usado > prod.armazem.capacidade * 0.85 && caixa() > 60000) {
      const prox = sim.q.predio?.(esc)?.holding?.proximoNivel;
      const tem = (item) => prod.itens.find((i) => i.item === item)?.estoque ?? 0;
      if (prox && marco() >= prox.marco && Object.entries(prox.materiais).every(([k, q]) => tem(k) >= q)) cmd('predio.nivel', { ref: esc });
    }
    // Depósito: vende o que sobra além do que a próxima etapa da Arcologia pede (uma vez por meia hora)
    if (prod && sim.tique - E.ultimaVenda > 1800) {
      const guarda = (item) => 200 + (proximaEtapa()?.materiais?.find((m) => m.item === item)?.pede ?? 0);
      for (const it of prod.itens) {
        if (['brita', 'areia', 'tijolo', 'argila'].includes(it.item) && it.estoque > guarda(it.item) + 50) cmd('deposito.vender', { item: it.item, n: it.estoque - guarda(it.item) });
      }
      E.ultimaVenda = sim.tique;
    }
    // D48: do marco 3 em diante a Holding importa para a cidade a 160% e vende a 100%; com o caixa baixo, a obra da
    // cidade espera (desliga) em vez de levar o caixa a zero, e volta a abastecer com folga
    if (marco() >= 3) {
      // sem quadra nova para abrir, a cidade cresce pelos níveis: o caixa vai para eles (a planície do leste ainda sem
      // a via de ligação conta como espaço: o caixa guarda para a via antes de ir para os níveis)
      const semEspaco = real && !proximaQuadra() && lesteLigada();
      const liga = semEspaco ? 20000 : 90000;
      const desliga = semEspaco ? 8000 : 45000;
      const quer = E.importarCidade === false ? caixa() > liga : caixa() > desliga;
      if (quer !== (E.importarCidade ?? true) && cmd('cidade.importarAuto', { sim: quer }).ok) E.importarCidade = quer;
    }
    // cimento importado para a Concreteira
    if (prod && marco() >= 3 && E.holding.concreteira) {
      const cim = prod.itens.find((i) => i.item === 'cimento');
      if (cim && cim.estoque + importando('cimento') < 20 && caixa() > 25000) cmd('importar', { item: 'cimento', n: 30 });
    }
    if (comprarTempo && caixa() > 250000) {
      for (const ref of Object.values(E.holding)) {
        const f = sim.q.predio?.(ref)?.holding;
        f?.linhas.forEach((l, k) => l.rodando && cmd('acelerar', { alvo: { predio: ref, linha: k }, minutos: 5 }));
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- Arcologia

  /** A primeira etapa ainda não pronta (disponível ou em obra), da q.arcologia. */
  function proximaEtapa() {
    if (!sim.q.arcologia) return null;
    for (const parte of sim.q.arcologia()?.partes ?? []) for (const et of parte.etapas ?? []) if (et.estado === ETAPA.DISPONIVEL || et.estado === ETAPA.EM_OBRA) return et;
    return null;
  }

  /** Itens que a Holding não produz agora (importados a 160%, D25): aço e vidro no M1a, e o resto sem o prédio dono. */
  function produz(item) {
    const p = { brita: 'pedreira', areia: 'areal', argila: 'olaria', tijolo: 'olaria', concreto: 'concreteira' }[item];
    return !!(p && E.holding[p]);
  }

  /**
   * A Arcologia: cada etapa começa quando o caixa paga os créditos e o que falta importar do que a Holding não faz, com
   * folga; o que falta vem antes (os caminhões levam do armazém assim que a obra abre, e a obra não para por aço). A
   * lago.e1 espera a Pedreira e o Areal terem metade da brita e da areia (a obra parada só prende o caixa).
   */
  function arcologia() {
    if (!temComando(sim, 'arcologia.iniciar') || !sim.q.arcologia || E.semArcologia) return;
    const et = proximaEtapa();
    if (!et) return;
    const precoImp = (item) => Math.ceil(1.6 * (precoBase(item) || 0));
    if (et.estado === ETAPA.EM_OBRA) {
      // durante a obra: importa o que a Holding não faz e falta para a fase andar
      if (et.parada === 'material') {
        for (const m of et.materiais) {
          const falta = m.pede - m.entregue - m.aCaminho - m.estoque - importando(m.item);
          if (falta > 0 && !produz(m.item) && caixa() > falta * precoImp(m.item) + 20000) cmd('importar', { item: m.item, n: Math.min(100, falta) });
        }
      }
      return;
    }
    if (et.id === 'lago.e1' && !E.feito.has('avenida')) return;
    // a reserva guarda no estoque o que a Holding faz para a etapa liberada: sem ela a cidade leva tudo (D48) e a
    // metade do pedido nunca junta. Só com o caixa a caminho dos créditos dela (antes disso o material parado no
    // estoque atrasa as obras da cidade sem adiantar a etapa)
    if (marco() >= et.marco && caixa() >= 0.6 * et.creditos) {
      E.reserva ??= {};
      for (const m of et.materiais) {
        if (produz(m.item) && E.reserva[m.item] !== m.pede && cmd('estoque.reserva', { item: m.item, n: m.pede }).ok) E.reserva[m.item] = m.pede;
      }
    }
    let importar = 0;
    for (const m of et.materiais) {
      const falta = Math.max(0, m.pede - m.estoque - importando(m.item));
      if (falta > 0 && !produz(m.item)) importar += falta * precoImp(m.item);
      else if (falta > m.pede / 2) return; // a Holding faz: espera metade no estoque
    }
    const reserva = 40000;
    if (caixa() < et.creditos + importar + reserva) return;
    for (const m of et.materiais) {
      const falta = Math.max(0, m.pede - m.estoque - importando(m.item));
      if (falta > 0 && !produz(m.item)) cmd('importar', { item: m.item, n: Math.min(100, falta) });
    }
    const r = cmd('arcologia.iniciar', { etapa: et.id });
    if (!r.ok && r.codigo === 'trancado') {
      // a etapa liberada não sai para este jogador (o A2 tranca a Arcologia): solta o estoque guardado para ela e não
      // junta mais (C1c)
      E.semArcologia = true;
      for (const [item, n] of Object.entries(E.reserva ?? {})) if (n > 0) cmd('estoque.reserva', { item, n: 0 });
      E.reserva = {};
    }
  }

  // ---------------------------------------------------------------------------------------------- finanças

  function financas() {
    const e = sim.q.emprestimo();
    const o = sim.q.orcamento();
    const ano = anoDeJogo();
    // empréstimo só nos dois primeiros anos (2020 e 2021, seção 12.6): quando o caixa aperta ou a cidade pede espaço
    const quer = E.querEmprestimo;
    E.querEmprestimo = false;
    if (ano <= 2 && ((caixa() < 25000 && o.fluxoCaixaHora < 2000) || quer) && e.disponivelAno >= 10000) {
      cmd('emprestimo.tomar', { valor: Math.min(50000, e.disponivelAno) });
    }
    // do ano 3 em diante, amortiza no calendário (C1c): no máximo uma parcela (10% do principal, com os juros) a cada 2
    // meses no ano 3 e uma por mês do ano 4 em diante, e quita quando o caixa cobre a dívida, do ano 4 em diante; a
    // dívida some antes do ano 6 (2025). Antes pagava sempre que o caixa passava da folga: o prêmio do marco 4 ia
    // inteiro para a dívida de 10% ao ano (5% por hora de jogo) e as quadras paravam no ano 3
    if (ano >= 3 && e.divida > 0) {
      const mes = Math.floor(sim.tique / MES);
      if (ano >= 4 && caixa() > e.divida + 12000) cmd('emprestimo.quitar', {});
      else if (mes >= (E.proximaParcela ?? 0) && e.parcela > 0 && caixa() > 5000 + e.parcela + e.jurosDevidos) {
        if (cmd('emprestimo.pagarParcela', {}).ok) E.proximaParcela = mes + (ano === 3 ? 2 : 1);
      }
    }
  }

  prepararMalhas();
  return {
    estado: E,
    passo() {
      if (real) contarNascimentos();
      financas();
      decidir();
      holding();
      servicos();
      vias();
      arcologia();
    },
  };
}


const pct = (v, p) => (v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : 0);

/**
 * Joga e devolve o relatório. op: { horas, semente, comprarTempo, fazDeConta, aoProgresso(horas) }.
 */
export function rodarRobo({ horas = 12, semente = 'robo-1', comprarTempo = false, fazDeConta = null, aoProgresso = null } = {}) {
  const agora = () => performance.now();
  const sim = criarSimulacao({ semente, cronometro: agora });
  const real = !sim.substitutoAtivo('agregados') && !!sim._comandos?.get('construir') && !sim._comandos.get('construir').substituto;
  const usarFalsa = fazDeConta ?? !real;
  const cidadeFalsa = usarFalsa ? ligarCidadeFalsa(sim, { moradoresIniciais: Math.max(350, sim.agregados.populacao || 350) }) : null;
  const tomado = {};
  const anotar = (t, nome, args) => {
    if (nome === 'emprestimo.tomar') tomado[dataDoTique(t).ano] = (tomado[dataDoTique(t).ano] ?? 0) + args.valor;
  };
  const est = criarEstrategia(sim, { comprarTempo, cidadeFalsa, anotar });
  const T = Math.round(horas * HORA);
  const tiques = new Float64Array(T);
  const R = {
    modo: usarFalsa ? 'cidade de faz de conta (agregados)' : 'cidade da S2a',
    arcologia: temComando(sim, 'arcologia.iniciar') ? 'X1b' : 'sem a X1b (marco 7 indisponível)',
    semente, horas, comprarTempo,
    marcos: [],
    caixaMin: Infinity, caixaMinTique: 0, caixa1h: null, zeradoTiques: 0, zeradoNaPrimeiraHora: false,
    emprestimosPrimeiraHora: 0, dividaMax: 0, tomadoPorAno: {}, dividaFimAno: null,
    semObjetivo: 0, objetivosFeitos: [],
    filaMax: 0, vendasMarco5: null,
    bemEstarAbaixo61Apos3: 0,
  };
  let marcoAnt = 0;
  let mesesAbaixo = 0;
  sim.on('marco', (d) => R.marcos.push({ n: d.n, nome: d.nome, tique: sim.tique, hora: hm(sim.tique) }));
  sim.on('objetivo', (d) => d.estado === 'feito' && R.objetivosFeitos.push(`${d.id}@${hm(sim.tique)}`));
  for (let t = 0; t < T; t++) {
    if (t % RODADA === 0) est.passo();
    const a = agora();
    sim.rodar(1, { sincrono: true });
    tiques[t] = agora() - a;
    if (t % RODADA === 5) {
      const c = sim.holding.caixa();
      if (c < R.caixaMin) {
        R.caixaMin = c;
        R.caixaMinTique = t;
      }
      if (sim.json.economia.zerado) {
        R.zeradoTiques += RODADA;
        if (t < HORA) R.zeradoNaPrimeiraHora = true;
      }
      const e = sim.q.emprestimo();
      if (e.divida > R.dividaMax) R.dividaMax = e.divida;
      if (e.divida > 0) R.dividaFimAno = dataDoTique(t).ano;
      const pf = sim.q.producao().frota;
      if (pf.fila > R.filaMax) R.filaMax = pf.fila;
      if (sim.q.objetivos().length === 0) R.semObjetivo += RODADA;
      const m = sim.progresso.marco().n;
      if (m >= 5 && marcoAnt < 5) {
        const tot = sim.q.orcamento().totais.receitas;
        const soma = Object.values(tot).reduce((x, v) => x + v, 0);
        R.vendasMarco5 = soma > 0 ? ((tot.cidade ?? 0) + (tot.deposito ?? 0)) / soma : 0;
      }
      marcoAnt = m;
    }
    if (t === HORA - 1) {
      R.caixa1h = sim.holding.caixa();
      R.emprestimosPrimeiraHora = sim.q.emprestimo().contratos.length;
    }
    if (t % 600 === 599 && sim.progresso.marco().n >= 3) {
      if (sim.agregados.bemEstarTarifa < 61) mesesAbaixo++;
      else mesesAbaixo = 0;
      R.bemEstarAbaixo61Apos3 = Math.max(R.bemEstarAbaixo61Apos3, mesesAbaixo);
    }
    if (aoProgresso && t % HORA === HORA - 1) aoProgresso((t + 1) / HORA, sim);
  }
  R.tomadoPorAno = tomado;
  const v = [...tiques].sort((x, y) => x - y);
  const b = sim.q.barra();
  const o = sim.q.orcamento();
  const prod = sim.q.producao();
  Object.assign(R, {
    tiques: T,
    moradores: b.populacao,
    bemEstar: b.bemEstar,
    tarifa: b.tarifa,
    rendaHora: o.receitas.moradores,
    saldoHora: o.saldoHora,
    caixaFim: b.creditos,
    dividaFim: b.divida,
    marcoFim: b.marco,
    frota: prod.frota,
    estoque: Object.fromEntries(prod.itens.filter((i) => i.estoque > 0).map((i) => [i.item, i.estoque])),
    holding: prod.predios.map((p) => `${p.tipo} n${p.nivel}`),
    receitas: o.totais.receitas,
    despesas: o.totais.despesas,
    naoPago: o.totais.naoPago,
    tique: { media: v.reduce((a, x) => a + x, 0) / Math.max(1, v.length), p50: pct(v, 0.5), p95: pct(v, 0.95), p99: pct(v, 0.99), max: v[v.length - 1] ?? 0 },
    falhas: est.estado.falhas,
    erros: sim.erros.map((e) => `${e.onde}: ${String(e.mensagem).split('\n')[0]}`),
  });
  R.metas = metasA4(R);
  // cenário do A5: uma obra de via a cada 10 tiques, com o tique medido à parte (depois do relatório do jogo)
  R.via = cenarioVia(sim, agora);
  return { R, sim };
}

/** Cenário do A5: 600 tiques com uma via construída a cada 10, num lugar livre; tique e comando medidos à parte. */
function cenarioVia(sim, agora) {
  if (!sim.q.via?.previa) return null;
  sim.holding.receber(2000000, 'teste'); // caixa para as obras do cenário (fora do relatório do jogo)
  // acha um lugar livre para uma reta de 112 m (na área da Holding, fora do disco e longe das vias da partida)
  let base = null;
  for (let z = -1400; z <= 900 && !base; z += 100) {
    for (let x = -950; x <= 1900; x += 150) {
      const pv = sim.q.via.previa({ modo: 'reta', tipo: 'rua', pontos: [[x, z], [x + 112, z]] });
      // os encaixes de passo e comprimento (as guias da ferramenta) aparecem em qualquer lugar; nó, aresta e portão
      // querem dizer via da partida perto
      const perto = (pv?.encaixes ?? []).some((e) => e.tipo === 'no' || e.tipo === 'aresta' || e.tipo === 'portao');
      if (pv?.ok && !pv.dividir?.length && !perto) {
        base = [x, z];
        break;
      }
    }
  }
  if (!base) return { nota: 'sem lugar livre para o cenário' };
  const tt = [];
  const tc = [];
  let feitas = 0;
  for (let i = 0; i < 600; i++) {
    // a cada 10 tiques uma obra de via: constrói a reta e, 10 tiques depois, desfaz (o lugar fica livre de novo)
    if (i % 10 === 0) {
      const a = agora();
      const r = (i / 10) % 2 === 0
        ? sim.cmd('via.construir', { plano: { modo: 'reta', tipo: 'rua', pontos: [base, [base[0] + 112, base[1]]], sessao: `cenario.${i}` } })
        : sim.cmd('via.desfazer', { sessao: `cenario.${i - 10}` });
      tc.push(agora() - a);
      if (r.ok) feitas++;
    }
    const a = agora();
    sim.rodar(1, { sincrono: true });
    tt.push(agora() - a);
  }
  tt.sort((x, y) => x - y);
  tc.sort((x, y) => x - y);
  return { vias: feitas, tique: { p95: pct(tt, 0.95), p99: pct(tt, 0.99), max: tt[tt.length - 1] }, comando: { p50: pct(tc, 0.5), p95: pct(tc, 0.95), max: tc[tc.length - 1] } };
}

/** Metas parciais do A4 antes da calibração (marco 1 e marco 3) e as que já dá para medir. */
function metasA4(R) {
  const tq = (n) => R.marcos.find((m) => m.n === n)?.tique ?? null;
  const dentro = (v, a, b) => v !== null && v >= a && v <= b;
  const m1 = tq(1);
  const m3 = tq(3);
  return {
    marco1: { tique: m1, meta: '10 a 15 min', ok: dentro(m1, 600, 900) },
    marco3: { tique: m3, meta: '40 a 70 min', ok: dentro(m3, 2400, 4200) },
    caixaPrimeiraHora: { ok: !R.zeradoNaPrimeiraHora && R.emprestimosPrimeiraHora <= 1, meta: 'não zera na primeira hora, no máximo um empréstimo' },
    dividaMax: { ok: R.dividaMax <= 500000, meta: 'até 500 mil' },
    tomadoPorAno: { ok: Object.values(R.tomadoPorAno).every((v) => v <= 50000), meta: 'até 50 mil por ano' },
    // seção 12.6: o empréstimo nos 2 primeiros anos e quitado antes do ano 6 (só se mede com 12 h de jogo, 6 anos)
    emprestimoDoisAnos: { ok: Object.keys(R.tomadoPorAno).every((a) => +a <= ANO_INICIAL + 1), meta: 'empréstimo só em 2020 e 2021' },
    quitaAntesAno6: { ok: R.horas < 12 ? null : R.dividaFimAno === null || R.dividaFimAno <= ANO_INICIAL + 4, meta: 'sem dívida a partir de 2025' },
    vendasMarco5: { ok: R.vendasMarco5 === null ? null : R.vendasMarco5 >= 0.15 && R.vendasMarco5 <= 0.35, meta: '15% a 35% das receitas no marco 5' },
    sempreObjetivo: { ok: R.semObjetivo === 0, meta: 'sempre um objetivo aberto' },
    erros: { ok: R.erros.length === 0, meta: 'erros []' },
  };
}

/** Relatório em texto. */
export function textoRelatorio(R) {
  const f = (v, c = 0) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c }) : String(v));
  const linhas = [];
  linhas.push(`robô da simulação: ${R.horas} h de jogo, semente ${R.semente}, ${R.modo}, Arcologia ${R.arcologia}${R.comprarTempo ? ', comprando tempo' : ''}`);
  linhas.push(`  marcos: ${R.marcos.map((m) => `${m.n} ${m.nome} em ${m.hora}`).join(' · ') || 'nenhum'}`);
  linhas.push(`  fim: ${f(R.moradores)} moradores, bem-estar ${f(R.bemEstar, 1)} (tarifa ${R.tarifa}), contribuição ${f(R.rendaHora)}/h, saldo ${f(R.saldoHora)}/h, marco ${R.marcoFim.n} (${f(R.marcoFim.xp)} XP)`);
  linhas.push(`  caixa: mínimo ${f(R.caixaMin)} em ${hm(R.caixaMinTique)}, com 1 h ${f(R.caixa1h)}, no fim ${f(R.caixaFim)}; zerado por ${f(R.zeradoTiques / 60, 1)} min de jogo`);
  linhas.push(`  dívida: máxima ${f(R.dividaMax)}, no fim ${f(R.dividaFim)}; tomado por ano ${JSON.stringify(R.tomadoPorAno)}; última dívida em ${R.dividaFimAno ?? 'nunca'}`);
  linhas.push(`  Holding: ${R.holding.join(', ') || 'nada'}; estoque ${JSON.stringify(R.estoque)}; vendas no marco 5 ${R.vendasMarco5 === null ? 'sem marco 5' : f(R.vendasMarco5 * 100, 1) + '% das receitas'}`);
  linhas.push(`  frota: ${R.frota.total} caminhões, fila máxima ${R.filaMax}, espera média ${f(R.frota.atrasoMedio, 1)} tiques, ${R.frota.feitas} entregas`);
  linhas.push(`  objetivos: ${R.semObjetivo ? `${R.semObjetivo} tiques sem objetivo aberto` : 'sempre um aberto'}; feitos: ${R.objetivosFeitos.join(', ') || 'nenhum'}`);
  linhas.push(`  receitas: ${JSON.stringify(Object.fromEntries(Object.entries(R.receitas).map(([k, v]) => [k, Math.round(v)])))}`);
  linhas.push(`  tique (${R.tiques}): média ${f(R.tique.media, 3)} · p50 ${f(R.tique.p50, 3)} · p95 ${f(R.tique.p95, 3)} · p99 ${f(R.tique.p99, 3)} · máximo ${f(R.tique.max, 3)} ms`);
  if (R.via?.nota) linhas.push(`  cenário de vias: ${R.via.nota}`);
  if (R.via?.tique) linhas.push(`  cenário uma obra de via a cada 10 tiques (${R.via.vias} feitas): tique p95 ${f(R.via.tique.p95, 3)} · p99 ${f(R.via.tique.p99, 3)} · máximo ${f(R.via.tique.max, 3)} ms; via.construir p50 ${f(R.via.comando.p50, 2)} · p95 ${f(R.via.comando.p95, 2)} · máximo ${f(R.via.comando.max, 2)} ms`);
  linhas.push(`  metas A4 parciais: ${Object.entries(R.metas).map(([k, m]) => `${k} ${m.ok === null ? 'sem medida' : m.ok ? 'dentro' : 'FORA'}`).join(' · ')}`);
  const falhas = Object.entries(R.falhas).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (falhas.length) linhas.push(`  recusas mais comuns: ${falhas.map(([k, n]) => `${k} x${n}`).join(', ')}`);
  linhas.push(`  erros: ${R.erros.length ? R.erros.slice(0, 5).join(' | ') : '[]'}`);
  return linhas.join('\n');
}

function lerArgs(argv) {
  const o = { horas: 12, semente: 'robo-1', comprarTempo: false, fazDeConta: null, json: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--horas') o.horas = +argv[++i];
    else if (k === '--semente') o.semente = argv[++i];
    else if (k === '--comprarTempo') o.comprarTempo = true;
    else if (k === '--fazDeConta') o.fazDeConta = true;
    else if (k === '--cidadeReal') o.fazDeConta = false;
    else if (k === '--json') o.json = argv[++i];
  }
  return o;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const o = lerArgs(process.argv.slice(2));
  const t0 = performance.now();
  const { R } = rodarRobo({ ...o, aoProgresso: (h) => process.stdout.write(`  ... ${h} h de jogo (${((performance.now() - t0) / 1000).toFixed(0)} s)\n`) });
  console.log(textoRelatorio(R));
  console.log(`  ${((performance.now() - t0) / 1000).toFixed(1)} s reais`);
  if (o.json) writeFileSync(o.json, JSON.stringify(R, null, 1));
  process.exit(R.erros.length ? 1 : 0);
}
