// Regras puras da primeira hora (dona: U2a): que categoria o anel de guia aponta e que sugestões do mapa ficam à vista,
// e os comandos que constroem cada sugestão. Leem só a loja (barra, ferramenta, tela) e q.sugestoes; os testes chamam.
import { barra, tela, prefs } from '../loja.js';
import { sessao, categoria } from '../ferramentas/sessao.js';
import { inicio } from '../inicio/estado.js';
import { indiceZona } from '../../data/zonas.js';

/** Categoria da barra de construção que resolve cada objetivo da primeira hora. */
export const CATEGORIA_DO_OBJETIVO = Object.freeze({
  'cidade.avenida': 'vias',
  'cidade.zonas': 'zonas',
  'cidade.captacao': 'servicos',
  'cidade.agua': 'servicos',
  'cidade.energia': 'servicos',
  'holding.escritorio': 'empresas',
  'holding.pedreiraAreal': 'empresas',
  'holding.olaria': 'empresas',
});

/** A categoria que o anel aponta agora (pura), ou null. */
export function categoriaGuiada({ objetivos = [], ferramenta = null, categoriaAberta = null, telaAberta = null, noInicio = false, dicas = true } = {}) {
  if (!dicas || noInicio || ferramenta || categoriaAberta || telaAberta) return null;
  for (const o of objetivos) {
    const c = CATEGORIA_DO_OBJETIVO[o.id];
    if (c && !(o.total > 0 && o.feito >= o.total)) return c;
  }
  return null;
}

/** Leitura dos sinais para o anel. */
export const categoriaAgora = () =>
  categoriaGuiada({
    objetivos: barra.value?.objetivos ?? [],
    ferramenta: sessao.value?.tipo ?? null,
    categoriaAberta: categoria.value,
    telaAberta: tela.value,
    noInicio: !!inicio.value,
    dicas: prefs.value?.dicas !== false,
  });

/** Sugestão do mapa para cada objetivo da primeira hora (ids de q.sugestoes). */
export const SUGESTAO_DO_OBJETIVO = Object.freeze({
  'cidade.avenida': 'avenida',
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
  if (s.tipo === 'via') return sess.tipo === 'via';
  if (s.tipo === 'zona') return sess.tipo === 'zona' || sess.tipo === 'via';
  if (s.tipo === 'construir') return sess.tipo === 'colocar' && (sess.item?.tipo ?? sess.tipoItem ?? null) === s.construir;
  return false;
}

/** As sugestões à vista (pura): as dos objetivos abertos que existem no mapa. */
export function sugestoesAbertas({ objetivos = [], lista = [], noInicio = false, telaAberta = null, dicas = true } = {}) {
  if (!dicas || noInicio || telaAberta) return [];
  const out = [];
  for (const o of objetivos) {
    const id = SUGESTAO_DO_OBJETIVO[o.id];
    if (!id || (o.total > 0 && o.feito >= o.total)) continue;
    const s = lista.find((x) => x.id === id);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** Retângulo [x0, z0, x1, z1] de uma quadra sugerida. */
export function caixaDaQuadra(s) {
  const xs = s.pontos.map((p) => p[0]);
  const zs = s.pontos.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

/**
 * Os comandos que constroem a sugestão, na ordem (o mesmo caminho do robô): a avenida trecho a trecho; a quadra pela
 * grade de ruas da caixa e a pintura do retângulo; o prédio no lugar sugerido, encaixado como a ferramenta de colocar
 * encaixa (previa: a consulta construir.previa, que acerta x, z e o giro de frente para a via; sem ela, o lugar cru).
 */
export function comandosDaSugestao(s, sessaoVia = 'sugestao', previa = null) {
  if (s.tipo === 'via') {
    const l = [];
    for (let k = 0; k + 1 < s.pontos.length; k++) l.push(['via.construir', { plano: { modo: 'reta', tipo: s.via ?? 'avenida', pontos: [s.pontos[k], s.pontos[k + 1]], sessao: `${sessaoVia}.${k}` } }]);
    return l;
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
 * jogador fez parte) não para o resto. Devolve { ok, feitos }.
 */
export async function usarSugestao(ui, s) {
  let feitos = 0;
  let ultimo = null;
  const previa = (pedido) => ui.consultar?.('construir.previa', pedido) ?? null;
  for (const [nome, args] of comandosDaSugestao(s, `${ui.SESSAO ?? 'ui'}.sug`, previa)) {
    const r = await ui.comando(nome, args, { silencioso: nome === 'via.construir' });
    if (r.ok) feitos++;
    else ultimo = r;
  }
  if (!feitos && ultimo) ui.loja.avisar({ texto: ui.frase(ultimo), gravidade: 'atencao', codigo: ultimo.codigo });
  return { ok: feitos > 0, feitos };
}

/** Lista das sugestões do mapa (por simulação; os pontos não mudam durante a partida). */
const cache = new WeakMap();
export function listaDoMapa(sim) {
  if (!sim?.q?.sugestoes) return [];
  if (!cache.has(sim)) {
    try {
      cache.set(sim, sim.q.sugestoes() ?? []);
    } catch (e) {
      cache.set(sim, []);
    }
  }
  return cache.get(sim);
}

/** Leitura dos sinais: as sugestões à vista e se a ferramenta aberta serve a cada uma. */
export function sugestoesAgora(ui) {
  const abertas = sugestoesAbertas({
    objetivos: barra.value?.objetivos ?? [],
    lista: listaDoMapa(ui.obterSim?.()),
    noInicio: !!inicio.value,
    telaAberta: tela.value,
    dicas: prefs.value?.dicas !== false,
  });
  const sess = sessao.value;
  return abertas.map((s) => ({ s, usar: ferramentaServe(s, sess) }));
}
