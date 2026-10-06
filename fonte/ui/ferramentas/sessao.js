// Sessão da ferramenta ativa (desenho da UI 8.4, 8.5, 9.1 a 9.6; D16, D18, D24, D32, D40): a cola entre a entrada do
// render (R.entrada.aoFerramenta, com a mira 56 px acima do dedo), as máquinas puras (via, zona, colocar, demolir,
// areas), as consultas de prévia da simulação (com os substitutos enquanto a S1b, a S2a e a S3a não publicam), os
// comandos por acoes.js (Promise e id) e as sobreposições do render (R.ferramenta.*). Aqui também: o Desfazer da
// sessão (até 10 ações), o teclado do PC, a vibração, a rolagem pela borda (só se o render não rolar sozinho) e o
// catálogo da bandeja.
//
// Contrato com as outras parcelas de interface: loja.ferramenta.value = { tipo: 'via' | 'zona' | 'colocar' | 'demolir'
// | 'areas', ...opções } abre a ferramenta (colocar pede { item: { tipo, nome, custo, ... } }; zona aceita { zona }; via
// aceita { tipoVia, modo }); null fecha. Os componentes leem o sinal `sessao` e chamam `ferramentas.*`.
import { signal, batch, effect } from '@preact/signals';
import * as via from './via.js';
import * as zona from './zona.js';
import * as colocar from './colocar.js';
import * as demolir from './demolir.js';
import * as areas from './areas.js';
import * as textosUx1 from '../textos/ux1.js';
import { registrarTextos } from '../textos.js';
import { VIAS } from '../../data/vias.js';
import { ZONAS, ZONAS_ORDEM } from '../../data/zonas.js';
import { MARCOS } from '../../data/marcos.js';
import { alturaEm } from '../../comum/altura.js';
import { ETAPA } from '../../contratos/flags.js';
import { SESSAO } from '../acoes.js';

// os textos da UX1 entram por aqui enquanto o índice de textos não os lista (a mesma parcela pode registrar de novo)
textosUx1.registrar(registrarTextos);

/** Até quantas ações o Desfazer guarda por sessão (D32). */
export const MAX_DESFAZER = 10;

/** Categorias da barra (D24) e os atalhos do PC (desenho da UI 9.5). */
export const GRUPOS = Object.freeze({ cidade: ['vias', 'zonas', 'servicos', 'lazer'], holding: ['demolir', 'empresas', 'arcologia'] });
export const ATALHOS = Object.freeze({ vias: 'V', zonas: 'Z', servicos: 'X', lazer: 'G', empresas: 'H', arcologia: 'M', demolir: 'B' });
export const GLIFO_CATEGORIA = Object.freeze({ vias: 'vias', zonas: 'zonas', servicos: 'servicos', lazer: 'lazer', empresas: 'empresas', arcologia: 'arcologia', demolir: 'demolir' });

/** Vibrações (desenho da UI 9.6). */
export const VIBRA = Object.freeze({ encaixe: 8, confirmar: 15, erro: [30, 40, 30] });

/** Deslocamento da mira no toque e borda da rolagem (px). */
export const MIRA_PX = 56;
export const BORDA_PX = 48;

// ------------------------------------------------------------------------------------------------ sinais

/**
 * Estado que os componentes leem (null sem ferramenta):
 * { tipo, id, maquina, previa, valido, motivo, codigo, encaixe: { tipo, valor, ponto, texto } | null, desfazer,
 *   item, resumo, info, substituto, dedo, dica }
 * dica (colocar, D98): { codigo, texto, curto, tom: 'er' | 'info', colide } ou null; o painel do fantasma mostra.
 */
export const sessao = signal(null);

/** Categoria com a bandeja aberta (null: nenhuma). */
export const categoria = signal(null);

/** O que muda a cada quadro, fora dos sinais (Lupa e Cotas leem no ui.aoQuadro): mira e dedo em px de tela. */
export const vivo = { mira: null, dedo: null, toque: false, apoiado: false, estalo: 0, mpp: 1 };

/** Ações para os componentes (preenchidas no registrar). */
export const ferramentas = {
  abrir: () => {},
  fechar: () => {},
  cancelar: () => {},
  construir: () => {},
  desfazer: () => {},
  opcao: () => {},
  girar: () => {},
  girarPara: () => {},
  alinhar: () => {},
  comprar: () => {},
  escolherCategoria: () => {},
};

// ------------------------------------------------------------------------------------------------ puras

/** Pilha do Desfazer: guarda no máximo `max` ações (a mais velha sai). */
export function criarPilha(max = MAX_DESFAZER) {
  return { max, lista: [] };
}
export function empilhar(p, acao) {
  p.lista.push(acao);
  while (p.lista.length > p.max) p.lista.shift();
  return p.lista.length;
}
export function desempilhar(p) {
  return p.lista.pop() ?? null;
}

/**
 * Metros por pixel de tela em volta de um ponto (pelo raio do render nos dois lados). Sem chão, `padrao`.
 * @param {{ raio(x, y): number[] | null }} R
 */
export function metrosPorPixel(R, tela, padrao = 1) {
  if (!R?.raio || !tela) return padrao;
  const a = R.raio(tela[0] - 10, tela[1]);
  const b = R.raio(tela[0] + 10, tela[1]);
  if (!a || !b) return padrao;
  const d = Math.hypot(b[0] - a[0], b[2] - a[2]) / 20;
  return Number.isFinite(d) && d > 0 ? d : padrao;
}

/** Tolerância do encaixe em metros: 20 px de tela no zoom atual, nunca abaixo de 6 m nem acima de 80 m. */
export const toleranciaEmMetros = (R, tela, px = via.VIA.tolPx) => Math.max(via.VIA.tolMin, Math.min(80, px * metrosPorPixel(R, tela, 0.6)));

/**
 * Velocidade da rolagem pela borda: com o ponto a menos de `borda` px da borda da área livre, [vx, vy] de -1 a 1 na
 * direção da borda (proporcional à distância); fora disso, null.
 * @param {number[]} p  [x, y] de tela
 * @param {{ x0, y0, x1, y1 }} area  área livre (px)
 */
export function velocidadeBorda(p, area, borda = BORDA_PX) {
  if (!p || !area) return null;
  const f = (d) => (d < borda ? Math.min(1, (borda - d) / borda) : 0);
  const vx = f(p[0] - area.x0) > 0 ? -f(p[0] - area.x0) : f(area.x1 - p[0]);
  const vy = f(p[1] - area.y0) > 0 ? -f(p[1] - area.y0) : f(area.y1 - p[1]);
  return vx || vy ? [vx, vy] : null;
}

const PRIORIDADE_ENCAIXE = ['no', 'aresta', 'quadra', 'prolongamento', 'angulo', 'passo', 'comprimento'];

/**
 * Encaixe a mostrar no chip: o de maior prioridade perto do ponto que se move (até `raio` m). null se nenhum.
 * @param {object[]} encaixes  os de q.via.previa
 */
export function escolherEncaixe(encaixes, ponto, raio = 40) {
  if (!encaixes?.length || !ponto) return null;
  let melhor = null;
  let mp = Infinity;
  for (const x of encaixes) {
    if (!x?.ponto) continue;
    const d = Math.hypot(x.ponto[0] - ponto[0], x.ponto[1] - ponto[1]);
    if (d > raio) continue;
    const p = PRIORIDADE_ENCAIXE.indexOf(x.tipo);
    const k = p < 0 ? 99 : p;
    if (k < mp) {
      mp = k;
      melhor = x;
    }
  }
  return melhor;
}

