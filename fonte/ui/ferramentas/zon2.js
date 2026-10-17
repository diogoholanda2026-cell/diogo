// ZON2 na interface (D112 e D113): partes PURAS do painel de crescimento da zona, dos contornos nomeados do Distrito
// Industrial e da Zona de Utilidades e do texto da rede de longo alcance. Sem Preact: o teste ui as chama sem navegador.
import { consultar } from '../consultas.js';
import { t } from '../textos.js';
import * as fmt from '../formato.js';
import { ZONAS } from '../../data/zonas.js';
import { LONGO_ALCANCE } from '../../data/zon2.js';

export const LOTE_MIN = 1;
export const LOTE_MAX = 1000;
export const LOTE_PADRAO = '10';
export const MODOS = Object.freeze(['automatico', 'manual']);



/**
 * Valida o texto do campo do lote. `pedido`: o que ainda falta do lote em andamento (soma, no máximo 1000).
 * @returns {{ n: number | null, erro: null | 'invalido' | 'maximo' }}
 */
export function validarLote(texto, pedido = 0) {
  const s = String(texto ?? '').trim();
  if (!/^\d{1,5}$/.test(s)) return { n: null, erro: 'invalido' };
  const n = Number(s);
  if (n < LOTE_MIN || n > LOTE_MAX) return { n: null, erro: 'invalido' };
  if (n + Math.max(0, pedido) > LOTE_MAX) return { n: null, erro: 'maximo' };
  return { n, erro: null };
}

/** Quantas construções a demanda acumulou, inteiro e no máximo 1000. */
export const esperaInteira = (c) => Math.max(0, Math.min(LOTE_MAX, Math.floor(c?.espera ?? 0)));

/** Quais áreas a sessão destaca: ['distrito'] na zona industrial, ['utilidades'] ao posicionar utilidade. */
export function areasDaSessao(s, regras) {
  if (!s || !regras) return [];
  if (s.tipo === 'zona') {
    const z = s.maquina?.zona;
    return !s.maquina?.apagar && ZONAS[z]?.familia === 'ind' ? ['distrito'] : [];
  }
  if (s.tipo === 'colocar') {
    const tipo = s.maquina?.tipo;
    const zona = s.item?.zona;
    if (zona === 'utilidades' || regras.utilidades?.tipos?.includes(tipo)) return ['utilidades'];
    if (zona === 'industrial' || regras.distrito?.tipos?.includes(tipo)) return ['distrito'];
  }
  return [];
}

/** Pontos do contorno com a aresta quebrada a cada `passo` m (o polígono acompanha o relevo na tela). */
export function densificar(contorno, passo = 100) {
  const out = [];
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i];
    const b = contorno[(i + 1) % contorno.length];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / passo));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  return out;
}

/**
 * Texto da rede de longo alcance de uma prévia de produtor (q.construir.previa().longoAlcance), ou null se não há linha.
 * regras: q.zona.regras(). curto: só a medida e o custo (para a marca no mundo).
 */
export function textoLongoAlcance(lo, regras = null, { curto = false } = {}) {
  if (!lo) return null;
  const rec = ['agua', 'energia', 'esgoto'].includes(lo.rec) ? lo.rec : null;
  const nome = rec ? t(`zon2.rede.${rec}`) : t('zon2.rede.titulo');
  const m = Number.isFinite(lo.metros) ? Math.round(lo.metros) : 0;
  if (lo.alcanca === false) return m > 0 ? t('zon2.rede.semAlcance', { metros: fmt.numero(m) }) : t('zon2.rede.semRede');
  if (m <= 0) return null;
  if (curto) return t('zon2.rede.marca', { rede: nome, metros: fmt.numero(m), custo: fmt.dinheiro(lo.custo ?? 0) });
  const porMetro = regras?.longoAlcance?.custoPorMetro?.[lo.rec] ?? LONGO_ALCANCE.custoPorMetro[lo.rec] ?? 0;
  return `${nome} · ${t('zon2.rede.linha', { metros: fmt.numero(m), custo: fmt.dinheiro(lo.custo ?? 0), porMetro: fmt.dinheiro(porMetro) })}`;
}

let cacheRegras = { sim: null, v: null };
/** q.zona.regras() da simulação atual (guardada: não muda no jogo). */
export function regrasAtuais(sim = null) {
  const alvo = sim ?? 'x';
  if (cacheRegras.sim === alvo && cacheRegras.v) return cacheRegras.v;
  const v = consultar('zona.regras');
  cacheRegras = { sim: alvo, v: v ?? null };
  return v ?? null;
}

