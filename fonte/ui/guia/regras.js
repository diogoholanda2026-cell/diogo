// Regras puras da primeira hora (dona: U2a; C1d): que categoria o anel de guia aponta e que sugestões do mapa ficam à
// vista, e os comandos que constroem cada sugestão. Leem só a loja (barra, eventos, ferramenta, tela) e q.sugestoes e
// construir.previa, relidas quando os objetivos abertos mudam ou chega um evento que muda o mapa (nunca por quadro);
// os testes chamam.
import { barra, tela, prefs, eventos } from '../loja.js';
import { sessao, categoria } from '../ferramentas/sessao.js';
import { inicio } from '../inicio/estado.js';
import { indiceZona } from '../../data/zonas.js';
import { idxDaRef, gerDaRef } from '../../contratos/espelho.js';
import { ponto } from '../../comum/bezier.js';

/** Categoria da barra de construção que resolve cada objetivo da primeira hora. */
export const CATEGORIA_DO_OBJETIVO = Object.freeze({
  'cidade.avenida': 'vias',
  'cidade.vila': 'vias',
  'cidade.ligacao': 'vias',
  'cidade.zonas': 'zonas',
  'cidade.captacao': 'servicos',
  'cidade.agua': 'servicos',
  'cidade.energia': 'servicos',
  'holding.escritorio': 'empresas',
  'holding.pedreiraAreal': 'empresas',
  'holding.olaria': 'empresas',
});

const aberto = (o) => !(o.total > 0 && o.feito >= o.total);

/**
 * A categoria que o anel aponta agora (pura), ou null. trocas: { [id do objetivo]: categoria } das sugestões que o guia
 * trocou (a Pedreira sem acesso aponta a avenida: Vias, não Empresas).
 */
export function categoriaGuiada({ objetivos = [], ferramenta = null, categoriaAberta = null, telaAberta = null, noInicio = false, dicas = true, trocas = null } = {}) {
  if (!dicas || noInicio || ferramenta || categoriaAberta || telaAberta) return null;
  for (const o of objetivos) {
    const c = trocas?.[o.id] ?? CATEGORIA_DO_OBJETIVO[o.id];
    if (c && aberto(o)) return c;
  }
  return null;
}

/** Categoria que resolve cada tipo de sugestão (a troca do guia vira a categoria da sugestão que ficou à vista). */
const CATEGORIA_DO_TIPO = Object.freeze({ via: 'vias', melhorar: 'vias', zona: 'zonas' });

/** Leitura dos sinais para o anel (ui: as trocas do guia, relidas como as sugestões; sem ela, só os objetivos). */
export function categoriaAgora(ui = null) {
  const estado = {
    objetivos: barra.value?.objetivos ?? [],
    ferramenta: sessao.value?.tipo ?? null,
    categoriaAberta: categoria.value,
    telaAberta: tela.value,
    noInicio: !!inicio.value,
    dicas: prefs.value?.dicas !== false,
    trocas: null,
  };
  if (ui && categoriaGuiada(estado)) {
    for (const { objetivo, s, de } of guiaAgora(ui, estado.objetivos)) {
      if (de && CATEGORIA_DO_TIPO[s.tipo]) (estado.trocas ??= {})[objetivo] = CATEGORIA_DO_TIPO[s.tipo];
    }
  }
  return categoriaGuiada(estado);
}

/** Sugestão do mapa para cada objetivo da primeira hora (ids de q.sugestoes). */
export const SUGESTAO_DO_OBJETIVO = Object.freeze({
  'cidade.avenida': 'avenida',
  'cidade.vila': 'vila',
  'cidade.ligacao': 'ligacao',
  'cidade.zonas': 'quadra1',
  'cidade.captacao': 'captacao',
  'cidade.agua': 'captacao',
  'cidade.energia': 'usina',
  'holding.escritorio': 'escritorio',
  'holding.pedreiraAreal': 'pedreira',
  'holding.olaria': 'olaria',
});

/** A ferramenta aberta serve para esta sugestão? (o "Usar sugestão" só aparece aí) */
export function ferramentaServe(s, sess) {
  if (!s || !sess) return false;
  if (s.tipo === 'via' || s.tipo === 'melhorar') return sess.tipo === 'via';
  if (s.tipo === 'zona') return sess.tipo === 'zona' || sess.tipo === 'via';
  if (s.tipo === 'construir') return sess.tipo === 'colocar' && (sess.item?.tipo ?? sess.tipoItem ?? null) === s.construir;
  return false;
}