/**
 * Chave da sessão da ferramenta para a simulação (via.construir, via.melhorar, via.demolir e via.desfazer). Leva a
 * sessão da página (D16) além do contador: a simulação guarda a última sessão no save, e um contador que recomeça do
 * 1 depois de recarregar a página emendaria a sessão nova na velha (desfazer e reembolso integral de vias antigas).
 */
export const chaveDaSessao = (n, pagina = SESSAO) => `${pagina}.${n}`;

/**
 * Ref da coisa criada por um comando (contrato: Resposta.id; o id do comando, { sessao, seq }, vem em idComando). A
 * ref também pode chegar em `ref` ou em `dados.ref`; um `id` que não é número não serve. null se não veio.
 */
export function refCriada(r) {
  if (!r?.ok) return null;
  for (const v of [r.ref, r.dados?.ref, r.id]) if (Number.isInteger(v) && v >= 0) return v;
  return null;
}

/** Primeiro erro da prévia: { codigo, trecho, dados }, ou null. */
export function primeiroErro(previa) {
  const e = previa?.erros?.[0];
  if (!e) return null;
  return typeof e === 'string' ? { codigo: e } : e;
}

/**
 * Itens da bandeja de uma categoria: { abas: [{ id, rotulo }] | null, itens: [cartão] }. Vias e zonas saem dos dados
 * (data/vias.js, data/zonas.js); serviços, lazer e empresas de q.catalogo(categoria) (S2a e S3a). Cartão: { id, acao:
 * 'via' | 'zona' | 'colocar', nome, glifo, custo, porMetro, marco, trancado, efeito, aba, dados }.
 * @param {string} cat
 * @param {{ consultar: Function, marco?: number, livre?: boolean, parte?: string }} op
 */
export function itensDaCategoria(cat, { consultar = () => null, marco = 0, livre = false, parte = 'M1a' } = {}) {
  const tranca = (m) => !livre && Number.isFinite(m) && m > marco;
  if (cat === 'vias') {
    return {
      abas: null,
      itens: via.TIPOS_VIA.map((t) => ({ id: t, acao: 'via', nome: VIAS[t].nome, glifo: t, custo: null, porMetro: VIAS[t].custoM, largura: VIAS[t].largura, marco: VIAS[t].marco, trancado: tranca(VIAS[t].marco), dados: { tipoVia: t } })),
    };
  }
  if (cat === 'zonas') {
    const fam = { res: 'residencial', com: 'comercial', ind: 'industrial', esc: 'escritorio' };
    const itens = zona.zonasDaParte(parte).map((z) => ({
      id: z, acao: 'zona', nome: ZONAS[z].nome, glifo: fam[ZONAS[z].familia] ?? 'zonas', familia: ZONAS[z].familia, densidade: ZONAS[z].densidade,
      custo: 0, marco: ZONAS[z].marco, trancado: tranca(ZONAS[z].marco), dados: { zona: z },
    }));
    itens.push({ id: 'apagar', acao: 'zona', nome: null, glifo: 'apagar', custo: 0, marco: 0, trancado: false, dados: { apagar: true } });
    return { abas: null, itens };
  }
  if (cat === 'servicos' || cat === 'lazer' || cat === 'empresas') {
    const lista = consultar('catalogo', cat);
    const itens = (Array.isArray(lista) ? lista : []).map((x) => ({
      id: x.tipo, acao: 'colocar', nome: x.nome ?? x.tipo, glifo: x.glifo ?? GLIFO_CATEGORIA[cat], custo: x.custo ?? 0,
      marco: x.marcoLibera ?? x.marco ?? 0, trancado: x.liberado === false || tranca(x.marcoLibera ?? x.marco), aba: x.grupo ?? null, efeito: x.capacidade ?? null,
      dados: { item: { ...x } },
    }));
    const abas = [...new Set(itens.map((i) => i.aba).filter(Boolean))].map((id) => ({ id, rotulo: id }));
    return { abas: abas.length > 1 ? abas : null, itens };
  }
  return { abas: null, itens: [] };
}

/** Categorias visíveis (D24: categoria sem item fica fora da barra). Demolir sempre; Arcologia com o plano no espelho. */
export function categoriaVisivel(cat, { consultar = () => null, espelho = null } = {}) {
  if (cat === 'demolir' || cat === 'vias' || cat === 'zonas') return true;
  if (cat === 'arcologia') return !!(espelho?.arcologia?.plano || consultar('arcologia'));
  return itensDaCategoria(cat, { consultar }).itens.length > 0;
}

/** Anel e selo do botão da Arcologia: { progresso: 0..1, pode: bool }. */
export function estadoArcologia({ consultar = () => null, espelho = null } = {}) {
  const q = consultar('arcologia');
  const etapas = espelho?.arcologia?.etapas ?? [];
  const progresso = Number.isFinite(q?.progressoTotal) ? q.progressoTotal : etapas.length ? etapas.filter((e) => e.estado === ETAPA.PRONTA).length / etapas.length : 0;
  return { progresso: Math.max(0, Math.min(1, progresso)), pode: etapas.some((e) => e.estado === ETAPA.DISPONIVEL) };
}

// ------------------------------------------------------------------------------------------------ dica do fantasma

/** Números e dinheiro da dica no jeito da interface (dólar, metros com uma casa só se preciso, min de jogo). */
function parametrosDaDica(d, { t, fmt }) {
  const q = { ...d.params };
  const metros = (v) => fmt.numero(Math.round(v * 10) / 10, Math.round(v * 10) % 10 ? 1 : 0);
  if ('custo' in q) q.custo = fmt.dinheiro(q.custo);
  if ('faltam' in q) q.faltam = fmt.dinheiro(q.faltam);
  if ('tiques' in q) q.tempo = fmt.minutosDeJogo(q.tiques);
  for (const k of ['desnivel', 'max', 'afastar', 'm']) if (k in q) q[k] = metros(q[k]);
  if (q.recurso) {
    const nome = t(`ux1.recurso.${q.recurso}`);
    q.recurso = nome.startsWith('??') ? q.recurso : nome;
  }
  if ('marco' in q) q.marco = String(q.marco);
  return q;
}

/**
 * A dica de uma prévia da ferramenta de colocar (D98): { codigo, chave, tom: 'er' | 'info', colide, texto (o motivo e o
 * que fazer, para o painel), curto (o motivo curto do botão e da cota) } ou null. `ui` leva t e fmt.
 */
export function montarDica(p, ui) {
  const d = colocar.dicaDoBloqueio(p);
  if (!d) return null;
  const params = parametrosDaDica(d, ui);
  const curto = ui.t(d.chave.replace('.dica.', '.curto.'), params);
  return { codigo: d.codigo, chave: d.chave, tom: d.tom, colide: d.colide, texto: ui.t(d.chave, params), curto: curto.startsWith('??') ? null : curto };
}

/**
 * A dica de um traçado de via que não serve (D98): { codigo, texto, tom: 'er', colide: null } ou null. `m` é o motivo da
 * sessão ({ codigo, dados, trecho }); o declive diz a porcentagem do trecho e o máximo do tipo de via.
 */
