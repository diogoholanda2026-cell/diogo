// Perfis de qualidade (desenho do render 2.10, D33) e a escolha automática. A Prévia 0 troca as estimativas pelo
// medido no Poco X7 (página de teste: sonda e bancada). Sem three: roda no Node (testes) e no navegador.
import { congelar } from '../../comum/util.js';

/**
 * Cada perfil: resolução interna (x CSS, com a resolução dinâmica em degraus entre prMin e prMax), MSAA do alvo HDR,
 * sombra própria (D43: tamanho de cada cascata, cascatas, raio máximo, degrau do sol em graus, amostras e raio do
 * PCF), alcance do LOD0 dos prédios, níveis do bloom, céu (direto por pixel ou cubo assado, D9), tamanho do PMREM,
 * pós ligado, vinheta e o qps alvo da resolução dinâmica. Teto do orçamento em fonte/contratos/render.js (ORCAMENTO).
 */
export const PERFIS = congelar({
  ultra: {
    id: 'ultra', nome: 'Ultra', prMin: 1.5, prMax: 2, msaa: 4, lod0: 900, bloom: 5, ibl: 256, pos: true, vinheta: 0.1, qps: 60,
    sombra: { tam: 2048, cascatas: 2, raioMax: 2000, degrau: 1, pcf: 8, raioPcf: 1.5 },
    ceu: { modo: 'direto', cubo: 0, nuvens: true },
  },
  alta: {
    id: 'alta', nome: 'Alta', prMin: 1, prMax: 1.5, msaa: 4, lod0: 600, bloom: 5, ibl: 128, pos: true, vinheta: 0.1, qps: 60,
    sombra: { tam: 1024, cascatas: 2, raioMax: 1400, degrau: 1, pcf: 8, raioPcf: 1.3 },
    ceu: { modo: 'direto', cubo: 0, nuvens: true },
  },
  media: {
    id: 'media', nome: 'Média', prMin: 0.85, prMax: 1.3, msaa: 2, lod0: 350, bloom: 4, ibl: 64, pos: true, vinheta: 0.1, qps: 30,
    sombra: { tam: 1024, cascatas: 1, raioMax: 1000, degrau: 1.5, pcf: 5, raioPcf: 1.2 },
    ceu: { modo: 'cubo', cubo: 256, nuvens: true },
  },
  leve: {
    id: 'leve', nome: 'Leve', prMin: 0.7, prMax: 1, msaa: 0, lod0: 200, bloom: 0, ibl: 32, pos: false, vinheta: 0, qps: 30, nuvemSombra: false,
    sombra: { tam: 1024, cascatas: 1, raioMax: 500, degrau: 3, pcf: 1, raioPcf: 0, ligada: false },
    ceu: { modo: 'cubo', cubo: 128, nuvens: false },
  },
});

export const ORDEM_PERFIS = Object.freeze(['leve', 'media', 'alta', 'ultra']);

/**
 * Perfil sugerido pelo processador gráfico (D33). O Poco X7 (Mali-G615 MC2) cai no Média pela regra `Mali-G6xx MC2`;
 * o jogo antigo o mandava para a Alta por uma regex larga.
 * @param {{ gpu?: string, movel?: boolean }} info  gpu: UNMASKED_RENDERER_WEBGL; movel: Android, iPhone ou iPad
 * @returns {'ultra' | 'alta' | 'media' | 'leve'}
 * @example sugerirPerfil({ gpu: 'Mali-G615 MC2', movel: true }) // 'media'
 */
export function sugerirPerfil({ gpu = '', movel = false } = {}) {
  const g = String(gpu);
  if (/SwiftShader|llvmpipe|softpipe|Software|Microsoft Basic Render/i.test(g)) return 'leve';
  if (/Mali-G6\d{1,2}\b.*\bMC2\b/i.test(g)) return 'media';
  // Adreno 6xx e os 7xx de entrada (710, 720, 725 dos Snapdragon 7 Gen): a mesma faixa do Poco X7
  if (/Adreno (\(TM\) )?(6\d\d|7[0-2]\d)\b/i.test(g)) return 'media';
  if (!movel) return 'ultra';
  if (/Mali-G(7[1-9]|[89]\d|\d{3,})|Immortalis|Adreno \(TM\) (7[3-9]\d|[89]\d\d)|Adreno (7[3-9]\d|[89]\d\d)|Apple/i.test(g)) return 'alta';
  return 'leve';
}

/** Perfil pelo id (desconhecido ou 'auto' cai no sugerido). */
export function perfilDe(id, sugerido = 'media') {
  return PERFIS[id] ?? PERFIS[sugerido] ?? PERFIS.media;
}

/** Razão de pixels do perfil para um aparelho (dpr) ou a fixa dos testes (?pr=). */
export function razaoDePixels(perfil, dpr = 1, fixa = 0) {
  if (fixa > 0) return fixa;
  return Math.max(perfil.prMin, Math.min(perfil.prMax, dpr || 1));
}

/** Degraus da resolução dinâmica (a troca refaz os alvos: só em passos fixos e com histerese). */
export const DEGRAUS_PR = Object.freeze([0.7, 0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.8, 2]);

/** Degraus válidos de um perfil num aparelho: de prMin até o menor entre prMax e o dpr. */
export function degrausDoPerfil(perfil, dpr = 1) {
  const max = Math.max(perfil.prMin, Math.min(perfil.prMax, dpr || 1));
  const d = DEGRAUS_PR.filter((s) => s >= perfil.prMin - 1e-6 && s <= max + 1e-6);
  return d.length ? d : [max];
}

export function registrar() {}
