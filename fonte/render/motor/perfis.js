// Perfis de qualidade (desenho do render 2.10, D33, D66) e a escolha automática pelo nome da placa. O perfil de
// referência é o 'pc', o PC do dono (Radeon RX 550 em 1080p nativo, medido em docs/pesquisa/pc-dono/): Ultra e Alta
// ficam para placas maiores e o Média para o Poco X7 (volta depois). Sem three: roda no Node (testes) e no navegador.
import { congelar } from '../../comum/util.js';
import { ORCAMENTO } from '../../contratos/render.js';

const SOMBRA_ALTA = { tam: 1024, cascatas: 2, raioMax: 1400, degrau: 1, pcf: 8, raioPcf: 1.3 };

/**
 * Cada perfil: resolução interna (x CSS, com a resolução dinâmica em degraus entre prMin e prMax; no 'pc', em escalas
 * da nativa com teto de pixels), MSAA do alvo HDR, sombra própria (D43: tamanho de cada cascata, cascatas, raio
 * máximo, degrau do sol em graus, amostras e raio do PCF), alcance do LOD0 dos prédios, níveis do bloom, céu (direto
 * por pixel ou cubo assado, D9), tamanho do PMREM, pós ligado, vinheta, o qps alvo e, nos perfis de PC, o alvo em ms
 * de placa da resolução dinâmica pelo cronômetro (alvoGpu). `base`: o perfil de quem o 'pc' herda as tabelas dos
 * domínios (porPerfil). Teto do orçamento em fonte/contratos/render.js (ORCAMENTO; no 'pc', também em `orcamento`).
 */