export function dicaDaVia(m, previa, tipoVia, ui) {
  if (!m?.codigo || m.codigo === 'nada') return null;
  const via = VIAS[tipoVia];
  let chave = `ux1.dicaVia.${m.codigo}`;
  let params = {};
  if (m.codigo === 'declive') {
    const seg = previa?.segmentos?.[m.trecho ?? 0] ?? previa?.segmentos?.find((x) => x.erros?.includes?.('declive'));
    if (seg && Number.isFinite(seg.declive) && via?.declive) params = { p: Math.round(seg.declive * 100), max: Math.round(via.declive * 100) };
    else chave = 'ux1.dicaVia.declive.sem';
  } else if (m.codigo === 'creditos') params = { faltam: ui.fmt.dinheiro(m.dados?.faltam ?? 0) };
  else if (m.codigo === 'marco') {
    const n = via?.marco ?? 0;
    params = { marco: String(n), nome: MARCOS[n]?.nome ?? '' };
  }
  let texto = ui.t(chave, params);
  if (texto.startsWith('??')) texto = ui.t('ux1.dicaVia.outro');
  return { codigo: m.codigo, chave, tom: 'er', colide: null, texto, curto: null };
}

// ------------------------------------------------------------------------------------------------ cola

const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);

/** Liga a sessão à interface (ui/index.jsx chama na montagem). */
export function registrar(ui) {
  const { R, loja, t } = ui;
  const consultar = (...a) => ui.consultar(...a);
  const comando = (...a) => ui.comando(...a);
  const esp = () => ui.obterSim()?.espelho ?? null;

  let tipo = null;
  let maq = null;
  let id = 0;
  let pilha = criarPilha();
  let previa = null;
  let argsUlt = null;
  let item = null;
  let resumo = null;
  let info = null;
  let semEncaixe = false;
  let assinaturaEnc = '';
  let encaixe = null;
  let externo = null; // o último valor de loja.ferramenta que esta sessão conhece
  let traco = null; // zona: { n, grupos: Map(zona antiga → Set de células), avisou }
  let camadaAntes; // colocar liga a camada do serviço (item.camada) e devolve a de antes ao sair
  let rolagemPropria = true; // desliga se o render rolar pela borda sozinho
  let dica = null; // colocar: a dica do bloqueio (ou do aplainar) da prévia atual (D98)
  let camUlt = null;
  let tUlt = 0;
  let antesDoGesto = null; // a máquina antes do 'inicio' (volta a ela se o gesto virar câmera)
  let renderPaira = false; // o render manda o cursor parado ('move' com dedos 0): a sessão não repete o 'hover'
  let area = null; // área livre do mundo (sem a barra de cima e a da ferramenta), em px do canvas
  const ponteiro = { x: 0, y: 0, tipo: 'mouse' };
  const chave = () => chaveDaSessao(id);

  const cota = (x, z) => {
    const T = esp()?.terreno;
    return T?.altura ? alturaEm(T, x, z) : 0;
  };
  const amb = {
    projetar(p) {
      if (!R?.projetar) return null;
      const s = R.projetar([p[0], cota(p[0], p[1]), p[1]]);
      return s && Number.isFinite(s.x) && Number.isFinite(s.y) && (s.dist === undefined || s.dist > 0) ? [s.x, s.y] : null;
    },
  };
  // vibra só no toque (a vibração é do Android, desenho da UI 9.6) e depois de um toque de verdade na página
  const vibrar = (padrao) => {
    if (loja.prefs.value?.vibrar === false || ponteiro.tipo !== 'touch') return;
    try {
      if (typeof navigator === 'undefined' || !navigator.vibrate) return;
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      navigator.vibrate(padrao);
    } catch (e) {
      // sem vibração no aparelho
    }
  };
  const avisar = (texto, gravidade = 'atencao') => loja.avisar({ texto, gravidade });
  const marcoAtual = () => loja.barra.value?.marco?.n ?? 0;
  const livre = () => esp()?.partida?.modo === 'livre';

  // ---------------------------------------------------------------- publicar

  function valido() {
    if (!maq) return false;
    if (tipo === 'via') {
      if (maq.modo === 'melhorar') return !!previa?.ok;
      return !!(previa?.segmentos?.length && !previa.erros?.length && argsUlt);
    }
    if (tipo === 'colocar') return !!previa?.ok;
    if (tipo === 'demolir') return maq.marcados.length > 0;
    if (tipo === 'areas') return info?.estado === 'compravel';
    return true;
  }

  function motivo() {
    const e = primeiroErro(previa);
    if (tipo === 'colocar' && previa && !previa.ok) return { codigo: previa.codigo ?? 'outro', texto: dica?.curto ?? t(`x2.motivo.${previa.codigo ?? 'outro'}`), dados: previa.dados ?? undefined };
    if (!e) return null;
    const dados = e.dados ?? {};
    const texto = e.codigo === 'creditos' ? t('x2.motivo.creditos', { n: ui.fmt.creditos(dados.faltam ?? 0) }) : t(`x2.motivo.${e.codigo}`);
    return { codigo: e.codigo, texto: texto.startsWith('??') ? t('x2.motivo.outro') : texto, dados, trecho: e.trecho };
  }

  function publicar() {
    if (!maq) {
      sessao.value = null;
      return;
    }
    const m = motivo();
    sessao.value = {
      tipo,
      id,
      chave: chave(),
      maquina: maq,
      previa,
      valido: valido(),
      motivo: m?.texto ?? null,
      codigo: m?.codigo ?? null,
      erro: m,
      encaixe,
      desfazer: pilha.lista.length,
      item,
      resumo,
      info,
      substituto: !!previa?.substituto,
      dedo: !!maq.dedo,
      dica: tipo === 'colocar' ? dica : tipo === 'via' && m ? dicaDaVia(m, previa, maq.tipo, ui) : null,
    };
  }

  // ---------------------------------------------------------------- abrir e fechar

  function abrir(novoTipo, op = {}, { deFora = false } = {}) {
    if (!['via', 'zona', 'colocar', 'demolir', 'areas'].includes(novoTipo)) return false;
    if (tipo) fechar({ manterLoja: true });
    tipo = novoTipo;
    id++;
    pilha = criarPilha();
    previa = null;
    argsUlt = null;
    resumo = null;
    info = null;
    encaixe = null;
    assinaturaEnc = '';
    dica = null;
    colidindo = '';
    item = op.item ?? null;
    if (tipo === 'via') maq = via.criarVia({ tipo: op.tipoVia ?? 'rua', modo: op.modo ?? 'reta', continua: op.continua, encaixe: op.encaixe });
    else if (tipo === 'zona') maq = zona.criarZona({ zona: op.zona ?? 'resBaixa', modo: op.modo ?? 'preencher', tamanho: op.tamanho, apagar: op.apagar });
    else if (tipo === 'colocar') maq = colocar.criarColocar({ tipo: item?.tipo ?? op.tipoColocavel, item });
    else if (tipo === 'demolir') maq = demolir.criarDemolir();
    else maq = areas.criarAreas();
    R?.entrada?.modo?.('ferramenta');
    R?.entrada?.opcoes?.({ deslocY: loja.prefs.value?.mira ?? MIRA_PX, bordaPx: BORDA_PX });
    if (tipo === 'zona') R?.ferramenta?.zona?.mostrar?.(true);
    if (tipo === 'areas') R?.ferramenta?.ladrilhos?.(true);
    // colocar um serviço mostra a cobertura atual em volta: a camada dele (X3a desenha pela loja)
    camadaAntes = undefined;
    if (tipo === 'colocar' && item?.camada && loja.camada.value !== item.camada) {
      camadaAntes = loja.camada.value;
      loja.camada.value = item.camada;
    }
    // a ferramenta ocupa a barra de baixo: recolhe a bandeja e o cartão do selecionado
    batch(() => {
      categoria.value = null;
      loja.selecao.value = null;
      if (!deFora) {
        externo = { tipo, ...op };
        loja.ferramenta.value = externo;
      }
    });
    R?.selecionado?.(null);
    if (tipo === 'areas') atualizarAreas();
    publicar();
    return true;
  }

  function fechar({ manterLoja = false } = {}) {
    if (!tipo) return;
    const era = tipo;
    // a máquina sai antes de avisar o render: com um gesto em curso, trocar o modo manda um 'fim' cancelado, e ele não
    // pode redesenhar a prévia depois do limpar
    tipo = null;
    maq = null;
    previa = null;
    dica = null;
    colidindo = '';
    antesDoGesto = null;
    R?.entrada?.modo?.('camera');
    R?.ferramenta?.limpar?.();
    if (era === 'zona') R?.ferramenta?.zona?.mostrar?.(false);
    if (era === 'areas') R?.ferramenta?.ladrilhos?.(false);
    // a área livre medida com a barra da ferramenta não vale mais (a rolagem pela borda do mouse usa a tela inteira)
    if (area) R?.entrada?.opcoes?.({ area: null });
    area = null;
    if (camadaAntes !== undefined) {
      loja.camada.value = camadaAntes;
      camadaAntes = undefined;
    }
    vivo.apoiado = false;
    vivo.mira = null;
    batch(() => {
      sessao.value = null;
      if (!manterLoja && loja.ferramenta.value) {
        externo = null;
        loja.ferramenta.value = null;
      }
    });
  }

  // ---------------------------------------------------------------- passo e efeitos

  function passo(ev) {
    if (!maq) return;
    if (tipo === 'via') maq = via.passoVia(maq, ev, amb);
    else if (tipo === 'zona') maq = zona.passoZona(maq, ev);
    else if (tipo === 'colocar') maq = colocar.passoColocar(maq, ev);
    else if (tipo === 'demolir') maq = demolir.passoDemolir(maq, ev);
    else if (tipo === 'areas') maq = areas.passoAreas(maq, ev, { origem: esp()?.mapa?.origem ?? [-4096, -4096] });
    const efeitos = maq.efeitos;
    for (const x of efeitos) {
      const nome = via.nomeEfeito(x);
      if (nome === 'sair') {
        fechar();
        return;
      }
      try {
        if (tipo === 'via') efeitoVia(nome, x, ev);
        else if (tipo === 'zona') efeitoZona(nome, x);
        else if (tipo === 'colocar') efeitoColocar(nome, x);
        else if (tipo === 'demolir') efeitoDemolir(nome, x);
        else if (tipo === 'areas') efeitoAreas(nome);
      } catch (e) {
        console.error('ferramenta: efeito falhou', nome, e);
      }
      if (!maq) return;
    }
    // o mouse passando sem mudar nada não redesenha a barra (a mira da lupa e das cotas vem de `vivo`)
    if ((ev.tipo === 'hover' || ev.tipo === 'move') && !efeitos.length) return;
    publicar();
  }

  // aresta sob o ponto: q.viasPerto da S1b (a mais perto primeiro) ou, sem ela, a busca no espelho
  function arestaSob(ponto, raio) {
    if (!ponto) return null;
    const l = consultar('viasPerto', ponto[0], ponto[1], raio);
    if (Array.isArray(l) && l.length) {
      const m = l.reduce((a, b) => ((b.d ?? Infinity) < (a.d ?? Infinity) ? b : a));
      return m.ref ?? null;
    }
    return via.arestaPerto(esp(), ponto, raio)?.ref ?? null;
  }

  // ---------------- via

  function efeitoVia(nome, x, ev) {
    if (nome === 'limpar') {
      previa = null;
      argsUlt = null;
      encaixe = null;
      assinaturaEnc = '';
      R?.ferramenta?.via?.previa?.(null);
      return;
    }
    if (nome === 'previa') return previaVia(ev);
    if (nome === 'escolher') {
      const sel = x.tela && R?.selecionar ? R.selecionar(x.tela[0], x.tela[1]) : null;
      let ref = sel?.tipo === 'aresta' ? sel.ref : null;
      if (ref === null) ref = arestaSob(x.ponto, toleranciaEmMetros(R, x.tela));
      if (ref !== null) passo({ tipo: 'aresta', ref, somar: x.somar });
    }
  }

  function previaVia(ev) {
    const m = maq;
    const e = esp();
    if (m.modo === 'melhorar') {
      // a prévia da simulação (declive, colisão, marco, demolições e créditos); sem ela, a estimativa pelo espelho
      const r = m.selecao.length ? consultar('via.previa', { modo: 'melhorar', tipo: m.tipo, arestas: [...m.selecao], sessao: chave() }) : null;
      previa = r && Array.isArray(r.arestas) ? { ...r, segmentos: r.segmentos ?? [], erros: r.erros ?? [] } : via.previaMelhorar(e, m.selecao, m.tipo);
      const cred = loja.barra.value?.creditos ?? Infinity;
      if (previa.custo > cred && !previa.erros.some((x) => (x.codigo ?? x) === 'creditos')) {
        previa = { ...previa, ok: false, erros: [{ codigo: 'creditos', dados: { faltam: previa.custo - cred } }, ...previa.erros] };
      }
      R?.ferramenta?.via?.previa?.(previa.segmentos.length ? previa : null, previa.ok ? 'normal' : 'invalido');
      return;
    }
    const tela = m.mira?.tela ?? null;
    const tol = toleranciaEmMetros(R, tela);
    const args = via.argsPrevia(m, { tolerancia: tol, sessao: chave(), semEncaixe });
    if (!args) {
      argsUlt = null;
      if (m.a && (m.fase === 'mirandoA' || m.fase === 'aFixo')) {
        const so = { modo: 'reta', tipo: m.tipo, pontos: [m.a], tolerancia: tol, encaixe: m.encaixe && !semEncaixe, sessao: chave() };
        const r = consultar('via.previa', so);
        previa = r && Array.isArray(r.encaixes) ? { ...r, segmentos: [] } : via.planejarLocal(so, e);
      } else previa = null;
      R?.ferramenta?.via?.previa?.(null);
    } else {
      const r = consultar('via.previa', args);
      previa = r && (r.segmentos?.length || r.erros?.length) ? r : via.planejarLocal(args, e);
      argsUlt = args;
      const cred = loja.barra.value?.creditos;
      if (Number.isFinite(cred) && previa.custo > cred && !previa.erros?.some((x) => (x.codigo ?? x) === 'creditos')) {
        previa = { ...previa, ok: false, erros: [...(previa.erros ?? []), { codigo: 'creditos', dados: { faltam: previa.custo - cred } }] };
      }
      R?.ferramenta?.via?.previa?.(previa, previa.erros?.length ? 'invalido' : 'normal');
    }
    // chip do encaixe no ponto que se move, com vibração quando muda
    const movel = m.fase === 'mirandoA' ? m.a : m.fase === 'arrastando' ? (m.alca === 'a' ? m.a : m.b) : m.b ?? m.a;
    const enc = previa && m.encaixe && !semEncaixe ? escolherEncaixe(previa.encaixes, movel, 1.5 * tol + 8) : null;
    const assinatura = enc && enc.tipo !== 'comprimento' ? `${enc.tipo}:${enc.valor}` : '';
    if (assinatura && assinatura !== assinaturaEnc && m.dedo) {
      vibrar(VIBRA.encaixe);
      vivo.estalo = agora();
    }
    assinaturaEnc = assinatura;
    encaixe = enc && enc.tipo !== 'comprimento' ? { ...enc, texto: t(`x2.enc.${enc.tipo}`, { v: enc.valor }) } : null;
    // soltou: as alças passam para os pontos encaixados
    if (ev?.tipo === 'fim' && previa) {
      const segs = previa.segmentos ?? [];
      if (m.fase === 'previa' && segs.length && m.modo !== 'grade') {
        const s0 = segs[0].p;
        const s1 = segs[segs.length - 1].p;
        maq = via.passoVia(maq, { tipo: 'ajustar', a: [s0[0], s0[1]], b: [s1[6], s1[7]] }, amb);
      } else if (m.fase === 'aFixo' && !m.b) {
        const ea = (previa.encaixes ?? []).find((x) => (x.tipo === 'no' || x.tipo === 'aresta') && x.ponto);
        if (ea) maq = via.passoVia(maq, { tipo: 'ajustar', a: ea.ponto }, amb);
      }
    }
  }

  async function construirVia() {
    const aberta = id;
    if (maq.modo === 'melhorar') {
      if (!valido()) return recusar();
      const refs = previa.arestas.filter((a) => a.ok).map((a) => a.ref);
      // com a sessão: a simulação guarda a melhoria para o via.desfazer desta sessão
      const sid = chave();
      const r = await comando('via.melhorar', { arestas: refs, tipo: maq.tipo, sessao: sid });
      if (!r.ok) return vibrar(VIBRA.erro);
      vibrar(VIBRA.confirmar);
      if (id !== aberta || !maq) return; // a ferramenta fechou ou trocou enquanto o comando corria
      empilhar(pilha, { tipo: 'via', desfazer: () => comando('via.desfazer', { sessao: sid }) });
      passo({ tipo: 'construido' });
      return;
    }
    if (!valido()) return recusar();
    const args = argsUlt;
    const plano = previa;
    // o desfazer vai pela mesma sessão que o plano levou (a simulação guarda a ação com ela)
    const sid = args.sessao ?? chave();
    const r = await comando('via.construir', { plano: { ...args, sessao: sid } });
    if (!r.ok) return vibrar(VIBRA.erro);
    vibrar(VIBRA.confirmar);
    if (id !== aberta || !maq) return;
    empilhar(pilha, { tipo: 'via', desfazer: () => comando('via.desfazer', { sessao: sid }) });
    const fim = via.fimDoPlano(plano);
    passo({ tipo: 'construido', ...(fim ?? {}) });
  }

  function recusar() {
    vibrar(VIBRA.erro);
    const m = motivo();
    if (m) avisar(t(`codigo.${m.codigo}`, m.dados ?? null).startsWith('??') ? m.texto : t(`codigo.${m.codigo}`, m.dados ?? null));
  }

  // ---------------- zona

  const zonaIdx = () => zona.zonaAplicada(maq);

  function previaZona(pincel) {
    const z = zonaIdx();
    const r = consultar('zona.previa', { pincel, zona: z });
    return r && r.celulas ? r : zona.previaZonaLocal(esp(), pincel, z);
  }

  function efeitoZona(nome, x) {
    if (nome === 'limpar') {
      previa = null;
      R?.ferramenta?.pincel?.(null);
      R?.ferramenta?.zona?.celulas?.(new Int32Array(0), zonaIdx());
      return;
    }
    if (nome === 'previa') {
      if (!x.pincel) {
        previa = null;
        R?.ferramenta?.pincel?.(maq.mira?.ponto ? { x: maq.mira.ponto[0], z: maq.mira.ponto[1], raio: 0 } : null);
        R?.ferramenta?.zona?.celulas?.(new Int32Array(0), zonaIdx());
        return;
      }
      previa = previaZona(x.pincel);
      const p = x.pincel;
      const cx = p.modo === 'retangulo' ? (p.x + p.x2) / 2 : p.x;
      const cz = p.modo === 'retangulo' ? (p.z + p.z2) / 2 : p.z;
      R?.ferramenta?.pincel?.({ x: cx, z: cz, raio: p.modo === 'circulo' ? p.raio : 0, forma: p.modo, x2: p.x2, z2: p.z2, x1: p.x, z1: p.z });
      R?.ferramenta?.zona?.celulas?.(previa.celulas, zonaIdx());
      return;
    }
    if (nome === 'pintar') {
      const z = zonaIdx();
      const pv = previaZona(x.pincel);
      const cel = pv.celulas ?? [];
      if (!cel.length && x.pincel.modo !== 'quadra') return;
      const antigas = zona.zonasAntigas(esp(), cel);
      if (!traco || traco.n !== x.traco) traco = { n: x.traco, grupos: new Map(), avisou: false };
      const tr = traco;
      comando('zona.pintar', { pincel: x.pincel, zona: z }, { silencioso: true }).then((r) => {
        if (r.ok) {
          for (const [zAnt, lista] of antigas) {
            if (zAnt === z) continue;
            if (!tr.grupos.has(zAnt)) tr.grupos.set(zAnt, new Set());
            const g = tr.grupos.get(zAnt);
            // a primeira zona antiga de cada célula é a que o Desfazer devolve
            for (const c of lista) if (![...tr.grupos.values()].some((s) => s !== g && s.has(c))) g.add(c);
          }
        } else if (r.codigo !== 'nada' && !tr.avisou) {
          tr.avisou = true;
          vibrar(VIBRA.erro);
          avisar(ui.frase(r));
        }
      });
      return;
    }
    if (nome === 'fimTraco') {
      const tr = traco;
      traco = null;
      // o comando já resolveu (a simulação aplica na hora); junta o traço numa ação
      Promise.resolve().then(() => {
        if (!tr || !tr.grupos.size || !maq) return;
        const grupos = [...tr.grupos].map(([z, s]) => [z, [...s]]);
        empilhar(pilha, {
          tipo: 'zona',
          desfazer: async () => {
            let ok = true;
            for (const [z, celulas] of grupos) {
              const r = await comando('zona.pintar', { pincel: { modo: 'celulas', celulas }, zona: z }, { silencioso: true });
              ok = ok && r.ok;
            }
            return { ok };
          },
        });
        publicar();
      });
    }
  }

  // ---------------- colocar

  /** A parte que colide fica em vermelho no mundo (o mesmo realce do demolir): a via ou o prédio da recusa. */
  let colidindo = '';
  function realcarColisao() {
    const c = dica?.colide;
    const chave = c ? `${c.com}:${c.ref}` : '';
    if (chave === colidindo) return;
    colidindo = chave;
    R?.ferramenta?.demolir?.(c ? [{ tipo: c.com === 'via' ? 'aresta' : 'predio', ref: c.ref }] : []);
  }

  function efeitoColocar(nome, x) {
    if (nome !== 'previa') return;
    // aplainar: a interface mostra o custo na dica e quem aperta Construir aceita pagá-lo
    const args = { tipo: maq.tipo, x: x.x, z: x.z, rot: x.rot, giro: x.giro, alinhar: x.alinhar, aplainar: true };
    const r = consultar('construir.previa', args);
    previa = r && Number.isFinite(r.x) ? { ...r } : colocar.previaColocarLocal(esp(), args, item);
    const cred = loja.barra.value?.creditos;
    if (previa.ok && Number.isFinite(cred) && (previa.custo ?? 0) > cred) previa = { ...previa, ok: false, codigo: 'creditos', faltam: previa.custo - cred, dados: { faltam: previa.custo - cred } };
    // a rotação efetiva (a da via, quando alinhada) volta para a máquina: sair do ímã da via mantém o ângulo do fantasma
    if (previa.alinhado && Number.isFinite(previa.rot) && (Math.abs(previa.rot - maq.rot) > 1e-9 || Math.abs((previa.giro ?? maq.giro) - maq.giro) > 1e-9)) {
      maq = { ...maq, rot: previa.rot, giro: Number.isFinite(previa.giro) ? previa.giro : maq.giro };
    }
    dica = montarDica(previa, ui);
    R?.ferramenta?.fantasma?.({ tipo: maq.tipo, x: previa.x, z: previa.z, rot: previa.rot, alcance: previa.alcance ?? item?.alcance ?? 0, ok: !!previa.ok, pegada: colocar.pegadaDe(maq.tipo, item) });
    realcarColisao();
  }

  async function construirColocar() {
    if (!valido()) {
      vibrar(VIBRA.erro);
      // o aviso diz o motivo e o que fazer (a dica do fantasma); sem ela, a frase do código
      if (previa?.codigo) avisar(dica?.texto ?? t(`codigo.${previa.codigo}`));
      return;
    }
    const aberta = id;
    // alinhar: o comando gruda de novo como a prévia; livre: a planta fica exatamente onde o fantasma está
    const r = await comando('construir', { tipo: maq.tipo, x: previa.x, z: previa.z, rot: previa.rot, alinhar: !!previa.alinhado, aplainar: true, ...(Number.isFinite(previa.giro) ? { giro: previa.giro } : {}) });
    if (!r.ok) return vibrar(VIBRA.erro);
    vibrar(VIBRA.confirmar);
    if (id !== aberta || !maq) return;
    // o Desfazer demole pela ref do prédio criado; sem ela na resposta, não há o que desfazer
    const ref = refCriada(r);
    if (ref !== null) empilhar(pilha, { tipo: 'colocar', desfazer: () => comando('demolir', { refs: [ref] }) });
    // a mesma planta de novo, para a prévia saber que ali agora tem um prédio
    passo({ tipo: 'hover', ponto: [previa.x, previa.z], tela: maq.mira?.tela ?? null });
  }

  // ---------------- demolir

  function efeitoDemolir(nome, x) {
    if (nome === 'escolher') {
      const sel = x.tela && R?.selecionar ? R.selecionar(x.tela[0], x.tela[1]) : null;
      let alvo = sel && ['predio', 'colocavel', 'aresta', 'arcologia'].includes(sel.tipo) ? demolir.alvoDe(esp(), sel) : null;
      if (!alvo) {
        const ref = arestaSob(x.ponto, toleranciaEmMetros(R, x.tela, 12));
        if (ref !== null) alvo = demolir.alvoDe(esp(), { tipo: 'aresta', ref });
      }
      if (alvo) passo({ tipo: 'alvo', alvo, somar: x.somar });
      return;
    }
    if (nome === 'recusa') {
      vibrar(VIBRA.erro);
      avisar(t(`codigo.${x.codigo}`));
      return;
    }
    if (nome === 'marcas') {
      R?.ferramenta?.demolir?.(demolir.marcasParaRender(maq));
      resumo = demolir.resumoDemolir(esp(), maq);
      // quanto as vias devolvem de verdade (a simulação sabe o que é da sessão); sem a consulta, a estimativa de 50%
      const { arestas } = demolir.refsMarcadas(maq);
      const r = arestas.length ? consultar('via.previa', { modo: 'demolir', arestas, sessao: chave() }) : null;
      if (Number.isFinite(r?.devolve)) resumo = { ...resumo, voltaVias: Math.round(r.devolve) };
    }
  }

  async function confirmarDemolir() {
    if (!maq.marcados.length) return;
    const { predios, arestas } = demolir.refsMarcadas(maq);
    const aberta = id;
    let algum = false;
    if (arestas.length) {
      // com a sessão: a simulação guarda a demolição para o via.desfazer desta sessão (sem ela o desfazer não acha)
      const sid = chave();
      const r = await comando('via.demolir', { arestas, sessao: sid });
      if (r.ok) {
        algum = true;
        if (id === aberta) empilhar(pilha, { tipo: 'via', desfazer: () => comando('via.desfazer', { sessao: sid }) });
      }
    }
    if (predios.length) {
      const r = await comando('demolir', { refs: predios });
      if (r.ok) algum = true;
    }
    vibrar(algum ? VIBRA.confirmar : VIBRA.erro);
    if (algum && id === aberta) passo({ tipo: 'feito' });
  }

  // ---------------- áreas

  function tabelaLadrilhos() {
    const q = consultar('ladrilhos');
    return q?.estado ? q : esp()?.ladrilhos ?? null;
  }
  function atualizarAreas() {
    const tab = tabelaLadrilhos();
    const desc = consultar('holding')?.efeitos?.descontoLadrilho ?? 0;
    info = maq?.sel ? areas.infoLadrilho(tab, maq.sel[0], maq.sel[1], desc) : null;
    resumo = { compraveis: areas.compraveis(tab), desconto: desc };
  }
  function efeitoAreas(nome) {
    if (nome === 'escolheu') atualizarAreas();
  }
  async function comprar() {
    if (tipo !== 'areas' || !maq?.sel) return;
    if (!valido()) return vibrar(VIBRA.erro);
    const [i, j] = maq.sel;
    const r = await comando('ladrilho.comprar', { i, j });
    if (!r.ok) return vibrar(VIBRA.erro);
    vibrar(VIBRA.confirmar);
    avisar(t('x2.areas.comprada'), 'info');
    passo({ tipo: 'comprado' });
  }

  // ---------------------------------------------------------------- ações públicas

  async function desfazer() {
    if (!maq) return;
    const a = desempilhar(pilha);
    if (!a) {
      avisar(t('x2.nadaDesfazer'), 'info');
      publicar();
      return;
    }
    const r = await a.desfazer();
    if (r && r.ok === false) vibrar(VIBRA.erro);
    else vibrar(VIBRA.confirmar);
    // a prévia volta a olhar o mundo desfeito
    if (tipo === 'via') previaVia(null);
    if (tipo === 'demolir') resumo = demolir.resumoDemolir(esp(), maq);
    publicar();
  }

  function construir() {
    if (!maq) return;
    if (tipo === 'via') return construirVia();
    if (tipo === 'colocar') return construirColocar();
    if (tipo === 'demolir') return confirmarDemolir();
    if (tipo === 'areas') return comprar();
    if (tipo === 'zona') return fechar(); // Pronto: a pintura já vale
    return null;
  }

  Object.assign(ferramentas, {
    abrir: (tp, op = {}) => abrir(tp, op),
    fechar: () => fechar(),
    cancelar: () => passo({ tipo: 'cancelar' }),
    construir,
    desfazer,
    opcao(op) {
      if (!maq) return;
      if (tipo === 'via') passo({ tipo: 'opcao', ...op });
      else if (tipo === 'zona') passo({ tipo: 'opcao', ...op });
    },
    /** Gira o fantasma: o botão vira um quarto de volta; `passo` (radianos) dá outro, como os 15 graus de Q e E. */
    girar: (sentido = 1, passoRad = null) => (tipo === 'colocar' ? passo({ tipo: 'girar', sentido, ...(passoRad > 0 ? { passo: passoRad } : {}) }) : undefined),
    /** O puxador: aponta a frente do fantasma para a rotação absoluta `alvo` (radianos), com o ímã de 15 graus ou livre. */
    girarPara(alvo, { livre = false } = {}) {
      if (tipo !== 'colocar' || !maq || !Number.isFinite(alvo)) return;
      const ima = (r) => (livre ? colocar.normalizarRot(r) : colocar.imantar(r));
      // alinhado: o ímã vale para o ângulo em relação à via (0 é de frente para ela); livre: para o azimute
      if (previa?.alinhado && Number.isFinite(previa.rotVia)) {
        const giro = ima(alvo - previa.rotVia);
        passo({ tipo: 'angulo', rot: colocar.normalizarRot(previa.rotVia + giro), giro });
      } else passo({ tipo: 'angulo', rot: ima(alvo) });
    },
    /** Liga ou desliga o alinhar à via (sem valor, troca); desligando, o fantasma fica no ângulo que já tinha. */
    alinhar(valor) {
      if (tipo !== 'colocar' || !maq) return;
      passo({ tipo: 'alinhar', ...(typeof valor === 'boolean' ? { valor } : {}), ...(Number.isFinite(previa?.rot) ? { rot: previa.rot } : {}) });
    },
    comprar,
    escolherCategoria(cat) {
      if (cat === 'demolir') {
        if (tipo === 'demolir') fechar();
        else abrir('demolir');
        return;
      }
      if (cat === 'arcologia') {
        categoria.value = null;
        const telas = ui.telas();
        ui.abrirTela(telas.includes('arcologia') ? 'arcologia' : telas.includes('livroArcologia') ? 'livroArcologia' : 'arcologia');
        return;
      }
      categoria.value = categoria.value === cat ? null : cat;
    },
    /** Cartão da bandeja escolhido: abre a ferramenta certa (ou troca a opção da que está aberta). */
    escolherItem(cartao) {
      if (!cartao || cartao.trancado) return;
      if (cartao.acao === 'via') {
        if (tipo === 'via') {
          passo({ tipo: 'opcao', tipoVia: cartao.dados.tipoVia });
          categoria.value = null;
        } else abrir('via', { tipoVia: cartao.dados.tipoVia });
      } else if (cartao.acao === 'zona') {
        const op = cartao.dados.apagar ? { apagar: true } : { zona: cartao.dados.zona, apagar: false };
        if (tipo === 'zona') {
          passo({ tipo: 'opcao', ...op });
          categoria.value = null;
        } else abrir('zona', op);
      } else if (cartao.acao === 'colocar') abrir('colocar', { item: cartao.dados.item });
    },
    /** Mouse: Shift segurado desliga o encaixe. */
    semEncaixe(b) {
      if (semEncaixe === !!b) return;
      semEncaixe = !!b;
      if (tipo === 'via') {
        previaVia(null);
        publicar();
      }
    },
    /** Para testes e cenas: um evento direto na máquina (o mesmo formato da entrada). */
    evento: (ev) => passo(ev),
    estado: () => ({ tipo, maquina: maq, previa, pilha: pilha.lista.length, id }),
  });

  // ---------------------------------------------------------------- entrada

  /** Área livre do mundo em px do canvas: abaixo da barra de cima e acima da barra da ferramenta (a rolagem pela borda). */
  function medirArea() {
    if (typeof document === 'undefined' || typeof innerWidth === 'undefined') return null;
    const W = innerWidth;
    const H = innerHeight;
    const c = document.getElementById('mundo')?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    let topo = 0;
    let fundo = H;
    for (const el of document.querySelectorAll('[data-hud^="cima"]')) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom < H / 2) topo = Math.max(topo, r.bottom);
    }
    const barra = document.querySelector('[data-hud="ferramenta"]')?.getBoundingClientRect();
    if (barra?.height > 0 && barra.top > H / 2) fundo = barra.top;
    return { x: -c.left, y: topo - c.top, w: W, h: Math.max(1, fundo - topo) };
  }

  /**
   * O gesto virou câmera (um segundo dedo chegou depois dos 80 ms: o render manda o 'fim' com cancelado): nada do que
   * o primeiro dedo fez vale. Via e demolir voltam ao estado de antes do toque; Preencher e Retângulo não pintam; o
   * traço do pincel já pintou e fecha como um fim normal (o Desfazer volta); Áreas não escolhe.
   */
  function cancelarGesto(ev) {
    const antes = antesDoGesto;
    antesDoGesto = null;
    if (tipo === 'zona') {
      if (maq.modo === 'pincel') passo(ev);
      else if (maq.dedo) passo({ tipo: 'cancelar' });
      return;
    }
    if (tipo === 'colocar') return passo(ev);
    if (tipo === 'areas' || !antes) return;
    maq = { ...antes, dedo: false, mira: maq.mira, efeitos: [] };
    if (tipo === 'via') previaVia(null);
    else if (tipo === 'demolir') efeitoDemolir('marcas');
    publicar();
  }

  const soltarEntrada = [];
  if (R?.entrada?.aoFerramenta) {
    R.entrada.aoFerramenta(({ fase, x, y, ponto, dedos, tipo: disp, dedoX, dedoY, cancelado }) => {
      if (!maq) return;
      // o render diz o aparelho e onde está o dedo; sem isso (a entrada básica), o último ponteiro da página
      if (disp) ponteiro.tipo = disp === 'toque' ? 'touch' : disp === 'caneta' ? 'pen' : 'mouse';
      const toque = ponteiro.tipo === 'touch' || ponteiro.tipo === 'pen';
      const dedo = Number.isFinite(dedoX) && Number.isFinite(dedoY) ? [dedoX, dedoY] : toque ? [ponteiro.x, ponteiro.y] : [x, y];
      const chao = ponto ? [ponto[0], ponto[2]] : null;
      // o cursor parado ('move' sem dedo nem botão) é passar o mouse: não apoia nada (nem lupa, nem rolagem pela borda)
      if (fase === 'move' && dedos === 0) {
        renderPaira = true;
        vivo.mira = [x, y];
        vivo.toque = false;
        vivo.apoiado = false;
        passo({ tipo: 'hover', ponto: chao, tela: [x, y], t: agora() });
        return;
      }
      vivo.mira = [x, y];
      vivo.dedo = dedo;
      vivo.toque = toque;
      vivo.apoiado = fase !== 'fim';
      vivo.mpp = metrosPorPixel(R, [x, y], vivo.mpp);
      if (fase === 'fim') camUlt = null;
      if (fase === 'inicio') {
        antesDoGesto = maq;
        area = medirArea() ?? area;
        if (area) R.entrada.opcoes?.({ area });
      }
      const ev = { tipo: fase, ponto: chao, tela: [x, y], dedo, t: agora() };
      if (fase === 'fim' && cancelado) return cancelarGesto(ev);
      if (fase === 'fim') antesDoGesto = null;
      passo(ev);
    });
  }
  // giro com dois dedos sobre o fantasma (D98): quando a entrada do render oferecer o gesto (pedido ao TOQ1: R.entrada.
  // aoGiroDeFerramenta(({ delta, fim })), com delta o ângulo acumulado do gesto em radianos), a planta gira com o ímã
  if (R?.entrada?.aoGiroDeFerramenta) {
    let base = null;
    R.entrada.aoGiroDeFerramenta(({ delta, fim }) => {
      if (tipo !== 'colocar' || !maq || !Number.isFinite(delta)) return;
      if (base === null) base = maq.rot;
      ferramentas.girarPara(base + delta);
      if (fim) base = null;
    });
  }
  if (typeof addEventListener !== 'undefined') {
    const canvas = () => (typeof document !== 'undefined' ? document.getElementById('mundo') : null);
    const rel = (ev) => {
      const c = canvas();
      const r = c?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
      return [ev.clientX - r.left, ev.clientY - r.top];
    };
    const aoPonteiro = (ev) => {
      const [x, y] = rel(ev);
      ponteiro.x = x;
      ponteiro.y = y;
      ponteiro.tipo = ev.pointerType || 'mouse';
      // mouse sem botão sobre o mundo: a prévia segue o cursor (clique em A e clique em B, como no CS2)
      if (ev.type === 'pointermove' && !renderPaira && maq && ev.pointerType === 'mouse' && !ev.buttons && ev.target === canvas() && R?.raio) {
        const p = R.raio(x, y);
        vivo.mira = [x, y];
        vivo.toque = false;
        passo({ tipo: 'hover', ponto: p ? [p[0], p[2]] : null, tela: [x, y], t: agora() });
      }
    };
    addEventListener('pointerdown', aoPonteiro, { capture: true, passive: true });
    addEventListener('pointermove', aoPonteiro, { capture: true, passive: true });
    soltarEntrada.push(() => {
      removeEventListener('pointerdown', aoPonteiro, { capture: true });
      removeEventListener('pointermove', aoPonteiro, { capture: true });
    });

    // teclado do PC (desenho da UI 9.5)
    const alvoTexto = (ev) => ev.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.isContentEditable);
    const tecla = (ev) => {
      if (alvoTexto(ev) || loja.tela.value) return;
      if (ev.key === 'Shift') return ferramentas.semEncaixe(true);
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'z' || ev.key === 'Z')) {
        if (!maq) return;
        ev.preventDefault();
        desfazer();
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Escape') {
        if (maq) {
          ev.preventDefault();
          passo({ tipo: 'cancelar' });
        } else if (categoria.value) {
          ev.preventDefault();
          categoria.value = null;
        }
        return;
      }
      if (ev.key === 'Enter' && maq) {
        ev.preventDefault();
        construir();
        return;
      }
      if ((ev.key === ',' || ev.key === '.') && tipo === 'colocar') {
        passo({ tipo: 'girar', sentido: ev.key === ',' ? -1 : 1 });
        return;
      }
      if ((ev.key === 'c' || ev.key === 'C') && tipo === 'colocar' && !ev.repeat) {
        ferramentas.alinhar();
        return;
      }
      const k = ev.key.length === 1 ? ev.key.toUpperCase() : '';
      const cat = Object.keys(ATALHOS).find((c) => ATALHOS[c] === k);
      if (cat && !ev.repeat) {
        const visivel = categoriaVisivel(cat, { consultar, espelho: esp() });
        if (visivel) {
          if (maq && cat !== 'demolir') fechar();
          ferramentas.escolherCategoria(cat);
        }
      }
    };
    const soltaTecla = (ev) => {
      if (ev.key === 'Shift') ferramentas.semEncaixe(false);
    };
    const perdeu = () => ferramentas.semEncaixe(false);
    // Q e E giram o fantasma de 15 em 15 graus com a ferramenta de colocar aberta; a câmera também gira com eles (render/
    // camera/entrada.js), por isso este ouvinte vai na captura e tira a tecla do caminho dela (também no repeat do teclado)
    const giroDeTecla = (ev) => {
      if (tipo !== 'colocar' || !maq || alvoTexto(ev) || loja.tela.value || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key?.toLowerCase();
      if (k !== 'q' && k !== 'e') return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      passo({ tipo: 'girar', sentido: k === 'q' ? -1 : 1, passo: colocar.PASSO_IMA });
    };
    addEventListener('keydown', giroDeTecla, true);
    addEventListener('keydown', tecla);
    addEventListener('keyup', soltaTecla);
    addEventListener('blur', perdeu);
    soltarEntrada.push(() => {
      removeEventListener('keydown', giroDeTecla, true);
      removeEventListener('keydown', tecla);
      removeEventListener('keyup', soltaTecla);
      removeEventListener('blur', perdeu);
    });
  }

  // loja.ferramenta aberta por outra parcela (menu de contexto, Progresso, objetivo)
  const soltarEfeito = effect(() => {
    const f = loja.ferramenta.value;
    if (f === externo) return;
    externo = f;
    if (!f) {
      if (tipo) fechar({ manterLoja: true });
      return;
    }
    abrir(f.tipo, f, { deFora: true });
  });

  // ---------------------------------------------------------------- quadro: rolagem pela borda

  ui.aoQuadro((tMs) => {
    const dt = tUlt ? Math.min(0.1, (tMs - tUlt) / 1000) : 0;
    tUlt = tMs;
    if (!maq || !vivo.apoiado || !vivo.dedo || !R?.camera || !(dt > 0)) {
      camUlt = null;
      return;
    }
    if (!rolagemPropria) return;
    const W = typeof innerWidth !== 'undefined' ? innerWidth : 986;
    const H = typeof innerHeight !== 'undefined' ? innerHeight : 443;
    const livre = area ? { x0: area.x, y0: area.y, x1: area.x + area.w, y1: area.y + area.h } : { x0: 8, y0: 56, x1: W - 8, y1: H - 80 };
    const v = velocidadeBorda(vivo.dedo, livre);
    if (!v) {
      camUlt = null;
      return;
    }
    const e = R.camera.estado();
    // o render já rola pela borda (R1b): a câmera andou sem a gente desde o último quadro
    if (camUlt && (Math.abs(e.x - camUlt.x) > 0.01 || Math.abs(e.z - camUlt.z) > 0.01)) {
      rolagemPropria = false;
      camUlt = null;
      return;
    }
    // direita no chão (cos g, sen g) e frente (sen g, -cos g); a borda de baixo (vy > 0) anda para trás
    const g = (e.guinada * Math.PI) / 180;
    const vel = 700 * vivo.mpp * dt; // 700 px por segundo na borda
    const dx = (v[0] * Math.cos(g) - v[1] * Math.sin(g)) * vel;
    const dz = (v[0] * Math.sin(g) + v[1] * Math.cos(g)) * vel;
    const novo = { ...e, x: e.x + dx, z: e.z + dz };
    R.camera.definir(novo);
    camUlt = R.camera.estado();
    // o chão sob a mira mudou: a ferramenta recebe um movimento
    const p = vivo.mira && R.raio ? R.raio(vivo.mira[0], vivo.mira[1]) : null;
    if (p) passo({ tipo: 'move', ponto: [p[0], p[2]], tela: vivo.mira, dedo: vivo.dedo, t: agora() });
  });

  // o puxador do giro e o painel do fantasma (D98) vêm sob demanda: só aparecem com a ferramenta de colocar aberta
  import('./DicaColocar.jsx').then((m) => m.registrar?.(ui)).catch(() => {});

  return () => {
    for (const f of soltarEntrada) f();
    soltarEfeito();
    if (tipo) fechar();
  };
}

/** Rótulo de uma zona (índice) para a barra. */
export const nomeZona = (z) => ZONAS[typeof z === 'number' ? ZONAS_ORDEM[z] : z]?.nome ?? '';