/** Recusas da prévia que deixam o prédio sugerido à vista: falta dinheiro (o jogador junta) ou o marco (o objetivo espera). */
export const RECUSAS_QUE_FICAM = Object.freeze(['creditos', 'marco']);
/** Até quantos metros do lugar de um prédio sugerido uma via sugerida dá o acesso dele (a Pedreira fica a uns 60 m). */
export const ALCANCE_VIA_SUGERIDA = 150;

/** Distância de (x, z) ao segmento a-b. */
function distSegmento(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

/** A via sugerida (tipo 'via') que passa mais perto do prédio sugerido, até `alcance` metros; null se nenhuma. */
export function viaQueServe(s, lista = [], alcance = ALCANCE_VIA_SUGERIDA) {
  let melhor = null;
  let dMin = alcance;
  for (const v of lista) {
    if (v.tipo !== 'via' || !(v.pontos?.length >= 2)) continue;
    for (let k = 0; k + 1 < v.pontos.length; k++) {
      const d = distSegmento(s.x, s.z, v.pontos[k], v.pontos[k + 1]);
      if (d <= dMin) {
        dMin = d;
        melhor = v;
      }
    }
  }
  return melhor;
}

/**
 * O que o guia mostra para cada objetivo aberto (pura): [{ objetivo, s, de }]. O prédio sugerido cuja prévia dá
 * 'acesso' (a Pedreira, no pé do Morro do Mirante, antes da primeira avenida) troca pela via sugerida que chega nele
 * (de: a sugestão do objetivo); o que a prévia recusa por outro motivo que não dinheiro nem marco (já construído, outra
 * coisa em cima) sai; o resto fica. previaDe(s) → resultado de construir.previa no lugar da sugestão (sem ela, nada
 * troca).
 */
export function resolverSugestoes({ objetivos = [], lista = [], previaDe = null } = {}) {
  const out = [];
  for (const o of objetivos) {
    const id = SUGESTAO_DO_OBJETIVO[o.id];
    if (!id || !aberto(o)) continue;
    const s = lista.find((x) => x.id === id);
    if (!s) continue;
    if (s.tipo === 'construir' && previaDe) {
      const pv = previaDe(s);
      if (pv && !pv.ok) {
        if (pv.codigo === 'acesso') {
          const v = viaQueServe(s, lista);
          if (v) out.push({ objetivo: o.id, s: v, de: s });
          continue;
        }
        if (!RECUSAS_QUE_FICAM.includes(pv.codigo)) continue;
      }
    }
    out.push({ objetivo: o.id, s, de: null });
  }
  return out;
}

/** As sugestões à vista (pura): as dos objetivos abertos que existem no mapa, sem repetir, com as trocas da prévia. */
export function sugestoesAbertas({ objetivos = [], lista = [], noInicio = false, telaAberta = null, dicas = true, previaDe = null } = {}) {
  if (!dicas || noInicio || telaAberta) return [];
  const out = [];
  for (const { s } of resolverSugestoes({ objetivos, lista, previaDe })) if (!out.includes(s)) out.push(s);
  return out;
}

/** Retângulo [x0, z0, x1, z1] de uma quadra sugerida. */
export function caixaDaQuadra(s) {
  const xs = s.pontos.map((p) => p[0]);
  const zs = s.pontos.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

/**
 * Traçados das ruas a melhorar (a sugestão 'vila'): um por aresta, a curva do espelho em 9 pontos quando a ref ainda é
 * a mesma aresta (arestas: espelho.vias.arestas), senão o par de nós da sugestão. [[[x, z], ...], ...]
 */
export function tracosDaMelhoria(s, arestas = null) {
  const out = [];
  (s.arestas ?? []).forEach((ref, k) => {
    const e = idxDaRef(ref);
    if (arestas?.p && e < (arestas.n ?? 0) && arestas.viva?.[e] && (!arestas.ger || arestas.ger[e] === gerDaRef(ref))) {
      const tr = [];
      for (let j = 0; j <= 8; j++) tr.push(ponto(arestas.p, j / 8, [0, 0], 8 * e));
      out.push(tr);
    } else if (s.pontos?.[2 * k + 1]) out.push([s.pontos[2 * k], s.pontos[2 * k + 1]]);
  });
  return out;
}

/**
 * Os comandos que constroem a sugestão, na ordem (o mesmo caminho do robô): a avenida trecho a trecho; a quadra pela
 * grade de ruas da caixa e a pintura do retângulo; as ruas de terra da Vila num via.melhorar só (as arestas que a
 * sugestão traz: usarSugestao relê na hora); o prédio no lugar sugerido, encaixado como a ferramenta de colocar
 * encaixa (previa: a consulta construir.previa, que acerta x, z e o giro de frente para a via; sem ela, o lugar cru).
 */
export function comandosDaSugestao(s, sessaoVia = 'sugestao', previa = null) {
  if (s.tipo === 'via') {
    const l = [];
    for (let k = 0; k + 1 < s.pontos.length; k++) l.push(['via.construir', { plano: { modo: 'reta', tipo: s.via ?? 'avenida', pontos: [s.pontos[k], s.pontos[k + 1]], sessao: `${sessaoVia}.${k}` } }]);
    return l;
  }
  if (s.tipo === 'melhorar') {
    if (!s.arestas?.length) return [];
    return [['via.melhorar', { arestas: [...s.arestas], tipo: s.via ?? 'rua', sessao: `${sessaoVia}.melhorar` }]];
  }
  if (s.tipo === 'zona') {
    const [x0, z0, x1, z1] = caixaDaQuadra(s);
    return [
      ['via.construir', { plano: { modo: 'grade', tipo: 'rua', pontos: [[x0, z0], [x1, z0], [x1, z1]], sessao: `${sessaoVia}.grade` } }],
      ['zona.pintar', { pincel: { modo: 'retangulo', x: x0, z: z0, x2: x1, z2: z1 }, zona: indiceZona(s.zona) }],
    ];
  }
  if (s.tipo === 'construir') {
    const pedido = { tipo: s.construir, x: s.x, z: s.z, rot: s.rot ?? 0 };
    const pv = previa ? previa(pedido) : null;
    const ok = pv && Number.isFinite(pv.x) && Number.isFinite(pv.z) && Number.isFinite(pv.rot);
    return [['construir', ok ? { ...pedido, x: pv.x, z: pv.z, rot: pv.rot } : pedido]];
  }
  return [];
}

/**
 * Constrói a sugestão pelos comandos da interface (Promise e id, recusa vira aviso). Um trecho que já existe (o
 * jogador fez parte) não para o resto. As ruas a melhorar são relidas de q.sugestoes na hora do toque (as refs mudam
 * quando uma via divide a rua, e a rua que o jogador já melhorou sai); se o comando de todas recusa por outro motivo
 * que não dinheiro (uma rua com declive ou com prédio da Holding na frente), melhora uma por uma. Devolve { ok, feitos }.
 */
export async function usarSugestao(ui, s) {
  let feitos = 0;
  let ultimo = null;
  const sessaoVia = `${ui.SESSAO ?? 'ui'}.sug`;
  if (s.tipo === 'melhorar') {
    const agora = (ui.consultar?.('sugestoes') ?? []).find((x) => x.id === s.id);
    if (!agora?.arestas?.length) return { ok: false, feitos: 0 };
    const [[nome, args]] = comandosDaSugestao(agora, sessaoVia);
    const r = await ui.comando(nome, args, { silencioso: true });
    if (r.ok) feitos++;
    else if (r.codigo !== 'creditos' && args.arestas.length > 1) {
      for (const ref of args.arestas) {
        const r1 = await ui.comando(nome, { ...args, arestas: [ref] }, { silencioso: true });
        if (r1.ok) feitos++;
        else ultimo = r1;
      }
    } else ultimo = r;
  } else {
    const previa = (pedido) => ui.consultar?.('construir.previa', pedido) ?? null;
    for (const [nome, args] of comandosDaSugestao(s, sessaoVia, previa)) {
      const r = await ui.comando(nome, args, { silencioso: nome === 'via.construir' });
      if (r.ok) feitos++;
      else ultimo = r;
    }
  }
  if (!feitos && ultimo) ui.loja.avisar({ texto: ui.frase(ultimo), gravidade: 'atencao', codigo: ultimo.codigo });
  return { ok: feitos > 0, feitos };
}

// ------------------------------------------------------------------------------------------------ releitura

/**
 * Eventos da simulação que mudam as sugestões ou o acesso dos prédios sugeridos: uma via feita ou melhorada (a rua de
 * terra da Vila sai da sugestão 'vila'; a Pedreira ganha acesso), uma demolição, um objetivo, um marco, uma partida
 * carregada.
 */
export const EVENTOS_DO_GUIA = Object.freeze(['construido', 'demolido', 'objetivo', 'marco', 'desbloqueio', 'carregado']);

let eventoVisto = null;
let versaoEventos = 0;

/** Versão dos eventos do guia: sobe quando chega um evento novo da lista (pela identidade do último, sem guardar a lista). */
export function versaoDoGuia(lista = []) {
  for (let k = lista.length - 1; k >= 0; k--) {
    if (!EVENTOS_DO_GUIA.includes(lista[k]?.nome)) continue;
    if (lista[k] !== eventoVisto) {
      eventoVisto = lista[k];
      versaoEventos++;
    }
    break;
  }
  return versaoEventos;
}

/** Chave da releitura: os objetivos abertos e a versão dos eventos do guia. */
export const chaveDoGuia = (objetivos = [], versao = 0) => `${objetivos.filter(aberto).map((o) => o.id).join(',')}#${versao}`;

/**
 * Lista das sugestões do mapa e as prévias dos prédios sugeridos, por simulação, relidas só quando a chave muda (os
 * objetivos abertos ou um evento do guia): a sugestão 'vila' muda conforme as ruas de terra são melhoradas, e o acesso
 * da Pedreira chega com a avenida. Devolve { chave, lista, previaDe(s) } (a prévia de cada prédio uma vez por chave).
 */
const cache = new WeakMap();
export function guiaDaSim(sim, chave = '') {
  if (!sim?.q?.sugestoes) return { chave, lista: [], previaDe: null };
  const c = cache.get(sim);
  if (c && c.chave === chave) return c;
  let lista = [];
  try {
    lista = sim.q.sugestoes() ?? [];
  } catch (e) {
    lista = [];
  }
  const previas = new Map();
  const previaDe = (s) => {
    if (!previas.has(s.id)) {
      let pv = null;
      try {
        pv = sim.q.construir?.previa?.({ tipo: s.construir, x: s.x, z: s.z, rot: s.rot ?? 0 }) ?? null;
      } catch (e) {
        pv = null;
      }
      previas.set(s.id, pv);
    }
    return previas.get(s.id);
  };
  const novo = { chave, lista, previaDe };
  cache.set(sim, novo);
  return novo;
}

/** Lista das sugestões do mapa da simulação (a mesma enquanto a chave não muda). */
export const listaDoMapa = (sim, chave = '') => guiaDaSim(sim, chave).lista;

/** O guia agora (a lista de resolverSugestoes) pelos objetivos dados e a simulação da interface. */
export function guiaAgora(ui, objetivos = barra.value?.objetivos ?? []) {
  const g = guiaDaSim(ui?.obterSim?.(), chaveDoGuia(objetivos, versaoDoGuia(eventos.value)));
  return resolverSugestoes({ objetivos, lista: g.lista, previaDe: g.previaDe });
}

/** Leitura dos sinais: as sugestões à vista e se a ferramenta aberta serve a cada uma. */
export function sugestoesAgora(ui) {
  if (prefs.value?.dicas === false || inicio.value || tela.value) return [];
  const out = [];
  for (const { s } of guiaAgora(ui)) if (!out.includes(s)) out.push(s);
  const sess = sessao.value;
  return out.map((s) => ({ s, usar: ferramentaServe(s, sess) }));
}

// ------------------------------------------------------------------------------------------------ traçado na tela

/** Profundidade (m, no eixo da câmera) onde o traçado é cortado: um pouco além do plano próximo do render. */
const PROF_CORTE = 1;

/**
 * Pontos de tela de um traçado do mundo cortado no plano da câmera (C1b): com a câmera rente ao chão, o ponto atrás
 * dela projeta espelhado e ligava o traçado ao outro lado da tela. Cada trecho que cruza o plano termina no ponto de
 * corte (a prof de R.projetar é afim no mundo: a interpolação é exata). Aberto: lista de trechos (cada um uma lista
 * de pontos); fechado (a quadra): um contorno só, pelo recorte de Sutherland e Hodgman num plano.
 */
export function recortarNaFrente(projetar, mundo, fechado = false) {
  const pr = mundo.map((p) => projetar(p));
  const dentro = (k) => (pr[k]?.prof ?? (pr[k]?.frente === false ? -1 : 1)) > PROF_CORTE;
  const corte = (a, b) => {
    const pa = pr[a].prof;
    const pb = pr[b].prof;
    const t = (pa - PROF_CORTE) / (pa - pb);
    const A = mundo[a];
    const B = mundo[b];
    return projetar([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  };
  const n = mundo.length;
  if (fechado) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      if (dentro(k)) out.push(pr[k]);
      if (dentro(k) !== dentro(j) && Number.isFinite(pr[k].prof) && Number.isFinite(pr[j].prof)) out.push(corte(k, j));
    }
    return out.length >= 3 ? [out] : [];
  }
  const trechos = [];
  let atual = [];
  for (let k = 0; k < n; k++) {
    if (dentro(k)) atual.push(pr[k]);
    const j = k + 1;
    if (j >= n) break;
    if (dentro(k) !== dentro(j) && Number.isFinite(pr[k].prof) && Number.isFinite(pr[j].prof)) {
      atual.push(corte(k, j));
      if (dentro(k)) {
        trechos.push(atual);
        atual = [];
      }
    }
  }
  if (atual.length) trechos.push(atual);
  return trechos.filter((t) => t.length >= 2);
}
