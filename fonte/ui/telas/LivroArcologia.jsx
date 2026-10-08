// Livro da Arcologia (D26, D49, D88 a D90; dona: X1b): a tela 'arcologia' (o corpo vem sob demanda, corpo/
// LivroArcologia.jsx) com as etapas do Ato 1 (o Mirror Lake e o par Blade Tower e Legacy Tower) e a sede v3 inteira, e o
// momento de cada etapa pronta (título de terço inferior, a fala de quem conduz e o voo de câmera até a peça). Aqui
// ficam as peças pequenas que a folha da parte (selecao/secoes/arcologia.jsx) também usa: nomes, frases dos efeitos, a
// recusa de cada etapa e as ações (começar, importar o que falta, ver no mapa). Dinheiro sempre por ui/formato.js.
import { sobDemanda } from './corpo/sobDemanda.jsx';
import { registrarEtapaMomento } from './Momento.jsx';
import { t, temTexto } from '../textos.js';
import * as fmt from '../formato.js';
import { comando } from '../acoes.js';
import { MARCOS } from '../../data/marcos.js';
import { ITENS } from '../../data/holding.js';
import { ECONOMIA } from '../../data/economia.js';
import { CAMERA_ARCOLOGIA, PLANOS, PLANO_ESCOLHIDO, TRECHOS_HORIZON } from '../../data/arcologia-plano.js';
import { etapaDe } from '../../data/arcologia.js';

const PLANO = PLANOS[PLANO_ESCOLHIDO];

/** Nome em inglês de uma parte (D89), na frase do jogo ('Blade Tower e Legacy Tower'). */
export const nomeParte = (id) => (temTexto(`x1.parte.${id}`) ? t(`x1.parte.${id}`) : id ?? '');

/** Nome de um trecho do Horizon Ring ('Horizon Ring VI'), ou null. */
export const nomeTrecho = (id) => TRECHOS_HORIZON.find((x) => x.id === id)?.nome ?? null;

/** Nome curto da etapa ('Sede operacional'). */
export const nomeEtapa = (e) => (e && temTexto(`x1.etapa.${e.id}`) ? t(`x1.etapa.${e.id}`) : e?.nome ?? e?.id ?? '');

/** Frase do que um efeito da D49 dá. */
export function fraseEfeito(ef) {
  switch (ef?.tipo) {
    case 'agua':
      return t('x1.efeito.agua', { n: fmt.numero(ef.moradores ?? 0) });
    case 'licenca':
      return t('x1.efeito.licenca', { n: ef.n ?? 1 });
    case 'holding':
      return t('x1.efeito.holding', { p: fmt.pct(ef.produtividade ?? 0), n: ef.caminhoes ?? 0 });
    case 'vagas':
      return t('x1.efeito.vagas', { n: fmt.numero((ef.vagas ?? []).reduce((a, b) => a + b, 0)) });
    case 'moradores':
      return t('x1.efeito.moradores', { n: fmt.numero(ef.n ?? 0) });
    case 'demanda':
      return t('x1.efeito.demanda', { km: fmt.numero((ef.raio ?? 0) / 1000, 1) });
    case 'atratividade':
    case 'legado':
      return t(`x1.efeito.${ef.tipo}`, { v: ef.v ?? 0 });
    default:
      return temTexto(`x1.efeito.${ef?.tipo}`) ? t(`x1.efeito.${ef.tipo}`) : '';
  }
}

/** Glifo de um efeito. */
export const glifoEfeito = (tipo) => ({
  vias: 'avenida', agua: 'agua', valor: 'valuation', licenca: 'mapa', holding: 'caminhao', vagas: 'trabalho',
  moradores: 'populacao', demanda: 'demanda', atratividade: 'marco', legado: 'legado', helicoptero: 'arcologia',
})[tipo] ?? 'check';

/**
 * Por que a etapa não começa (null se pode): o marco, a obra de que depende no chão (a ordem física, D98), as equipes
 * de obra todas ocupadas ou o caixa.
 */
export function fraseRecusa(e, etapas = [], caixa = Infinity) {
  if (!e || e.estado >= 2) return null;
  const codigo = e.recusa ?? (e.estado === 0 ? 'marco' : null);
  if (codigo === 'marco') return t('x1.recusa.marco', { n: e.marco, nome: MARCOS[e.marco]?.nome ?? '' });
  if (codigo === 'trancado') return t('x1.recusa.trancado', { etapa: nomeEtapa(etapas.find((x) => x.id === e.requisito) ?? { id: e.requisito }) });
  if (codigo === 'ocupado') return t('ux1.livro.recusa.ocupado');
  if (e.estado === 1 && Number.isFinite(caixa) && caixa < (e.creditos ?? 0)) return t('x1.recusa.creditos', { v: fmt.dinheiro((e.creditos ?? 0) - caixa) });
  return null;
}

/** A frase das obras em paralelo de uma etapa: com quem anda junto, ou que pode começar já (null sem o que dizer). */
export function fraseParalelo(e, etapas = []) {
  const outras = (e?.emParalelo ?? []).map((id) => nomeEtapa(etapas.find((x) => x.id === id) ?? { id }));
  if (e?.estado === 2 && outras.length) return t('ux1.livro.paralelo', { etapa: outras.join(', ') });
  if (e?.estado === 1 && !e.recusa && (e.emParalelo ?? []).length) return t('ux1.livro.livre');
  return null;
}

