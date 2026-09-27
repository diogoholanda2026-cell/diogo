// Perfis de qualidade (desenho do render 2.10, D33) e a escolha automática. Primeira versão da F0; a R1a completa
// (bloom, céu, PMREM, LOD e resolução dinâmica) e a Prévia 0 troca as estimativas pelo medido no Poco X7.
// Sem three: roda no Node (testes) e no navegador.
import { congelar } from '../../comum/util.js';

/**
 * Cada perfil: resolução interna (x CSS), MSAA, sombra própria (D43: tamanho do mapa, cascatas, raio máximo),
 * alcance do LOD0 dos prédios e o teto do orçamento (fonte/contratos/render.js, ORCAMENTO).
 */
export const PERFIS = congelar({
  ultra: { id: 'ultra', nome: 'Ultra', prMin: 1.5, prMax: 2, msaa: 4, sombra: { tam: 2048, cascatas: 2, raioMax: 1500 }, lod0: 900, bloom: 5 },
  alta: { id: 'alta', nome: 'Alta', prMin: 1, prMax: 1.5, msaa: 4, sombra: { tam: 1024, cascatas: 2, raioMax: 900 }, lod0: 600, bloom: 5 },
  media: { id: 'media', nome: 'Média', prMin: 0.85, prMax: 1.3, msaa: 2, sombra: { tam: 1024, cascatas: 1, raioMax: 700 }, lod0: 350, bloom: 4 },
  leve: { id: 'leve', nome: 'Leve', prMin: 0.7, prMax: 1, msaa: 0, sombra: { tam: 1024, cascatas: 1, raioMax: 500 }, lod0: 200, bloom: 0 },
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
  if (/Adreno \(TM\) 6\d\d|Adreno 6\d\d/i.test(g)) return 'media';
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