export const PERFIS = congelar({
  ultra: {
    id: 'ultra', nome: 'Ultra', prMin: 1.5, prMax: 2, msaa: 4, lod0: 900, bloom: 5, ibl: 256, pos: true, vinheta: 0.1, qps: 60, alvoGpu: 15.5,
    sombra: { tam: 2048, cascatas: 2, raioMax: 2000, degrau: 1, pcf: 8, raioPcf: 1.5 },
    ceu: { modo: 'direto', cubo: 0, nuvens: true },
  },
  alta: {
    id: 'alta', nome: 'Alta', prMin: 1, prMax: 1.5, msaa: 4, lod0: 600, bloom: 5, ibl: 128, pos: true, vinheta: 0.1, qps: 60, alvoGpu: 15.5,
    sombra: SOMBRA_ALTA,
    ceu: { modo: 'direto', cubo: 0, nuvens: true },
  },
  // PC do dono (D66): 1080p nativo com MSAA 2x (o custo medido é de pixel, não de triângulo), sombra, HAO, céu e LOD
  // como no Alta; resolução dinâmica pelo cronômetro da placa de 70% a 100% da nativa, mirando 15,5 ms de placa;
  // alvo de 60 qps, piso de 30 e teto de 60 (um monitor de 144 Hz não gasta a placa à toa)
  pc: {
    id: 'pc', nome: 'PC', base: 'alta', nativo: true, pixelsMax: 1920 * 1080, escalas: [0.7, 0.8, 0.9, 1],
    msaa: 2, lod0: 600, bloom: 5, ibl: 128, pos: true, vinheta: 0.1, qps: 60, qpsPiso: 30, tetoQps: 60, alvoGpu: 15.5,
    sombra: SOMBRA_ALTA,
    ceu: { modo: 'direto', cubo: 0, nuvens: true },
    // tetos da vista aberta com a cidade grande (D66), por família como a 4.8 faz no Média: no contrato
    orcamento: ORCAMENTO.pc,
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

/** Do mais leve ao mais pesado. */
export const ORDEM_PERFIS = Object.freeze(['leve', 'media', 'pc', 'alta', 'ultra']);

/**
 * Valor de uma tabela por perfil dos domínios (LOD, alcance, campo de alturas): o do id, o da base (o 'pc' herda do
 * Alta) ou o padrão.
 * @example porPerfil({ alta: 2048, media: 1024 }, PERFIS.pc) // 2048
 */
export function porPerfil(tabela, perfil, padrao = 'media') {
  return tabela?.[perfil?.id] ?? tabela?.[perfil?.base] ?? tabela?.[padrao];
}

/** Orçamento gráfico do perfil: o do contrato (ORCAMENTO) ou o do próprio perfil. */
export function orcamentoDoPerfil(id) {
  return ORCAMENTO[id] ?? PERFIS[id]?.orcamento ?? null;
}

// ------------------------------------------------------------------------------------------------ escolha

/**
 * Faixas de placas pelo nome (WEBGL_debug_renderer_info), na ordem em que são conferidas: a primeira que casa decide.
 * Os celulares vêm antes (um Chromebook com Mali também é Média); as de PC separam a entrada (a faixa do PC do dono:
 * RX 460 a 560, GTX 750 a 1050, integradas boas) das médias (Alta) e das grandes (Ultra).
 */
export const FAIXAS = congelar([
  { perfil: 'leve', faixa: 'placa por software', re: /SwiftShader|llvmpipe|softpipe|Software|Microsoft Basic Render/i },
  { perfil: 'media', faixa: 'celular da faixa do Poco X7 (Mali-G6xx MC2)', re: /Mali-G6\d{1,2}\b.*\bMC2\b/i },
  // Adreno 6xx e os 7xx de entrada (710, 720, 725 dos Snapdragon 7 Gen): a mesma faixa do Poco X7
  { perfil: 'media', faixa: 'celular da faixa do Poco X7 (Adreno 6xx a 725)', re: /Adreno (\(TM\) )?(6\d\d|7[0-2]\d)\b/i },
  { perfil: 'ultra', faixa: 'placa grande (RTX 2060 ou maior, RX 5700 ou maior)',
    re: /RTX\s*(?:20[6-8]0|30[6-9]0|40[6-9]0|50[6-9]0)|RTX\s*A\d{3,4}|Quadro\s*RTX|TITAN\s*(?:RTX|V|Xp)|RX\s*(?:57\d0|6[6-9]\d0|7[6-9]\d0|9\d{3})(?!\d)|Radeon\s*VII|Vega\s*(?:56|64)(?!\d)|Apple\s*M\d\s*(?:Pro|Max|Ultra)/i },
  { perfil: 'alta', faixa: 'placa média (GTX 1060 a 1660, RTX 3050, RX 470 a 590, RX 5500 e 6500)',
    re: /RTX\s*(?:2050|3050|4050)|GTX\s*(?:16[5-6]0|10[6-8]0|9[7-8]0|780)|TITAN\s*X|RX\s*(?:4[7-8]0|5[7-9]0|55\d0|56\d0|6500)(?!\d)|R9\s*(?:Fury|Nano|29\d|39\d)|Radeon\s*(?:680M|760M|780M|880M|890M)|Arc\s*(?:\(TM\)\s*)?(?:A[5-7]\d{2}|B\d{3})|Apple\s*M\d/i },
  { perfil: 'pc', faixa: 'placa de entrada do PC (RX 460 a 560, GTX 750 a 1050, integradas boas)',
    re: /RX\s*(?:4[4-6]0|5[3-6]0|640|6400|5300)(?!\d)|R7\s*\d{3}|R9\s*(?:2[0-8]\d|3[0-8]\d)|HD\s*[78]\d{3}|GTX\s*(?:1630|1050|9[5-6]0|7[4-6]0|6[5-9]0)|GT\s*1030|MX\s*\d{3}|Vega\s*\d{1,2}(?!\d)|Radeon\s*(?:\(TM\)\s*)?Graphics|Radeon\s*(?:610M|660M|740M)|Iris\s*(?:\(R\)\s*)?Xe|Arc\s*(?:\(TM\)\s*)?(?:A3\d{2}|Graphics)/i },
  { perfil: 'media', faixa: 'integrada ou placa fraca do PC (Intel HD e UHD, Iris Plus, GT 710 a 730)',
    re: /Intel.*(?:U?HD\s*Graphics|Iris\s*(?:\(R\)\s*)?(?:Plus|Pro)?\s*Graphics)|GT\s*(?:7[1-4]0|6\d0|5\d0)(?!\d)/i },
  // celulares de ponta
  { perfil: 'alta', faixa: 'celular de ponta', movel: true, re: /Mali-G(7[1-9]|[89]\d|\d{3,})|Immortalis|Adreno \(TM\) (7[3-9]\d|[89]\d\d)|Adreno (7[3-9]\d|[89]\d\d)|Apple/i },
]);

/**
 * Nome curto da placa a partir da cadeia do WebGL (tira o invólucro do ANGLE, o código do aparelho e a API).
 * @example nomeDaPlaca('ANGLE (AMD, Radeon RX 550 Series (0x000067FF) Direct3D11 vs_5_0 ps_5_0, D3D11)') // 'Radeon RX 550 Series'
 */
export function nomeDaPlaca(gpu = '') {
  let g = String(gpu).trim();
  if (/SwiftShader/i.test(g)) return 'SwiftShader';
  const angle = g.match(/^ANGLE \(([^,]*),\s*(.*)\)$/);
  if (angle) g = angle[2];
  g = g.replace(/ANGLE Metal Renderer:\s*/i, '');
  g = g.replace(/\s*\(0x[0-9a-f]+\).*$/i, ''); // código do aparelho e a API (Windows)
  g = g.replace(/,?\s+(?:Direct3D|OpenGL|Vulkan|Metal|Unspecified)\b.*$/i, ''); // a API (Linux, Mac)
  g = g.replace(/\s*\([^()]*\)\s*$/, '').replace(/\s*\([^)]*$/, ''); // o driver (Linux) e o que sobrou aberto
  return g.replace(/\((?:TM|R)\)/gi, '').replace(/\s+/g, ' ').trim() || String(gpu);
}

/**
 * Perfil sugerido pelo processador gráfico (D33, D66) e o motivo. A RX 550 do dono cai no 'pc'; uma placa de PC
 * desconhecida também (o perfil de referência, com a resolução dinâmica); um celular desconhecido cai no Leve.
 * @param {{ gpu?: string, movel?: boolean }} info  gpu: UNMASKED_RENDERER_WEBGL; movel: Android, iPhone ou iPad
 * @returns {{ id: string, faixa: string, placa: string, motivo: string }}
 */
export function escolherPerfil({ gpu = '', movel = false } = {}) {
  const g = String(gpu);
  const placa = nomeDaPlaca(g);
  for (const f of FAIXAS) {
    if (f.movel && !movel) continue;
    if (f.re.test(g)) return { id: f.perfil, faixa: f.faixa, placa, motivo: `${placa || 'placa'}: ${f.faixa}` };
  }
  const faixa = movel ? 'celular desconhecido' : 'placa de PC desconhecida: o perfil de referência, com a resolução dinâmica';
  return { id: movel ? 'leve' : 'pc', faixa, placa, motivo: `${placa || 'placa sem nome'}: ${faixa}` };
}

/**
 * Só o id do perfil sugerido.
 * @returns {'ultra' | 'alta' | 'pc' | 'media' | 'leve'}
 * @example sugerirPerfil({ gpu: 'Mali-G615 MC2', movel: true }) // 'media'
 */
export function sugerirPerfil(info = {}) {
  return escolherPerfil(info).id;
}

/** Perfil pelo id (desconhecido ou 'auto' cai no sugerido). */
export function perfilDe(id, sugerido = 'media') {
  return PERFIS[id] ?? PERFIS[sugerido] ?? PERFIS.media;
}

// ------------------------------------------------------------------------------------------------ resolução

/**
 * Razão de pixels nominal (a mais alta) do perfil num aparelho, ou a fixa dos testes (?pr=). No 'pc' é a nativa (o
 * dpr: com a escala de 150% do Windows, 1,5) com o teto de pixels de 1080p quando o tamanho da tela é conhecido.
 * @param {{ w: number, h: number }} [tela]  tamanho da tela em px CSS
 */
export function razaoDePixels(perfil, dpr = 1, fixa = 0, tela = null) {
  if (fixa > 0) return fixa;
  const d = dpr > 0 ? dpr : 1;
  if (perfil.nativo) {
    const px = tela && tela.w > 1 && tela.h > 1 ? tela.w * tela.h : 0;
    const teto = px && perfil.pixelsMax ? Math.sqrt(perfil.pixelsMax / px) : Infinity;
    return +Math.max(0.25, Math.min(4, d, teto)).toFixed(4);
  }
  return Math.max(perfil.prMin, Math.min(perfil.prMax, d));
}

/** Degraus da resolução dinâmica dos perfis sem escalas (a troca refaz os alvos: só em passos fixos). */
export const DEGRAUS_PR = Object.freeze([0.7, 0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.8, 2]);

/**
 * Degraus válidos de um perfil num aparelho, do menor ao nominal (sempre o último). No 'pc', as escalas da nativa
 * (70%, 80%, 90% e 100%); nos outros, os DEGRAUS_PR de prMin até o nominal.
 */
export function degrausDoPerfil(perfil, dpr = 1, tela = null) {
  const max = razaoDePixels(perfil, dpr, 0, tela);
  if (perfil.nativo) return perfil.escalas.map((s) => +(s * max).toFixed(4));
  const d = DEGRAUS_PR.filter((s) => s >= perfil.prMin - 1e-6 && s < max - 0.05);
  return [...d, max];
}

/** Índice do degrau mais perto de uma razão de pixels. */
export function indiceDoDegrau(degraus, pr) {
  let melhor = 0;
  for (let i = 1; i < degraus.length; i++) if (Math.abs(degraus[i] - pr) < Math.abs(degraus[melhor] - pr)) melhor = i;
  return melhor;
}

export function registrar() {}