/** Importações a caminho do armazém, por item (q.deposito da S3a): { item: n }. */
export function importando(dep) {
  const m = {};
  for (const x of dep?.importacoes ?? []) if (x?.item && Number.isFinite(x.n)) m[x.item] = (m[x.item] ?? 0) + x.n;
  return m;
}

/**
 * O que falta importar para a etapa: [{ item, n }] dos materiais que nem o canteiro, nem o caminhão, nem o estoque,
 * nem a importação que já vem a caminho cobrem (sem contar esta, dois toques no botão pagariam duas vezes).
 */
export function faltaImportar(e, vindo = {}) {
  const l = [];
  for (const m of e?.materiais ?? []) {
    const tem = (m.entregue ?? 0) + (m.aCaminho ?? 0) + (m.estoque ?? 0) + (vindo[m.item] ?? 0);
    if (tem < m.pede) l.push({ item: m.item, n: m.pede - tem });
  }
  return l;
}

/** Custo (unidades) de importar a lista: o preço de importação do Depósito, ou 160% do preço base (D25). */
export function custoImportar(lista, dep = null) {
  return lista.reduce((s, x) => {
    const p = dep?.itens?.find((i) => i.item === x.item)?.precoImportacao;
    return s + x.n * (Number.isFinite(p) ? p : (ITENS[x.item]?.base ?? 0) * ECONOMIA.importacao.fator);
  }, 0);
}

/** Onde a câmera vai para uma parte (ou um trecho do Horizon Ring). */
export function alvoDaParte(id, trecho = null) {
  const [cx, cz] = PLANO.centro;
  if (id === 'torre') return { x: cx, z: cz, dist: 1250, guinada: 20, inclinacao: 16 };
  if (id === 'lago') return { x: cx, z: cz, dist: 650, guinada: 20, inclinacao: 38 };
  const t0 = TRECHOS_HORIZON.find((x) => x.id === trecho);
  if (t0) {
    const a = ((t0.de + 22.5) * Math.PI) / 180;
    return { x: cx + 729 * Math.cos(a), z: cz + 729 * Math.sin(a), dist: 900, inclinacao: 24 };
  }
  const p = PLANO.partes.find((x) => x.id === id)?.pecas?.find((x) => Number.isFinite(x.x));
  return p ? { x: p.x, z: p.z, dist: 900, inclinacao: 22 } : { ...CAMERA_ARCOLOGIA };
}

/** Começa a etapa (o comando da X1b); a recusa vira aviso pela ação. */
export const iniciarEtapa = (id) => comando('arcologia.iniciar', { etapa: id });

/** Troca o modo de envio dos materiais da etapa (D109): 'auto' ou 'manual'. */
export const trocarEnvio = (id, modo) => comando('arcologia.envio', { etapa: id, modo });

/** Manda n unidades de um item que falta da etapa (D109). */
export const enviarMaterial = (id, item, n) => comando('arcologia.enviar', { etapa: id, item, n });

/** Manda de uma vez o que couber de todos os itens que faltam (D109). */
export const enviarTudo = (id) => comando('arcologia.enviarTudo', { etapa: id });

/** Importa o que falta para a etapa, item a item (descontado o que já vem importado). */
export async function importarFalta(e, dep = null) {
  for (const x of faltaImportar(e, importando(dep))) {
    const r = await comando('importar', { item: x.item, n: Math.min(1000, Math.ceil(x.n)) });
    if (!r.ok) break;
  }
}

/** Fecha o que estiver aberto e voa até a peça (R.voo, ou camera.irPara). */
export function verNoMapa(ui, alvo) {
  ui.fecharTela?.();
  const R = ui.R;
  if (R?.voo) Promise.resolve(R.voo(alvo)).catch(() => {});
  else R?.camera?.irPara?.(alvo, 1500);
}

/** Números da fala da etapa, dos efeitos nos dados (a C1 calibra e a fala acompanha). */
function numerosDaEtapa(id) {
  const ef = (tipo) => etapaDe(id)?.efeitos?.find((x) => x.tipo === tipo);
  return {
    vagas: fmt.numero((ef('vagas')?.vagas ?? []).reduce((a, b) => a + b, 0)),
    caminhoes: fmt.numero(ef('holding')?.caminhoes ?? 0),
    moradores: fmt.numero(ef('moradores')?.n ?? 0),
    agua: fmt.numero(ef('agua')?.moradores ?? 0),
  };
}

/** Momento da etapa pronta (U1b): o nome da parte, a fala de quem conduz e o voo de câmera até ela. */
export function momentoDaEtapaX1(ev) {
  const parte = String(ev?.id ?? '').split('.')[0];
  if (parte !== 'lago' && parte !== 'torre') return {};
  return {
    titulo: nomeParte(parte),
    fala: temTexto(`x1.momento.${ev.id}`) ? { quem: parte === 'lago' ? 'tome' : 'iris', texto: t(`x1.momento.${ev.id}`, numerosDaEtapa(ev.id)) } : undefined,
    alvo: alvoDaParte(parte),
  };
}

export function registrar(ui) {
  ui.registrarTela('arcologia', sobDemanda(() => import('./corpo/LivroArcologia.jsx'), { id: 'arcologia', glifo: 'arcologia', titulo: 'x1.livro.titulo' }));
  registrarEtapaMomento((ev) => momentoDaEtapaX1(ev));
}
